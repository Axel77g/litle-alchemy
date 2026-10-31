import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrthographicCamera, OrbitControls, Environment, ContactShadows, PerformanceMonitor } from '@react-three/drei'
import { EffectComposer, N8AO, Bloom, TiltShift2, Vignette, ToneMapping } from '@react-three/postprocessing'
import World from './World'
import { registerRenderer } from '../debug/perf'
import DropPicker from './DropPicker'
import ExpansionGhosts from './ExpansionGhosts'
import ViewOffset from './ViewOffset'
import { cameraControl } from './cameraControl'
import { useUi } from '../ui/uiStore'
import DayNight from './DayNight'
import FrameLimiter from './FrameLimiter'
import { useGame } from '../store/game'
import { AUTO_QUALITY, TIERS, useDpr, useQuality } from './quality'
import * as THREE from 'three'

// Point visé décalé vers le bas de l'écran (même angle, caméra translatée pareil) : l'île remonte, le dock ne la cache plus.
// Augmente pour la remonter davantage.
const LOOK_SHIFT = 0

// Le déplacement ne suit que la verticale de l'écran, qui correspond à la diagonale (1, 0, 1) sur le sol, dans une plage limitée
const PAN_RANGE = 3
function clampPan(e?: { target: any }) {
  const c = e?.target
  if (!c) return
  const along = THREE.MathUtils.clamp(((c.target.x - LOOK_SHIFT) + (c.target.z - LOOK_SHIFT)) / 2, -PAN_RANGE, PAN_RANGE)
  const x = LOOK_SHIFT + along
  const z = LOOK_SHIFT + along
  const dx = x - c.target.x
  const dz = z - c.target.z
  const dy = -c.target.y
  if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) < 1e-6) return
  c.target.set(x, 0, z) // on retire aussi toute dérive latérale ou verticale
  c.object.position.add({ x: dx, y: dy, z: dz } as THREE.Vector3)
}

export default function DungeonBoard() {
  const controls = useRef(null)
  // État du monde : cellules composites avec auras précalculées (voir engine/grid.ts)
  const world = useGame((s) => s.world)
  const tier = useQuality((s) => s.tier)
  const quality = TIERS[tier]
  const dpr = useDpr(quality.pixelBudget)

  // Le moniteur de fps démarre après le chargement : compilation des shaders et chargement de l'environnement
  // font chuter les fps au début, ce qui faisait baisser la qualité à tort.
  const [monitorOn, setMonitorOn] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setMonitorOn(true), 5000)
    return () => clearTimeout(t)
  }, [])

  return (
    <Canvas shadows frameloop="never" dpr={dpr} gl={{ antialias: false }} onCreated={({ gl }) => registerRenderer(gl)} onPointerMissed={() => useUi.setState({ selectedGhost: null })}>
      {/* Cadence de rendu plafonnée (voir FrameLimiter) */}
      <FrameLimiter />

      {/* Filet de sécurité : si on tombe vraiment bas (< 22 fps, même en cadence plafonnée) on baisse d'un niveau.
          Jamais de remontée automatique : le niveau est choisi selon l'appareil (voir quality.ts) */}
      {AUTO_QUALITY && monitorOn && (
        <PerformanceMonitor bounds={() => [22, 999]} flipflops={3} onDecline={() => useQuality.getState().step(-1)} />
      )}

      {/* 1. Caméra Isométrique (Angle exact de Minecraft Dungeons / Unrailed) */}
      <OrthographicCamera makeDefault position={[12 + LOOK_SHIFT, 14, 12 + LOOK_SHIFT]} zoom={60} onUpdate={(c) => c.lookAt(LOOK_SHIFT, 0, LOOK_SHIFT)} near={-50} far={200} />

      {/* Caméra : angle isométrique FIXE (pas de rotation). Zoom molette / pincement ; déplacement haut / bas seulement
          (un doigt ou clic gauche : glisser). Les limites sont gérées dans clampPan. */}
      <OrbitControls
        ref={(c) => {
          cameraControl.current = c
        }}
        makeDefault
        target={[LOOK_SHIFT, 0, LOOK_SHIFT]}
        enableRotate={false}
        enablePan
        screenSpacePanning={false}
        enableDamping
        minZoom={40}
        maxZoom={160}
        mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
        touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }}
        onChange={clampPan}
      />

      {/* 2. Lumières pilotées par le cycle jour / nuit (soleil, ambiance, fond, reflets) : voir DayNight.tsx */}
      <DayNight shadowMapSize={quality.shadowMap} tier={tier} />

      {/* Reflets doux sur les matériaux métalliques/eau (l'intensité suit l'heure) */}
      <Environment preset="sunset" />

      {/* 3. Le monde, généré depuis les tableaux de content/world1/layout.ts */}
      <World world={world} />
      <ViewOffset />
      <DropPicker />
      <ExpansionGhosts world={world} />

      {/* Ombre douce sous toute l'île flottante */}
      {/* (calculée une seule fois, et à nouveau quand l'île change de taille : par défaut elle re-rendait toute la scène à chaque image) */}
      {quality.contactShadows && (
        <ContactShadows key={`contact-${world.size}`} frames={1} resolution={256} position={[0, -0.85, 0]} opacity={0.6} scale={15} blur={2.5} far={4} color="#0a0812" />
      )}

      {/* 4. LE POST-PROCESSING "MINECRAFT DUNGEONS" (Le Game Changer) */}
      <EffectComposer key={`fx-${tier}`} multisampling={quality.msaa}>
        {/* Ombres de contact profondes dans les creux des cubes */}
        {quality.ao && (
          <N8AO aoRadius={0.6} intensity={3} distanceFalloff={0.5} color="#181026" quality={quality.ao.quality} halfRes={quality.ao.halfRes} />
        )}

        {/* Halo lumineux doux autour du feu et des pièces d'or */}
        <Bloom luminanceThreshold={1.1} mipmapBlur intensity={0.8} />

        {/* L'effet Maquette (floute très légèrement le haut et le bas de l'écran) */}
        {quality.tiltShift ? <TiltShift2 blur={0.12} taper={0.5} /> : <></>}

        {/* Assombrit doucement les coins */}
        <Vignette eskil={false} offset={0.1} darkness={0.65} />
        <ToneMapping mode={THREE.ACESFilmicToneMapping} />
      </EffectComposer>
    </Canvas>
  )
}

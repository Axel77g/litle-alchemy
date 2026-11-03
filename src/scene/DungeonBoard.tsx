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
import { PerfProfiler as P } from '../debug/livePerf'
import { useIsOn, useSwitch } from '../debug/switches'
import { useGame } from '../store/game'
import { AUTO_QUALITY, TIERS, useDpr, useQuality } from './quality'
import * as THREE from 'three'

// Point visé décalé vers le bas de l'écran (même angle, caméra translatée pareil) : l'île remonte, le dock ne la cache plus.
// Augmente pour la remonter davantage.
const LOOK_SHIFT = 0

// Déplacement libre sur les deux axes de l'écran (haut / bas = diagonale (1, 0, 1), gauche / droite = diagonale (1, 0, -1)),
// sans rotation. La zone atteignable est l'emprise de l'île sur la grille + une marge : elle grandit avec l'île.
const PAN_MARGIN = 2 // cellules de marge autour de l'île
let boundsFor: unknown = null
let bounds = { minA: 0, maxA: 0, minB: 0, maxB: 0 }
function islandBounds(world: Map<string, { x: number; z: number }>) {
  if (boundsFor === world) return bounds
  let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity
  for (const c of world.values()) {
    const a = (c.x + c.z) / 2
    const b = (c.x - c.z) / 2
    if (a < minA) minA = a
    if (a > maxA) maxA = a
    if (b < minB) minB = b
    if (b > maxB) maxB = b
  }
  if (minA === Infinity) minA = maxA = minB = maxB = 0
  boundsFor = world
  return (bounds = { minA, maxA, minB, maxB })
}
function clampPan(e?: { target: any }) {
  const c = e?.target
  if (!c) return
  const bd = islandBounds(useGame.getState().world)
  const m = PAN_MARGIN / 2 // a et b sont des demi-sommes : une cellule vaut 0,5 sur chaque axe
  const a = THREE.MathUtils.clamp((c.target.x + c.target.z) / 2 - LOOK_SHIFT, bd.minA - m, bd.maxA + m)
  const b = THREE.MathUtils.clamp((c.target.x - c.target.z) / 2, bd.minB - m, bd.maxB + m)
  const x = LOOK_SHIFT + a + b
  const z = LOOK_SHIFT + a - b
  const dx = x - c.target.x
  const dz = z - c.target.z
  const dy = -c.target.y
  if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) < 1e-6) return
  c.target.set(x, 0, z) // on retire aussi toute dérive verticale
  c.object.position.add({ x: dx, y: dy, z: dz } as THREE.Vector3)
}

export default function DungeonBoard() {
  const controls = useRef(null)
  // État du monde : cellules composites avec auras précalculées (voir engine/grid.ts)
  const world = useGame((s) => s.world)
  const tier = useQuality((s) => s.tier)
  const quality = TIERS[tier]
  const scale = useSwitch('3d.resolution')
  const dpr = useDpr(quality.pixelBudget) * (scale === 'auto' ? 1 : Number(scale)) // diagnostic : échelle de résolution (dashboard /__perf)
  const composer = useIsOn('3d.composer')
  const ao = useIsOn('3d.ao')
  const bloom = useIsOn('3d.bloom')
  const tiltShift = useIsOn('3d.tiltShift')
  const vignette = useIsOn('3d.vignette')
  const contact = useIsOn('3d.contact')
  const environment = useIsOn('3d.environment')
  const ghosts = useIsOn('3d.ghosts')

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

      {/* Caméra : angle isométrique FIXE (pas de rotation). Zoom molette / pincement ; déplacement haut / bas / gauche / droite
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
      <P id="3D DayNight"><DayNight shadowMapSize={quality.shadowMap} tier={tier} /></P>

      {/* Reflets doux sur les matériaux métalliques/eau (l'intensité suit l'heure) */}
      {environment && <Environment preset="sunset" />}

      {/* 3. Le monde, généré depuis les tableaux de content/world1/layout.ts */}
      <P id="3D World"><World world={world} /></P>
      <ViewOffset />
      <P id="3D DropPicker"><DropPicker /></P>
      <P id="3D ExpansionGhosts">{ghosts && <ExpansionGhosts world={world} />}</P>

      {/* Ombre douce sous toute l'île flottante */}
      {/* (calculée une seule fois, et à nouveau quand l'île change de taille : par défaut elle re-rendait toute la scène à chaque image) */}
      {quality.contactShadows && contact && (
        <ContactShadows key={`contact-${world.size}`} frames={1} resolution={256} position={[0, -0.85, 0]} opacity={0.6} scale={15} blur={2.5} far={4} color="#0a0812" />
      )}

      {/* 4. LE POST-PROCESSING "MINECRAFT DUNGEONS" (Le Game Changer) */}
      {composer && (
      <EffectComposer key={`fx-${tier}`} multisampling={quality.msaa}>
        {/* Ombres de contact profondes dans les creux des cubes */}
        {quality.ao && ao && (
          <N8AO aoRadius={0.6} intensity={3} distanceFalloff={0.5} color="#181026" quality={quality.ao.quality} halfRes={quality.ao.halfRes} />
        )}

        {/* Halo lumineux doux autour du feu et des pièces d'or */}
        {bloom ? <Bloom luminanceThreshold={1.1} mipmapBlur intensity={0.8} /> : <></>}

        {/* L'effet Maquette (floute très légèrement le haut et le bas de l'écran) */}
        {quality.tiltShift && tiltShift ? <TiltShift2 blur={0.12} taper={0.5} /> : <></>}

        {/* Assombrit doucement les coins */}
        {vignette ? <Vignette eskil={false} offset={0.1} darkness={0.65} /> : <></>}
        {vignette ? <ToneMapping mode={THREE.ACESFilmicToneMapping} /> : <></>}
      </EffectComposer>
      )}
    </Canvas>
  )
}

import { useEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { isOn, useFrame, useIsOn } from '../instrument'
import * as THREE from 'three'
import { BACKGROUND_BOOST, dayCycle, sky, updateSky } from './skyCycle'

// Fond : dégradé radial (lumineux derrière l'île, plus profond vers les bords), peint dans une petite texture étirée sur l'écran.
// Passe par le post-processing comme le reste de la scène (un canvas transparent + fond CSS casserait l'alpha des effets).
function makeGradient() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  let last = ''
  return {
    texture,
    // ne retéléverse la texture que si les couleurs ont réellement changé
    paint(center: THREE.Color, edge: THREE.Color) {
      const c = center.getHexString()
      const e = edge.getHexString()
      if (c + e === last) return
      last = c + e
      // comme `radial-gradient(circle at 50% 45%, centre 0%, bord 100%)` : rayon jusqu'au coin le plus éloigné
      const g = ctx.createRadialGradient(size * 0.5, size * 0.45, 0, size * 0.5, size * 0.45, size * 0.743)
      g.addColorStop(0, '#' + c)
      g.addColorStop(1, '#' + e)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, size, size)
      texture.needsUpdate = true
    },
  }
}

// Lumières de la scène pilotées par l'heure : soleil (orangé matin et soir), ambiance, fond et reflets.
// La nuit : clair de lune bleu (ambiance + lumière rasante) sur les bords, feux de camp (pointLight) orange au centre.
export default function DayNight({ shadowMapSize, tier }: { shadowMapSize: number; tier: string }) {
  const scene = useThree((s) => s.scene)
  const sun = useRef<THREE.DirectionalLight>(null!)
  const hemi = useRef<THREE.HemisphereLight>(null!)
  const gradient = useMemo(() => makeGradient(), [])

  useEffect(() => {
    scene.background = gradient.texture
    scene.backgroundIntensity = BACKGROUND_BOOST
    return () => gradient.texture.dispose()
  }, [scene, gradient])

  const shadows = useIsOn('3d.shadows')
  useFrame('DayNight', () => {
    if (!isOn('3d.daynight')) return // diagnostic : l'éclairage reste figé
    // l'heure avance dans le moteur (store.tick) ; ici on ne fait que la lire pour l'éclairage
    updateSky(dayCycle.hour)

    sun.current.color.copy(sky.sunColor)
    sun.current.intensity = sky.sunIntensity
    sun.current.position.copy(sky.sunPosition)
    hemi.current.color.copy(sky.hemiSky)
    hemi.current.groundColor.copy(sky.hemiGround)
    hemi.current.intensity = sky.hemiIntensity
    gradient.paint(sky.background, sky.edge)
    scene.environmentIntensity = sky.env
  })

  return (
    <>
      <hemisphereLight ref={hemi} />
      <directionalLight
        ref={sun}
        key={`light-${tier}`} // recréée quand la taille de la shadow map change
        castShadow={shadows}
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-bias={-0.00005}
        shadow-normalBias={0.04}
      >
        <orthographicCamera attach="shadow-camera" args={[-8, 8, 8, -8, 1, 35]} />
      </directionalLight>
    </>
  )
}

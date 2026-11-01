import * as THREE from 'three'
import { TILE } from './constants'

// Petit cercle lumineux au sol, sous un personnage. Un seul matériau et une seule texture pour tous (aucun coût par personnage).
// Il ne touche pas aux ombres : il ne projette rien (castShadow faux) et n'en reçoit pas, et il n'écrit pas dans le tampon de profondeur.
const RADIUS = TILE * 0.42
const HEIGHT = 0.1 // juste au-dessus du sol de la case (le sol est à ~0,07 dans le repère de la case), pour éviter le z-fighting

let shared: { geometry: THREE.CircleGeometry; material: THREE.MeshBasicMaterial } | undefined

function resources() {
  if (shared) return shared
  // Dégradé radial : lumineux au centre, transparent au bord
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255, 232, 170, 0.9)')
  g.addColorStop(0.45, 'rgba(255, 220, 140, 0.35)')
  g.addColorStop(1, 'rgba(255, 210, 120, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  shared = {
    geometry: new THREE.CircleGeometry(RADIUS, 24).rotateX(-Math.PI / 2),
    material: new THREE.MeshBasicMaterial({
      map,
      transparent: true,
      opacity: 0.4, // très léger
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
  }
  return shared
}

export default function GlowDisc() {
  const { geometry, material } = resources()
  return <mesh geometry={geometry} material={material} position-y={HEIGHT} renderOrder={1} castShadow={false} receiveShadow={false} />
}

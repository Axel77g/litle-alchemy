import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { useFrame } from '../debug/livePerf'
import * as THREE from 'three'
import { TILE } from './constants'
import { setProjector } from '../fx/screen'
import { setCellPicker, useUi } from '../ui/uiStore'

const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.04) // dessus des cases (légère variation de hauteur ignorée)

// Dans le Canvas : donne à l'interface la case sous le pointeur, et dessine la case survolée pendant un glisser-déposer
export default function DropPicker() {
  const camera = useThree((s) => s.camera)
  const canvas = useThree((s) => s.gl.domElement)

  useEffect(() => {
    const raycaster = new THREE.Raycaster()
    const hit = new THREE.Vector3()
    setCellPicker((cx, cy, height = 0.04) => {
      const r = canvas.getBoundingClientRect()
      if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return null
      const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      GROUND.constant = -height
      if (!raycaster.ray.intersectPlane(GROUND, hit)) return null
      return { x: Math.round(hit.x / TILE), z: Math.round(hit.z / TILE) }
    })
    // Position à l'écran (px) d'un point au-dessus de la case (x, z) : sert au départ des coquillages volants
    const v = new THREE.Vector3()
    setProjector((x, z, height) => {
      const r = canvas.getBoundingClientRect()
      v.set(x * TILE, height, z * TILE).project(camera)
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height }
    })
    return () => {
      setCellPicker(() => null)
      setProjector(() => null)
    }
  }, [camera, canvas])

  return <CellHighlight />
}

function CellHighlight() {
  const hover = useUi((s) => s.hover)
  const material = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.4, toneMapped: false, depthWrite: false }), [])
  useFrame('DropPicker.highlight', ({ clock }) => {
    material.opacity = 0.3 + Math.sin(clock.elapsedTime * 8) * 0.1
  })
  if (!hover) return null
  material.color.set(hover.action ? '#7dff9a' : '#ff6b6b')
  return (
    <mesh position={[hover.x * TILE, 0.12, hover.z * TILE]} rotation={[-Math.PI / 2, 0, 0]} material={material}>
      <planeGeometry args={[TILE * 0.96, TILE * 0.96]} />
    </mesh>
  )
}

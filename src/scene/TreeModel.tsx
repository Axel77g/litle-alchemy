import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { makeWindMaterials } from './wind'

// Arbre en modèle 3D (public/models/tree.glb) : un seul mesh, une seule texture. Le vent est calculé dans le vertex shader (voir wind.ts) :
// le pied du tronc reste fixe et le feuillage se balance, l'ombre aussi.
const URL = `${import.meta.env.BASE_URL}models/tree.glb`
const HEIGHT = 1.98 // hauteur voulue de l'arbre, en cases

useGLTF.preload(URL)

let shared: ReturnType<typeof build> | undefined
function build(scene: THREE.Group) {
  let mesh: THREE.Mesh | undefined
  scene.traverse((o) => {
    if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh
  })
  const geometry = mesh!.geometry as THREE.BufferGeometry
  const box = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position as THREE.BufferAttribute)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const scale = HEIGHT / size.y // échelle uniforme : le modèle n'est pas déformé
  return {
    geometry,
    ...makeWindMaterials(mesh!.material as THREE.Material, box.min.y, size.y, scale),
    scale,
    offset: new THREE.Vector3(-center.x, -box.min.y, -center.z), // centré sur la case, pied au sol
  }
}

export default function TreeModel() {
  const { scene } = useGLTF(URL)
  const model = useMemo(() => (shared ??= build(scene)), [scene])
  return (
    <group scale={model.scale}>
      <group position={model.offset}>
        <mesh geometry={model.geometry} material={model.material} customDepthMaterial={model.depth} castShadow receiveShadow frustumCulled={false} />
      </group>
    </group>
  )
}

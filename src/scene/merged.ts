// Fusion de géométries : un modèle fait de N boîtes colorées devient UNE géométrie (couleur par sommet) + un matériau partagé.
// Résultat : 1 draw call par objet au lieu de N (le chien en avait 10), dans chaque passe de rendu (principale, ombre, ambiance).
// Les transformations par objet (chute, pop, frénésie...) restent sur le groupe parent : rien à changer côté animation.
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

export type Vec3 = [number, number, number]

export interface Part {
  geometry: THREE.BufferGeometry
  color: string
  matrix: THREE.Matrix4
}

const p = new THREE.Vector3()
const q = new THREE.Quaternion()
const e = new THREE.Euler()
const s = new THREE.Vector3()

// Position + rotation (Euler XYZ, comme les props R3F) + échelle uniforme
export const xf = (pos: Vec3 = [0, 0, 0], rot: Vec3 = [0, 0, 0], scale = 1) =>
  new THREE.Matrix4().compose(p.set(...pos), q.setFromEuler(e.set(...rot)), s.setScalar(scale))

export const boxPart = (pos: Vec3, size: Vec3, color: string, rot?: Vec3): Part => ({ geometry: new THREE.BoxGeometry(...size), color, matrix: xf(pos, rot) })

export const conePart = (pos: Vec3, radius: number, height: number, segments: number, color: string, rot?: Vec3): Part => ({
  geometry: new THREE.ConeGeometry(radius, height, segments),
  color,
  matrix: xf(pos, rot),
})

// Applique la transformation d'un groupe parent (position / rotation / échelle) à des parts
export const within = (parent: THREE.Matrix4, parts: Part[]): Part[] => parts.map((part) => ({ ...part, matrix: parent.clone().multiply(part.matrix) }))

export function merge(parts: Part[]): THREE.BufferGeometry {
  const geometries = parts.map(({ geometry, color, matrix }) => {
    geometry.applyMatrix4(matrix)
    const c = new THREE.Color(color)
    const count = geometry.getAttribute('position').count
    const colors = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) c.toArray(colors, i * 3)
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geometry
  })
  const merged = mergeGeometries(geometries, false)
  geometries.forEach((g) => g.dispose())
  if (!merged) throw new Error('fusion de géométries impossible')
  return merged
}

// Une géométrie fusionnée par variante de modèle, construite à la demande et partagée par tous les exemplaires
const cache = new Map<string, THREE.BufferGeometry>()
export function cached(key: string, build: () => Part[]): THREE.BufferGeometry {
  let geometry = cache.get(key)
  if (!geometry) {
    geometry = merge(build())
    cache.set(key, geometry)
  }
  return geometry
}

// Matériau partagé de tous les modèles fusionnés (la couleur vient des sommets)
export const voxelMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, shadowSide: THREE.DoubleSide })

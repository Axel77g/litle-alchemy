import { useRef, type ComponentType } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import { sky } from './skyCycle'
import { foliageDepthMaterial, foliageMaterial } from './wind'
import { boxPart, cached, conePart, voxelMaterial, within, xf, type Part, type Vec3 } from './merged'

// Modèles 3D. Chaque modèle se dessine autour de (0,0,0) = centre du dessus du bloc de sol.
// Pour ajouter un modèle : crée un composant ici et référence-le dans OBJECTS.

const FLAMES = [
  { size: 0.26, y: 0.2, color: '#ff5500', phase: 0 },
  { size: 0.2, y: 0.3, color: '#ff8a00', phase: 2 },
  { size: 0.13, y: 0.4, color: '#ffd23f', phase: 4 },
]

function Flame({ size, y, color, phase }: (typeof FLAMES)[number]) {
  const ref = useRef<THREE.Mesh>(null!)
  useFrame(({ clock }) => {
    ref.current.scale.y = 1 + Math.sin(clock.elapsedTime * 12 + phase) * 0.25
  })
  return (
    // Émissif + toneMapped={false} -> déclenche le Bloom
    <mesh ref={ref} position={[0, y, 0]} rotation={[0, Math.PI / 4, 0]}>
      <boxGeometry args={[size, size, size]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4} toneMapped={false} />
    </mesh>
  )
}

const LOGS = () => cached('logs', () => [Math.PI / 4, -Math.PI / 4].map((r) => boxPart([0, 0.06, 0], [0.6, 0.12, 0.15], '#5a3a22', [0, r, 0])))

function Campfire() {
  const light = useRef<THREE.PointLight>(null!)
  // Le feu éclaire plus fort quand la nuit tombe : c'est alors la seule source de lumière
  useFrame(() => {
    light.current.intensity = 4 + sky.night * 6
  })
  return (
    <group>
      {/* Deux bûches croisées (fusionnées en un mesh) */}
      <Voxel geometry={LOGS()} />
      {FLAMES.map((f) => (
        <Flame key={f.y} {...f} />
      ))}
      <Sparkles count={15} scale={1.5} size={3} speed={0.5} color="#ffaa00" position={[0, 0.5, 0]} />
      {/* Vraie lumière chaude projetée sur les cases voisines */}
      <pointLight ref={light} color="#ff7700" intensity={6} distance={5} decay={2} position={[0, 0.4, 0]} />
    </group>
  )
}

// Chaque modèle est fusionné en une géométrie (voir merged.ts). Les formes à matériau particulier (émissif, brillant) restent des meshes à part.
function Voxel({ geometry }: { geometry: THREE.BufferGeometry }) {
  return <mesh geometry={geometry} material={voxelMaterial} castShadow receiveShadow />
}

const CANOPY: { size: Vec3; pos: Vec3 }[] = [
  { size: [0.8, 0.4, 0.8], pos: [0, 0.7, 0] },
  { size: [0.58, 0.36, 0.58], pos: [0.06, 1.05, -0.04] },
  { size: [0.34, 0.28, 0.34], pos: [-0.03, 1.33, 0.03] },
]

// Arbre : tronc + feuillage gros en bas, moyen décalé, petit en haut. Un seul mesh, matériau qui bouge dans le vent (wind.ts), avec son ombre
function Tree() {
  const geometry = cached('tree', () => [boxPart([0, 0.3, 0], [0.28, 0.6, 0.28], '#6b4423'), ...CANOPY.map(({ size, pos }) => boxPart(pos, size, '#48a842'))])
  return <mesh geometry={geometry} material={foliageMaterial} customDepthMaterial={foliageDepthMaterial} castShadow receiveShadow />
}

function Rock() {
  const geometry = cached('rock', () => [boxPart([-0.12, 0.13, 0], [0.32, 0.26, 0.3], '#8c8fae'), boxPart([0.18, 0.09, 0.08], [0.22, 0.18, 0.2], '#8c8fae', [0, 0.4, 0.1])])
  return <Voxel geometry={geometry} />
}

// Personnage voxel : corps de fourrure, tête, cheveux. Le chasseur porte une lance.
function Character({ spear = false, tool, hat, shirt = '#e07a2a' }: { spear?: boolean; tool?: 'pick' | 'axe' | 'brush'; hat?: string; shirt?: string }) {
  const geometry = cached(`character:${spear}:${tool}:${hat}:${shirt}`, () => {
    const parts = [
      boxPart([0, 0.19, 0], [0.32, 0.34, 0.22], shirt),
      boxPart([0, 0.53, 0], [0.38, 0.34, 0.34], '#e8c999'),
      boxPart([0.1, 0.5, 0.175], [0.06, 0.06, 0.02], '#2a1c10'),
      boxPart([-0.1, 0.5, 0.175], [0.06, 0.06, 0.02], '#2a1c10'),
    ]
    if (hat) parts.push(boxPart([0, 0.73, -0.01], [0.4, 0.08, 0.4], hat))
    else {
      // cheveux noirs ébouriffés + petit os blanc en travers
      parts.push(
        boxPart([0, 0.73, -0.02], [0.4, 0.1, 0.38], '#1e1510'),
        boxPart([-0.1, 0.81, 0.04], [0.14, 0.1, 0.14], '#1e1510'),
        boxPart([0.11, 0.8, -0.07], [0.12, 0.12, 0.12], '#1e1510'),
        boxPart([0.02, 0.84, -0.12], [0.1, 0.08, 0.1], '#2b1d14'),
        boxPart([0, 0.87, 0.02], [0.34, 0.04, 0.04], '#f6f1e4', [0, 0, 0.15]),
        boxPart([-0.18, 0.89, 0.02], [0.07, 0.07, 0.07], '#f6f1e4'),
        boxPart([0.18, 0.85, 0.02], [0.07, 0.07, 0.07], '#f6f1e4'),
      )
    }
    // taches de tunique
    if (!hat) parts.push(boxPart([-0.07, 0.25, 0.115], [0.08, 0.08, 0.02], '#a65a1e'), boxPart([0.08, 0.13, 0.115], [0.07, 0.07, 0.02], '#7a3d12'), boxPart([0.06, 0.29, 0.115], [0.06, 0.06, 0.02], '#f0b060'))
    if (spear) parts.push(...within(xf([0.24, 0.35, 0], [0, 0, -0.15]), [boxPart([0, 0, 0], [0.04, 0.8, 0.04], '#6b4423'), boxPart([0, 0.45, 0], [0.08, 0.12, 0.05], '#c9ccd6')]))
    if (tool) {
      const handle = [boxPart([0, 0, 0], [0.04, 0.42, 0.04], '#6b4423')]
      if (tool === 'pick') handle.push(boxPart([0, 0.2, 0], [0.3, 0.06, 0.05], '#9aa0b4'))
      if (tool === 'axe') handle.push(boxPart([0.07, 0.17, 0], [0.14, 0.12, 0.05], '#9aa0b4'))
      parts.push(...within(xf([0.22, 0.3, 0.02], [0.3, 0, -0.5]), handle))
    }
    return parts
  })
  return (
    <group>
      <Voxel geometry={geometry} />
      {/* Pinceau : bout émissif, donc à part */}
      {tool === 'brush' && (
        <group position={[0.22, 0.3, 0.02]} rotation={[0.3, 0, -0.5]}>
          <mesh position={[0, 0.23, 0]} castShadow>
            <boxGeometry args={[0.07, 0.1, 0.07]} />
            <meshStandardMaterial color="#e04a8c" emissive="#e04a8c" emissiveIntensity={0.4} />
          </mesh>
        </group>
      )}
    </group>
  )
}

// Fenêtres des cabanes : jaune pâle le jour, elles s'allument (émissif -> bloom) quand la nuit tombe. Matériau partagé, mis à jour par chaque cabane.
const WINDOW_MATERIAL = new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ffaa00', emissiveIntensity: 0, toneMapped: false })

// Cabane voxel : murs beige crème, toit en escalier de 3 marches (couleurs claires pour se détacher de l'herbe), porte sombre, fenêtres allumées la nuit
function Hut({ wall = '#e6ccb2', roof = '#d9534f', size = 1 }: { wall?: string; roof?: string; size?: number }) {
  const geometry = cached(`hut:${wall}:${roof}:${size}`, () =>
    within(xf([0, 0, 0], [0, 0, 0], size), [
      boxPart([0, 0.34, 0], [0.72, 0.68, 0.72], wall),
      boxPart([0, 0.74, 0], [0.84, 0.14, 0.84], roof),
      boxPart([0, 0.87, 0], [0.6, 0.14, 0.6], roof),
      boxPart([0, 1, 0], [0.34, 0.14, 0.34], roof),
      boxPart([0, 0.17, 0.37], [0.2, 0.34, 0.03], '#3b2a1a'),
    ]),
  )
  useFrame(() => {
    WINDOW_MATERIAL.emissiveIntensity = 0.15 + sky.night * 2
  })
  return (
    <group>
      <Voxel geometry={geometry} />
      <group scale={size}>
        {/* petite fenêtre au-dessus de la porte, et une sur le côté */}
        <mesh position={[0.23, 0.46, 0.37]} material={WINDOW_MATERIAL}>
          <boxGeometry args={[0.1, 0.1, 0.03]} />
        </mesh>
        <mesh position={[-0.23, 0.46, 0.37]} material={WINDOW_MATERIAL}>
          <boxGeometry args={[0.1, 0.1, 0.03]} />
        </mesh>
        <mesh position={[0.37, 0.44, 0]} material={WINDOW_MATERIAL}>
          <boxGeometry args={[0.03, 0.12, 0.12]} />
        </mesh>
      </group>
    </group>
  )
}

// Flaque de boue : une galette sombre brillante à ras du sol (à part : matériau brillant), avec deux bulles
const PUDDLE_MATERIAL = new THREE.MeshStandardMaterial({ color: '#5a3b22', roughness: 0.25, metalness: 0.1 })
function Puddle() {
  const bubbles = cached('puddle-bubbles', () => [boxPart([0.1, 0.075, 0.06], [0.1, 0.03, 0.1], '#7a5230'), boxPart([-0.12, 0.075, -0.08], [0.07, 0.03, 0.07], '#7a5230')])
  return (
    <group>
      <mesh position={[0, 0.03, 0]} receiveShadow material={PUDDLE_MATERIAL}>
        <cylinderGeometry args={[0.38, 0.4, 0.06, 14]} />
      </mesh>
      <Voxel geometry={bubbles} />
    </group>
  )
}

// Chien préhistorique : corps, tête, oreilles, queue, 4 pattes
function Dog() {
  const geometry = cached('dog', () => {
    const c = '#c28b4a'
    return within(xf([0, 0, 0], [0, 0, 0], 1.1), [
      boxPart([0, 0.22, 0], [0.44, 0.2, 0.2], c),
      boxPart([0.27, 0.34, 0], [0.2, 0.2, 0.2], c),
      boxPart([0.37, 0.3, 0], [0.08, 0.08, 0.1], '#3b2a1a'),
      boxPart([0.26, 0.47, 0.07], [0.06, 0.1, 0.05], '#8a5a2a'),
      boxPart([0.26, 0.47, -0.07], [0.06, 0.1, 0.05], '#8a5a2a'),
      boxPart([-0.26, 0.32, 0], [0.12, 0.05, 0.05], c),
      boxPart([0.14, 0.07, 0.07], [0.07, 0.14, 0.07], '#8a5a2a'),
      boxPart([0.14, 0.07, -0.07], [0.07, 0.14, 0.07], '#8a5a2a'),
      boxPart([-0.14, 0.07, 0.07], [0.07, 0.14, 0.07], '#8a5a2a'),
      boxPart([-0.14, 0.07, -0.07], [0.07, 0.14, 0.07], '#8a5a2a'),
    ])
  })
  return <Voxel geometry={geometry} />
}

// Mammouth : gros corps laineux, tête, trompe, défenses
function Mammoth() {
  const geometry = cached('mammoth', () => {
    const fur = '#6b4a32'
    return within(xf([0, 0, 0], [0, 0, 0], 0.78), [
      boxPart([0, 0.5, 0], [0.8, 0.52, 0.56], fur),
      boxPart([0, 0.78, 0], [0.7, 0.1, 0.5], '#4f3523'),
      boxPart([0.5, 0.58, 0], [0.4, 0.42, 0.42], fur),
      boxPart([0.74, 0.38, 0], [0.1, 0.34, 0.1], '#7a5a42'),
      boxPart([0.68, 0.36, 0.17], [0.22, 0.05, 0.05], '#f1e7cf'),
      boxPart([0.68, 0.36, -0.17], [0.22, 0.05, 0.05], '#f1e7cf'),
      boxPart([0.35, 0.12, 0.17], [0.16, 0.24, 0.16], '#4f3523'),
      boxPart([0.35, 0.12, -0.17], [0.16, 0.24, 0.16], '#4f3523'),
      boxPart([-0.35, 0.12, 0.17], [0.16, 0.24, 0.16], '#4f3523'),
      boxPart([-0.35, 0.12, -0.17], [0.16, 0.24, 0.16], '#4f3523'),
      boxPart([-0.42, 0.42, 0], [0.08, 0.2, 0.06], '#4f3523'),
    ])
  })
  return <Voxel geometry={geometry} />
}

// Fournaise : bloc de pierre, bouche rougeoyante (émissive -> bloom, donc à part), cheminée
function Furnace() {
  const geometry = cached('furnace', () => [boxPart([0, 0.27, 0], [0.62, 0.54, 0.6], '#8a8d96'), boxPart([0.18, 0.66, -0.12], [0.16, 0.3, 0.16], '#6b6e7a')])
  return (
    <group>
      <Voxel geometry={geometry} />
      <mesh position={[0, 0.2, 0.31]}>
        <boxGeometry args={[0.28, 0.24, 0.03]} />
        <meshStandardMaterial color="#ff5500" emissive="#ff6600" emissiveIntensity={3.5} toneMapped={false} />
      </mesh>
    </group>
  )
}

// Petits modèles pour les icônes des cartes de matières (jamais posés sur l'île) : voir ui/IconStudio.tsx
const V = (key: string, parts: Part[]) => () => <Voxel geometry={cached(key, () => parts)} />
const flame = (c: string, size: number, y: number) => (
  <mesh position={[0, y, 0]} rotation={[0, Math.PI / 4, 0]}>
    <boxGeometry args={[size, size, size]} />
    <meshStandardMaterial color={c} emissive={c} emissiveIntensity={2} toneMapped={false} />
  </mesh>
)

const ICON_MODELS: Record<string, ComponentType> = {
  stone: V('i-stone', [boxPart([-0.1, 0.12, 0], [0.4, 0.24, 0.36], '#8c8fae', [0, 0.4, 0]), boxPart([0.2, 0.09, 0.12], [0.26, 0.18, 0.24], '#a3a6c4', [0, 0.2, 0]), boxPart([0.05, 0.3, -0.05], [0.2, 0.14, 0.2], '#9a9dba', [0, 0.7, 0])]),
  stick: V('i-stick', [boxPart([0, 0.07, 0], [0.8, 0.12, 0.12], '#8a5a2a', [0, 0.3, 0]), boxPart([0, 0.07, 0.2], [0.8, 0.12, 0.12], '#a8743f', [0, -0.1, 0]), boxPart([0, 0.19, 0.1], [0.8, 0.12, 0.12], '#7a4d22', [0, 0.1, 0])]),
  mud: V('i-mud', [boxPart([0, 0.1, 0], [0.5, 0.2, 0.5], '#6b4423'), boxPart([0.25, 0.07, 0.15], [0.28, 0.14, 0.28], '#7a5230'), boxPart([-0.2, 0.06, -0.2], [0.24, 0.12, 0.24], '#5a3b22'), boxPart([0, 0.26, 0], [0.26, 0.14, 0.26], '#8a5e38')]),
  wall: V('i-wall', [boxPart([0, 0.12, 0], [0.8, 0.24, 0.4], '#d8b98a'), boxPart([0, 0.36, 0], [0.8, 0.24, 0.4], '#e6ccb2'), boxPart([0.2, 0.6, 0], [0.4, 0.24, 0.4], '#c9a870')]),
  brick: V('i-brick', [boxPart([0, 0.1, 0.18], [0.7, 0.2, 0.32], '#d9534f'), boxPart([0, 0.3, 0.1], [0.7, 0.2, 0.32], '#e8685a'), boxPart([0.1, 0.5, 0.02], [0.7, 0.2, 0.32], '#c9433f')]),
  flint_tool: V('i-flint', [boxPart([0, 0.38, 0], [0.26, 0.5, 0.08], '#b8bccb', [0, 0, -0.4]), boxPart([0.16, 0.7, 0], [0.12, 0.14, 0.08], '#e4e7f2', [0, 0, -0.4]), boxPart([-0.18, 0.12, 0], [0.1, 0.4, 0.1], '#8a5a2a', [0, 0, -0.4])]),
  spark: () => (
    <group>
      {flame('#ffd23f', 0.3, 0.3)}
      {flame('#fff2a8', 0.16, 0.34)}
      <Voxel geometry={cached('i-spark', () => [boxPart([-0.25, 0.1, 0], [0.4, 0.2, 0.3], '#8c8fae', [0, 0.4, 0]), boxPart([0.25, 0.08, 0], [0.34, 0.16, 0.3], '#a3a6c4', [0, 0.2, 0])])} />
    </group>
  ),
  raw_meat: V('i-meat', [boxPart([0, 0.15, 0], [0.62, 0.3, 0.42], '#d9546a'), boxPart([0.1, 0.34, 0], [0.34, 0.1, 0.3], '#f08a98'), boxPart([-0.42, 0.18, 0], [0.22, 0.12, 0.12], '#f1e7cf'), boxPart([-0.56, 0.18, 0.07], [0.1, 0.1, 0.1], '#f1e7cf'), boxPart([-0.56, 0.18, -0.07], [0.1, 0.1, 0.1], '#f1e7cf')]),
  grilled_steak: V('i-steak', [boxPart([0, 0.15, 0], [0.62, 0.3, 0.42], '#8a4a26'), boxPart([0.1, 0.34, 0], [0.34, 0.1, 0.3], '#a8602e'), boxPart([-0.42, 0.18, 0], [0.22, 0.12, 0.12], '#f1e7cf'), boxPart([-0.56, 0.18, 0.07], [0.1, 0.1, 0.1], '#f1e7cf'), boxPart([-0.56, 0.18, -0.07], [0.1, 0.1, 0.1], '#f1e7cf'), boxPart([0, 0.4, 0.1], [0.5, 0.03, 0.05], '#3a1e10')]),
  heat: () => (
    <group>
      {flame('#ff5500', 0.5, 0.25)}
      {flame('#ff8a00', 0.36, 0.45)}
      {flame('#ffd23f', 0.2, 0.6)}
    </group>
  ),
  wolf: V('i-wolf', [boxPart([0, 0.3, 0], [0.7, 0.3, 0.3], '#8a8d96'), boxPart([0.42, 0.45, 0], [0.3, 0.3, 0.3], '#a3a6b0'), boxPart([0.62, 0.4, 0], [0.16, 0.12, 0.14], '#2a2a30'), boxPart([0.42, 0.66, 0.1], [0.08, 0.12, 0.06], '#6b6e7a'), boxPart([0.42, 0.66, -0.1], [0.08, 0.12, 0.06], '#6b6e7a'), boxPart([-0.45, 0.4, 0], [0.3, 0.1, 0.1], '#6b6e7a'), boxPart([0.2, 0.08, 0.1], [0.1, 0.16, 0.1], '#6b6e7a'), boxPart([0.2, 0.08, -0.1], [0.1, 0.16, 0.1], '#6b6e7a'), boxPart([-0.2, 0.08, 0.1], [0.1, 0.16, 0.1], '#6b6e7a'), boxPart([-0.2, 0.08, -0.1], [0.1, 0.16, 0.1], '#6b6e7a')]),
  weird_stone: () => (
    <mesh position={[0, 0.35, 0]} rotation={[0.6, 0.5, 0.3]} castShadow>
      <boxGeometry args={[0.45, 0.45, 0.45]} />
      <meshStandardMaterial color="#5ee0ff" emissive="#2bb8ff" emissiveIntensity={1.2} roughness={0.2} toneMapped={false} />
    </mesh>
  ),
  bronze_age: V('i-urn', [boxPart([0, 0.08, 0], [0.34, 0.16, 0.34], '#8a5a2a'), boxPart([0, 0.34, 0], [0.56, 0.36, 0.56], '#c9843a'), boxPart([0, 0.6, 0], [0.4, 0.16, 0.4], '#d99a4a'), boxPart([0, 0.74, 0], [0.5, 0.1, 0.5], '#b5702e'), boxPart([0.36, 0.4, 0], [0.12, 0.22, 0.08], '#8a5a2a'), boxPart([-0.36, 0.4, 0], [0.12, 0.22, 0.08], '#8a5a2a')]),
}

export const OBJECTS: Record<string, ComponentType> = {
  ...ICON_MODELS,
  hut: Hut,
  campfire: Campfire,
  tree: Tree,
  rock: Rock,
  caveman: () => <Character />,
  hunter: () => <Character spear />,
  miner: () => <Character tool="pick" hat="#8c8fae" shirt="#6b6e7a" />,
  lumberjack: () => <Character tool="axe" hat="#b5382a" shirt="#4a7c3a" />,
  painter: () => <Character tool="brush" hat="#e04a8c" shirt="#e0b84a" />,
  tribal_hut: () => <Hut wall="#c3c6d0" roof="#e8a838" size={1.12} />,
  puddle: Puddle,
  dog: Dog,
  mammoth: Mammoth,
  furnace: Furnace,
}

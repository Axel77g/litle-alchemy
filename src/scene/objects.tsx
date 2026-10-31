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
function Character({ spear = false, tool, hat, shirt = '#e07a2a' }: { spear?: boolean; tool?: 'pick' | 'axe' | 'brush' | 'staff'; hat?: string; shirt?: string }) {
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
      if (tool === 'staff') handle.push(boxPart([0, 0.25, 0], [0.09, 0.09, 0.09], '#7be0d0'))
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

// Intérieur des huttes : sombre le jour (on le devine entre les bâtons), il s'embrase (émissif -> bloom) quand la nuit tombe.
// Matériau partagé, mis à jour par chaque hutte.
const HUT_INTERIOR = new THREE.MeshStandardMaterial({ color: '#241509', emissive: '#ff9a1f', emissiveIntensity: 0, toneMapped: false })

const STICK_COLORS = ['#8a5a2a', '#a8743f', '#7a4d22'] // les mêmes bruns que la carte Bâton

// Hutte de bâtons : des perches en cercle, appuyées les unes contre les autres et ficelées en haut (un tipi). Il manque une perche
// devant pour l'entrée, et l'intérieur sombre se voit entre les bâtons.
function Hut({ sticks = STICK_COLORS, collar = '#5a7a3a', size = 1, count = 12 }: { sticks?: string[]; collar?: string; size?: number; count?: number }) {
  const geometry = cached(`hut:${sticks.join()}:${collar}:${size}:${count}`, () => {
    const R = 0.42 // rayon du cercle de bâtons au sol
    const H = 1 // hauteur où les bâtons se rejoignent
    const over = 0.14 // les bâtons dépassent un peu au-dessus de la ficelle
    const tilt = Math.atan2(R, H) // inclinaison vers le centre
    const length = Math.hypot(R, H) + over
    const door = Math.round(count * 0.75) // la perche à a = 3π/2 est celle de devant (+z)
    const parts: Part[] = []
    for (let i = 0; i < count; i++) {
      if (i === door) continue
      const lean = tilt + ((i % 3) - 1) * 0.025 // un peu de désordre : les bâtons ne sont pas tirés au cordeau
      // le milieu du bâton, dans un plan où il est sur l'axe +x ; on le tourne ensuite autour de la hutte
      const mid: Vec3 = [R / 2 - (over / 2) * Math.sin(tilt), H / 2 + (over / 2) * Math.cos(tilt), 0]
      parts.push(...within(xf([0, 0, 0], [0, (i / count) * Math.PI * 2, 0]), [boxPart(mid, [0.07, length, 0.07], sticks[i % sticks.length], [0, 0, lean])]))
    }
    parts.push(boxPart([0, 0.78, 0], [0.3, 0.06, 0.3], collar)) // la ficelle qui les tient
    return within(xf([0, 0, 0], [0, 0, 0], size), parts)
  })
  useFrame(() => {
    HUT_INTERIOR.emissiveIntensity = sky.night * 2
  })
  return (
    <group>
      <Voxel geometry={geometry} />
      <group scale={size}>
        <mesh position={[0, 0.15, 0]} material={HUT_INTERIOR}>
          <boxGeometry args={[0.34, 0.3, 0.34]} />
        </mesh>
        <mesh position={[0, 0.44, 0]} material={HUT_INTERIOR}>
          <boxGeometry args={[0.18, 0.28, 0.18]} />
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

// Roue voxel dans le plan XY (l'essieu est l'axe Z) : moyeu, 4 rayons, jante en octogone
const wheelParts = (cx: number, cy: number, cz: number, r: number, thick: number): Part[] => {
  const parts: Part[] = [boxPart([cx, cy, cz], [r * 0.5, r * 0.5, thick * 1.3], '#6b4423')]
  for (let k = 0; k < 4; k++) parts.push(boxPart([cx, cy, cz], [r * 2 - thick, thick * 0.8, thick * 0.8], '#7a4d22', [0, 0, (k * Math.PI) / 4]))
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4
    parts.push(boxPart([cx + Math.cos(a) * r, cy + Math.sin(a) * r, cz], [2 * r * Math.tan(Math.PI / 8) + thick * 0.6, thick, thick * 1.2], '#9a6b3a', [0, 0, a + Math.PI / 2]))
  }
  return parts
}

// Champ : terre labourée, quatre rangs de blé (vert puis doré)
function Field() {
  const geometry = cached('field', () => {
    const parts: Part[] = [boxPart([0, 0.03, 0], [0.86, 0.06, 0.86], '#6b4423')]
    for (const z of [-0.29, -0.1, 0.1, 0.29]) {
      parts.push(boxPart([0, 0.065, z], [0.8, 0.03, 0.05], '#4f3220')) // sillon
      for (const x of [-0.3, -0.1, 0.1, 0.3]) {
        const ripe = (x + z) % 0.4 > 0.1
        parts.push(boxPart([x, 0.2, z], [0.05, 0.28, 0.05], ripe ? '#c9a83a' : '#8fb83a'), boxPart([x, 0.37, z], [0.09, 0.14, 0.09], ripe ? '#e8c64a' : '#a8d048'))
      }
    }
    return parts
  })
  return <Voxel geometry={geometry} />
}

// Mouton : corps laineux, tête et pattes sombres, face à +x comme le chien
function Sheep() {
  const geometry = cached('sheep', () => {
    const wool = '#f4f1ea'
    const dark = '#3b3b3b'
    return within(xf([0, 0, 0], [0, 0, 0], 1.1), [
      boxPart([0, 0.3, 0], [0.5, 0.32, 0.34], wool),
      boxPart([0.05, 0.46, 0], [0.38, 0.1, 0.28], '#ffffff'),
      boxPart([-0.08, 0.34, 0.2], [0.2, 0.2, 0.06], '#e8e4da'),
      boxPart([-0.08, 0.34, -0.2], [0.2, 0.2, 0.06], '#e8e4da'),
      boxPart([0.3, 0.36, 0], [0.18, 0.2, 0.18], dark),
      boxPart([0.3, 0.5, 0.11], [0.05, 0.08, 0.05], dark),
      boxPart([0.3, 0.5, -0.11], [0.05, 0.08, 0.05], dark),
      boxPart([0.15, 0.08, 0.1], [0.07, 0.16, 0.07], dark),
      boxPart([0.15, 0.08, -0.1], [0.07, 0.16, 0.07], dark),
      boxPart([-0.15, 0.08, 0.1], [0.07, 0.16, 0.07], dark),
      boxPart([-0.15, 0.08, -0.1], [0.07, 0.16, 0.07], dark),
    ])
  })
  return <Voxel geometry={geometry} />
}

// Vache : corps pie, tête claire avec cornes et museau rose, pis, queue ; face à +x comme le mouton et le chien
function Cow() {
  const geometry = cached('cow', () => {
    const hide = '#f1ece0'
    const patch = '#4a3322'
    return within(xf([0, 0, 0], [0, 0, 0], 1.12), [
      boxPart([0, 0.34, 0], [0.62, 0.34, 0.36], hide),
      boxPart([-0.1, 0.4, 0.19], [0.2, 0.2, 0.03], patch),
      boxPart([0.14, 0.44, -0.19], [0.22, 0.18, 0.03], patch),
      boxPart([0.04, 0.53, 0.04], [0.24, 0.04, 0.2], patch),
      boxPart([0.37, 0.4, 0], [0.22, 0.24, 0.24], hide),
      boxPart([0.5, 0.34, 0], [0.08, 0.12, 0.2], '#e8a0a0'),
      boxPart([0.37, 0.56, 0.13], [0.05, 0.1, 0.05], '#f6e7c0', [0.4, 0, 0]),
      boxPart([0.37, 0.56, -0.13], [0.05, 0.1, 0.05], '#f6e7c0', [-0.4, 0, 0]),
      boxPart([0.38, 0.46, 0.14], [0.05, 0.05, 0.08], patch),
      boxPart([0.38, 0.46, -0.14], [0.05, 0.05, 0.08], patch),
      boxPart([-0.08, 0.16, 0], [0.14, 0.06, 0.16], '#e8a0a0'),
      boxPart([-0.34, 0.4, 0], [0.06, 0.26, 0.06], '#3b2a1a', [0, 0, 0.15]),
      boxPart([0.2, 0.09, 0.12], [0.08, 0.18, 0.08], patch),
      boxPart([0.2, 0.09, -0.12], [0.08, 0.18, 0.08], patch),
      boxPart([-0.2, 0.09, 0.12], [0.08, 0.18, 0.08], hide),
      boxPart([-0.2, 0.09, -0.12], [0.08, 0.18, 0.08], hide),
    ])
  })
  return <Voxel geometry={geometry} />
}

// Tambour : fût de bois cerclé, peau tendue dessus, deux baguettes posées devant
function Drum() {
  const geometry = cached('drum', () => [
    boxPart([0, 0.22, 0], [0.52, 0.44, 0.52], '#a8743f', [0, Math.PI / 4, 0]),
    boxPart([0, 0.22, 0], [0.4, 0.44, 0.4], '#a8743f'),
    boxPart([0, 0.46, 0], [0.5, 0.05, 0.5], '#e8d3a0', [0, Math.PI / 4, 0]),
    boxPart([0, 0.46, 0], [0.38, 0.05, 0.38], '#e8d3a0'),
    boxPart([0, 0.12, 0], [0.56, 0.05, 0.56], '#6b4423', [0, Math.PI / 4, 0]),
    boxPart([0, 0.34, 0], [0.56, 0.05, 0.56], '#6b4423', [0, Math.PI / 4, 0]),
    boxPart([0.2, 0.025, 0.36], [0.3, 0.04, 0.04], '#8a5a2a', [0, 0.5, 0]),
    boxPart([-0.1, 0.025, 0.38], [0.3, 0.04, 0.04], '#8a5a2a', [0, -0.3, 0]),
  ])
  return <Voxel geometry={geometry} />
}

// Grenier : cabane de paille sur pilotis (contre l'humidité et les rats), toit en pyramide
function Granary() {
  const geometry = cached('granary', () => {
    const parts: Part[] = [boxPart([0, 0.27, 0], [0.74, 0.06, 0.74], '#8a5a2a'), boxPart([0, 0.52, 0], [0.62, 0.44, 0.62], '#c9a86a'), boxPart([0, 0.46, 0.32], [0.18, 0.22, 0.03], '#3b2a1a'), conePart([0, 0.97, 0], 0.55, 0.46, 4, '#8a6a2a', [0, Math.PI / 4, 0])]
    for (const x of [-0.28, 0.28]) for (const z of [-0.28, 0.28]) parts.push(boxPart([x, 0.12, z], [0.08, 0.24, 0.08], '#6b4423'))
    for (const y of [0.4, 0.62]) parts.push(boxPart([0, y, 0], [0.64, 0.025, 0.64], '#a8864a')) // lattes de la paille
    return parts
  })
  return <Voxel geometry={geometry} />
}

// Charrette : plateau de bois, deux roues, timon, chargée de pierres et de sacs
function Cart() {
  const geometry = cached('cart', () => within(xf([0, 0, 0], [0, 0, 0], 1.05), [
    boxPart([0, 0.3, 0], [0.8, 0.08, 0.46], '#a8743f'),
    boxPart([0, 0.4, 0.23], [0.8, 0.12, 0.04], '#8a5a2a'),
    boxPart([0, 0.4, -0.23], [0.8, 0.12, 0.04], '#8a5a2a'),
    boxPart([0.62, 0.28, 0], [0.55, 0.05, 0.05], '#6b4423', [0, 0, 0.12]),
    boxPart([-0.12, 0.44, 0], [0.3, 0.2, 0.3], '#9a9db0', [0, 0.4, 0]),
    boxPart([0.2, 0.42, 0.04], [0.24, 0.16, 0.26], '#d9b27a'),
    ...wheelParts(0, 0.2, 0.29, 0.2, 0.06),
    ...wheelParts(0, 0.2, -0.29, 0.2, 0.06),
  ]))
  return <Voxel geometry={geometry} />
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
  water: V('i-water', [boxPart([0, 0.15, 0], [0.5, 0.3, 0.5], '#3f94e8'), boxPart([0, 0.4, 0], [0.38, 0.2, 0.38], '#5aaaf5'), boxPart([0, 0.58, 0], [0.24, 0.16, 0.24], '#7cc0ff'), boxPart([0, 0.7, 0], [0.12, 0.1, 0.12], '#b6dcff'), boxPart([-0.1, 0.32, 0.22], [0.08, 0.16, 0.04], '#d6ecff')]),
  seed: V('i-seed', [boxPart([0, 0.3, 0], [0.06, 0.5, 0.06], '#5a9a3a'), boxPart([0.12, 0.5, 0], [0.22, 0.06, 0.1], '#7ac04a', [0, 0, 0.5]), boxPart([-0.12, 0.42, 0], [0.22, 0.06, 0.1], '#7ac04a', [0, 0, -0.5]), boxPart([-0.15, 0.04, 0.05], [0.14, 0.08, 0.1], '#c9a46a'), boxPart([0.05, 0.04, 0.12], [0.14, 0.08, 0.1], '#b58a50'), boxPart([0.16, 0.04, -0.08], [0.14, 0.08, 0.1], '#c9a46a')]),
  log: V('i-log', [boxPart([0, 0.16, 0], [0.8, 0.3, 0.3], '#8a5a2a'), boxPart([0.41, 0.16, 0], [0.04, 0.26, 0.26], '#d9b27a'), boxPart([-0.41, 0.16, 0], [0.04, 0.26, 0.26], '#d9b27a'), boxPart([0, 0.32, 0], [0.7, 0.04, 0.12], '#a8743f'), boxPart([0.1, 0.06, 0.16], [0.3, 0.06, 0.02], '#6b4423')]),
  ochre: V('i-ochre', [boxPart([-0.1, 0.12, 0], [0.4, 0.24, 0.36], '#c4552e', [0, 0.4, 0]), boxPart([0.2, 0.09, 0.12], [0.26, 0.18, 0.24], '#d9703c', [0, 0.2, 0]), boxPart([0.05, 0.3, -0.05], [0.2, 0.14, 0.2], '#a8431f', [0, 0.7, 0])]),
  clay: V('i-clay', [boxPart([0, 0.13, 0], [0.62, 0.26, 0.5], '#c9743a', [0, 0.3, 0]), boxPart([0.12, 0.32, 0], [0.38, 0.16, 0.34], '#d98a4a', [0, 0.6, 0]), boxPart([-0.22, 0.08, 0.2], [0.22, 0.16, 0.22], '#b5602e'), boxPart([0.04, 0.42, -0.02], [0.2, 0.08, 0.18], '#e29a5a')]),
  pot: V('i-pot', [boxPart([0, 0.06, 0], [0.32, 0.12, 0.32], '#a8602e'), boxPart([0, 0.24, 0], [0.5, 0.24, 0.5], '#c0703a'), boxPart([0, 0.44, 0], [0.6, 0.18, 0.6], '#cf7e44'), boxPart([0, 0.6, 0], [0.4, 0.14, 0.4], '#b5602e'), boxPart([0, 0.7, 0], [0.5, 0.06, 0.5], '#d98c52'), boxPart([0, 0.45, 0.31], [0.4, 0.04, 0.02], '#7a3d12')]),
  wheat: V('i-wheat', [-0.17, 0, 0.17].flatMap((x, i) => [boxPart([x, 0.3 + i * 0.03, 0], [0.04, 0.6 + i * 0.06, 0.04], '#c9a83a', [0, 0, -x * 0.5]), boxPart([x * 1.15, 0.68 + i * 0.07, 0], [0.11, 0.24, 0.11], '#e8c64a', [0, 0, -x * 0.5])])),
  flour: V('i-flour', [boxPart([0, 0.22, 0], [0.62, 0.44, 0.42], '#f0e6d0'), boxPart([0, 0.5, 0], [0.3, 0.12, 0.24], '#e0d2b4'), boxPart([0, 0.38, 0], [0.64, 0.05, 0.44], '#8a6a3a'), boxPart([0.1, 0.18, 0.22], [0.26, 0.12, 0.02], '#cfc2a2')]),
  dough: V('i-dough', [boxPart([0, 0.15, 0], [0.64, 0.3, 0.52], '#e3b866'), boxPart([0.06, 0.34, 0], [0.42, 0.16, 0.36], '#eccb85'), boxPart([-0.2, 0.08, 0.2], [0.2, 0.16, 0.2], '#d4a553'), boxPart([0.24, 0.1, -0.2], [0.18, 0.2, 0.18], '#d4a553')]),
  bread: V('i-bread', [boxPart([0, 0.17, 0], [0.74, 0.34, 0.44], '#c98a3c'), boxPart([0, 0.38, 0], [0.6, 0.12, 0.36], '#dba04a'), boxPart([-0.16, 0.45, 0], [0.05, 0.03, 0.3], '#a8692a', [0, 0.5, 0]), boxPart([0.02, 0.45, 0], [0.05, 0.03, 0.3], '#a8692a', [0, 0.5, 0]), boxPart([0.2, 0.45, 0], [0.05, 0.03, 0.3], '#a8692a', [0, 0.5, 0])]),
  wool: V('i-wool', [boxPart([0, 0.2, 0], [0.5, 0.36, 0.48], '#fbf6ea', [0, 0.3, 0]), boxPart([0.22, 0.34, 0.1], [0.3, 0.3, 0.3], '#fffdf6', [0, 0.7, 0]), boxPart([-0.2, 0.32, -0.1], [0.3, 0.28, 0.3], '#f0e8d4', [0, 0.2, 0]), boxPart([0, 0.54, 0], [0.32, 0.22, 0.32], '#fffdf6', [0, 0.5, 0]), boxPart([-0.1, 0.62, 0.12], [0.18, 0.16, 0.18], '#f6efdc'), boxPart([0.18, 0.14, -0.22], [0.2, 0.2, 0.2], '#f0e8d4', [0, 0.4, 0])]),
  cloth: V('i-cloth', [boxPart([0, 0.07, 0], [0.74, 0.14, 0.52], '#e0b84a'), boxPart([0, 0.2, 0], [0.74, 0.12, 0.52], '#c24a3a'), boxPart([0, 0.32, 0], [0.74, 0.12, 0.52], '#e0b84a'), boxPart([0.02, 0.44, 0], [0.74, 0.12, 0.52], '#c24a3a'), boxPart([0.38, 0.26, 0], [0.04, 0.4, 0.5], '#8a2f24')]),
  milk: V('i-milk', [boxPart([0, 0.24, 0], [0.4, 0.48, 0.4], '#f7f7f2'), boxPart([0, 0.52, 0], [0.28, 0.1, 0.28], '#e8e8e0'), boxPart([0, 0.6, 0], [0.34, 0.06, 0.34], '#d9d2c0'), boxPart([0, 0.3, 0.21], [0.3, 0.16, 0.02], '#5aaaf5'), boxPart([0.22, 0.34, 0], [0.1, 0.22, 0.06], '#e8e8e0')]),
  leather: V('i-leather', [boxPart([0, 0.07, 0], [0.74, 0.14, 0.56], '#8a5a2a'), boxPart([0.04, 0.2, 0], [0.7, 0.12, 0.52], '#a8743f'), boxPart([-0.04, 0.32, 0], [0.7, 0.12, 0.5], '#8a5a2a'), boxPart([0.36, 0.2, 0.18], [0.1, 0.1, 0.14], '#6b4423'), boxPart([-0.34, 0.06, -0.24], [0.12, 0.1, 0.12], '#6b4423')]),
  wheel: V('i-wheel', within(xf([0, 0, 0], [0, 0.6, 0]), wheelParts(0, 0.5, 0, 0.38, 0.1))),
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
  tribal_hut: () => <Hut sticks={['#6b4423', '#7a4d22', '#5a3a22']} collar="#e8a838" size={1.15} count={16} />,
  puddle: Puddle,
  dog: Dog,
  mammoth: Mammoth,
  field: Field,
  sheep: Sheep,
  cow: Cow,
  drum: Drum,
  granary: Granary,
  cart: Cart,
  shaman: () => <Character hat="#6b3fa0" shirt="#e8dcc0" tool="staff" />,
}

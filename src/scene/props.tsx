import type { ComponentType } from 'react'
import { boxPart, cached, conePart, voxelMaterial, within, xf, type Part, type Vec3 } from './merged'

// Modèles 3D des items qui ne se posent pas sur l'île (matières, catalyseurs) : ils n'existent que pour le studio de capture
// (studio/Studio.tsx), qui en tire les icônes des cartes. Même style voxel que objects.tsx, posés sur y = 0.
// Pour ajouter un modèle : crée un composant ici et référence-le dans PROPS avec l'id de l'item.

function Voxel({ parts, name }: { parts: () => Part[]; name: string }) {
  return <mesh geometry={cached(`prop:${name}`, parts)} material={voxelMaterial} />
}

// Petit cube émissif (étincelles, flammes) : ne reçoit pas de lumière, donc brille aussi sans bloom
function Glow({ pos, size, color, rot }: { pos: Vec3; size: number; color: string; rot?: Vec3 }) {
  return (
    <mesh position={pos} rotation={rot}>
      <boxGeometry args={[size, size, size]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} />
    </mesh>
  )
}

const stone = () => [
  boxPart([0, 0.13, 0], [0.42, 0.26, 0.36], '#9a9db8', [0, 0.35, 0]),
  boxPart([0.22, 0.08, 0.14], [0.24, 0.16, 0.22], '#8c8fae', [0, -0.3, 0]),
  boxPart([-0.2, 0.07, 0.14], [0.2, 0.14, 0.2], '#a9acc4', [0, 0.6, 0]),
  boxPart([-0.02, 0.28, 0.01], [0.2, 0.06, 0.18], '#b7bad0', [0, 0.35, 0]), // reflet sur le dessus
]

// Fagot de trois bâtons liés par une corde, bouts clairs
const stick = () => {
  const log = (y: number, z: number, color: string, rotY: number): Part[] =>
    within(xf([0, y, z], [0, rotY, 0]), [boxPart([0, 0, 0], [0.74, 0.13, 0.13], color), boxPart([0.375, 0, 0], [0.02, 0.1, 0.1], '#d8b47c'), boxPart([-0.375, 0, 0], [0.02, 0.1, 0.1], '#d8b47c')])
  return [
    ...log(0.065, -0.075, '#8a5a30', 0.04),
    ...log(0.065, 0.075, '#6b4423', -0.05),
    ...log(0.185, 0, '#a06a3a', 0.02),
    boxPart([0, 0.125, 0], [0.07, 0.3, 0.3], '#e6d3a0'), // la corde
  ]
}

const wall = () => {
  const parts: Part[] = []
  const rows = [
    { y: 0.1, x: [-0.28, 0, 0.28], w: 0.27 },
    { y: 0.3, x: [-0.14, 0.14], w: 0.27 },
    { y: 0.5, x: [-0.28, 0, 0.28], w: 0.27 },
  ]
  rows.forEach((row, r) =>
    row.x.forEach((x, i) => parts.push(boxPart([x, row.y, 0], [row.w, 0.18, 0.34], (r + i) % 2 ? '#b0b3c4' : '#9a9db0'))),
  )
  return parts
}

// Outil en silex : manche, lame de pierre taillée en losange, ligature. Incliné comme posé contre quelque chose
const flintTool = () =>
  within(xf([0, 0.05, 0], [0, 0, -0.45]), [
    boxPart([0, 0.32, 0], [0.08, 0.62, 0.08], '#6b4423'),
    boxPart([0, 0.68, 0], [0.22, 0.22, 0.06], '#4b4f63', [0, 0, Math.PI / 4]),
    boxPart([0, 0.68, 0], [0.12, 0.12, 0.08], '#6c7191', [0, 0, Math.PI / 4]),
    boxPart([0, 0.5, 0], [0.11, 0.07, 0.11], '#e6d3a0'),
  ])

function Spark() {
  return (
    <group position={[0, 0, 0]}>
      <Glow pos={[0, 0.36, 0]} size={0.3} color="#ffd23f" rot={[0.6, 0.78, 0]} />
      <Glow pos={[0, 0.36, 0]} size={0.16} color="#fff6c8" rot={[0.6, 0.78, 0]} />
      <Glow pos={[0.3, 0.55, 0.05]} size={0.1} color="#ff9d1f" rot={[0.3, 0.5, 0.2]} />
      <Glow pos={[-0.28, 0.5, -0.06]} size={0.12} color="#ffb52e" rot={[0.2, 0.9, 0.4]} />
      <Glow pos={[0.08, 0.78, -0.1]} size={0.08} color="#ffe27a" rot={[0.5, 0.2, 0.3]} />
      <Glow pos={[-0.16, 0.18, 0.28]} size={0.08} color="#ff8a00" rot={[0.4, 0.7, 0.1]} />
      <Voxel name="spark-stones" parts={() => [boxPart([-0.04, 0.05, 0.02], [0.5, 0.1, 0.4], '#8c8fae', [0, 0.4, 0]), boxPart([0.16, 0.13, 0.05], [0.2, 0.1, 0.18], '#a9acc4', [0, -0.2, 0])]} />
    </group>
  )
}

// Steak sur l'os : `cooked` change les couleurs et ajoute les stries du gril
const steak = (cooked: boolean) => {
  const meat = cooked ? '#9a5128' : '#d8454f'
  const edge = cooked ? '#6e3a1c' : '#f4b6b0'
  const parts: Part[] = [
    boxPart([0.05, 0.12, 0], [0.5, 0.2, 0.4], meat, [0, 0.2, 0]),
    boxPart([0.05, 0.215, 0], [0.4, 0.03, 0.3], edge, [0, 0.2, 0]),
    boxPart([-0.34, 0.12, -0.06], [0.28, 0.09, 0.09], '#f1e7cf', [0, 0.2, 0]),
    boxPart([-0.5, 0.12, -0.1], [0.1, 0.13, 0.13], '#f1e7cf', [0, 0.2, 0]),
  ]
  if (cooked) for (const dz of [-0.1, 0, 0.1]) parts.push(boxPart([0.05, 0.226, dz], [0.38, 0.02, 0.035], '#3d1d0c', [0, 0.2, 0]))
  return parts
}

const mud = () => [
  boxPart([0, 0.07, 0], [0.62, 0.14, 0.55], '#5a3b22', [0, 0.3, 0]),
  boxPart([0.02, 0.19, 0], [0.42, 0.12, 0.38], '#6b4528', [0, -0.2, 0]),
  boxPart([0, 0.3, 0.02], [0.22, 0.1, 0.2], '#7a5230', [0, 0.5, 0]),
  boxPart([0.3, 0.04, 0.22], [0.14, 0.08, 0.14], '#6b4528', [0, 0.4, 0]),
]

const brick = () => {
  const b = (pos: Vec3, rotY: number, color: string): Part[] => within(xf(pos, [0, rotY, 0]), [boxPart([0, 0, 0], [0.56, 0.2, 0.28], color), boxPart([0, 0.105, 0], [0.46, 0.015, 0.2], '#d97a5a')])
  return [...b([0, 0.1, -0.17], 0, '#c0553a'), ...b([0.04, 0.1, 0.17], 0, '#b04a32'), ...b([0, 0.3, 0], 0.1, '#cf6244')]
}

const wolf = () => {
  const fur = '#8b8f9c'
  const dark = '#5b5f6c'
  return within(xf([0, 0, 0], [0, 0, 0], 1.15), [
    boxPart([0, 0.26, 0], [0.5, 0.22, 0.24], fur),
    boxPart([0.02, 0.2, 0], [0.4, 0.14, 0.2], '#c9ccd6'), // ventre clair
    boxPart([0.32, 0.4, 0], [0.22, 0.22, 0.22], fur),
    boxPart([0.46, 0.35, 0], [0.12, 0.09, 0.12], dark), // museau
    boxPart([0.52, 0.37, 0], [0.04, 0.04, 0.05], '#1a1a22'), // truffe
    boxPart([0.3, 0.55, 0.08], [0.06, 0.13, 0.06], dark),
    boxPart([0.3, 0.55, -0.08], [0.06, 0.13, 0.06], dark),
    boxPart([0.41, 0.43, 0.115], [0.03, 0.04, 0.02], '#ffd23f'), // yeux
    boxPart([0.41, 0.43, -0.115], [0.03, 0.04, 0.02], '#ffd23f'),
    boxPart([-0.34, 0.34, 0], [0.26, 0.1, 0.1], dark, [0, 0, 0.5]), // queue touffue
    boxPart([0.17, 0.08, 0.08], [0.08, 0.16, 0.08], dark),
    boxPart([0.17, 0.08, -0.08], [0.08, 0.16, 0.08], dark),
    boxPart([-0.17, 0.08, 0.08], [0.08, 0.16, 0.08], dark),
    boxPart([-0.17, 0.08, -0.08], [0.08, 0.16, 0.08], dark),
  ])
}

// Caillou bizarre : cristal violet (cœur en boîte, pointes en pyramides) entouré d'éclats
const weirdStone = () => {
  const spike = (x: number, z: number, h: number, c: string): Part[] => [
    boxPart([x, h / 2, z], [0.14, h, 0.14], c, [0, Math.PI / 4, 0]),
    conePart([x, h + 0.07, z], 0.1, 0.16, 4, '#c9a8ff', [0, Math.PI / 4, 0]),
  ]
  return [
    boxPart([0, 0.3, 0], [0.3, 0.42, 0.3], '#8e5cf0', [0, Math.PI / 4, 0]),
    conePart([0, 0.62, 0], 0.21, 0.28, 4, '#b890ff', [0, Math.PI / 4, 0]),
    conePart([0, 0.07, 0], 0.21, 0.14, 4, '#6a3fc7', [Math.PI, Math.PI / 4, 0]),
    ...spike(0.26, 0.1, 0.2, '#7a4be0'),
    ...spike(-0.24, -0.1, 0.28, '#9b6bff'),
    ...spike(0.08, -0.26, 0.14, '#7a4be0'),
  ]
}

// Amphore de l'Âge du Bronze : ventre en terre cuite, bandes de bronze, deux anses
const amphora = () => [
  boxPart([0, 0.05, 0], [0.26, 0.1, 0.26], '#a6602e'),
  boxPart([0, 0.26, 0], [0.5, 0.34, 0.5], '#c8793a'),
  boxPart([0, 0.26, 0], [0.52, 0.07, 0.52], '#cd8a3a'),
  boxPart([0, 0.4, 0], [0.52, 0.05, 0.52], '#7a3f1d'),
  boxPart([0, 0.55, 0], [0.3, 0.2, 0.3], '#c8793a'),
  boxPart([0, 0.68, 0], [0.38, 0.07, 0.38], '#cd8a3a'),
  boxPart([0.3, 0.55, 0], [0.1, 0.22, 0.1], '#a6602e'),
  boxPart([-0.3, 0.55, 0], [0.1, 0.22, 0.1], '#a6602e'),
]

// Chaleur : trois flammes émissives empilées sur un lit de braises
function Heat() {
  return (
    <group>
      <Voxel name="heat-embers" parts={() => [boxPart([0, 0.04, 0], [0.55, 0.08, 0.5], '#3a2a22', [0, 0.4, 0]), boxPart([0.16, 0.1, 0.1], [0.14, 0.06, 0.14], '#ff5500', [0, 0.2, 0]), boxPart([-0.18, 0.1, -0.08], [0.12, 0.06, 0.12], '#ff7a1a')]} />
      <Glow pos={[0, 0.25, 0]} size={0.4} color="#ff5500" rot={[0, Math.PI / 4, 0]} />
      <Glow pos={[0.02, 0.5, 0]} size={0.3} color="#ff8a00" rot={[0, Math.PI / 4 + 0.3, 0]} />
      <Glow pos={[0, 0.72, 0]} size={0.18} color="#ffd23f" rot={[0, Math.PI / 4, 0]} />
    </group>
  )
}

export const PROPS: Record<string, ComponentType> = {
  stone: () => <Voxel name="stone" parts={stone} />,
  stick: () => <Voxel name="stick" parts={stick} />,
  wall: () => <Voxel name="wall" parts={wall} />,
  flint_tool: () => <Voxel name="flint_tool" parts={flintTool} />,
  spark: Spark,
  raw_meat: () => <Voxel name="raw_meat" parts={() => steak(false)} />,
  grilled_steak: () => <Voxel name="grilled_steak" parts={() => steak(true)} />,
  mud: () => <Voxel name="mud" parts={mud} />,
  brick: () => <Voxel name="brick" parts={brick} />,
  wolf: () => <Voxel name="wolf" parts={wolf} />,
  weird_stone: () => <Voxel name="weird_stone" parts={weirdStone} />,
  bronze_age: () => <Voxel name="bronze_age" parts={amphora} />,
  heat: Heat,
}

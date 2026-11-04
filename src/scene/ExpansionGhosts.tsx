import { useMemo, useRef } from 'react'
import { useFrame } from '../instrument'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { expansionCandidates, type Coord } from '../engine/expansion'
import type { World } from '../engine/types'
import { useGame } from '../store/game'
import { haptic } from '../shared/haptics'
import { formatNumber } from '../shared/format'
import { selectGhost, useUi } from '../interaction/uiStore'
import { TILE } from './constants'
import { GRASS_HEIGHT, grassGeometry } from './geometry'

const GHOST = new THREE.MeshStandardMaterial({ color: '#8a93b8', roughness: 0.9, transparent: true, opacity: 0.28, depthWrite: false })
const GHOST_SELECTED = new THREE.MeshStandardMaterial({ color: '#7dffd2', roughness: 0.6, transparent: true, opacity: 0.55, depthWrite: false })
const PLUS = new THREE.MeshStandardMaterial({ color: '#47f3bb', emissive: '#47f3bb', emissiveIntensity: 1.6, toneMapped: false })

// Cases achetables autour de l'île : une dalle fantôme avec un « + » qui flotte. Un appui la sélectionne et affiche son prix.
export default function ExpansionGhosts({ world }: { world: World }) {
  const candidates = useMemo(() => expansionCandidates(world), [world])
  const selected = useUi((s) => s.selectedGhost)
  const editMode = useUi((s) => s.editMode)
  if (!editMode) return null // les cases achetables n'apparaissent qu'en mode édition
  return (
    <>
      {candidates.map((c) => (
        <Ghost key={`${c.x},${c.z}`} coord={c} selected={selected?.x === c.x && selected?.z === c.z} />
      ))}
    </>
  )
}

function Ghost({ coord, selected }: { coord: Coord; selected: boolean }) {
  const plus = useRef<THREE.Group>(null!)
  const phase = (coord.x * 1.7 + coord.z * 2.3) % (Math.PI * 2)
  useFrame('Ghost.pulse', ({ clock }) => {
    const t = clock.elapsedTime * 2.2 + phase
    plus.current.position.y = 0.32 + Math.sin(t) * 0.05 + (selected ? 0.12 : 0)
    plus.current.rotation.y = t * 0.5
    plus.current.scale.setScalar(selected ? 1.25 : 1)
  })

  return (
    <group position={[coord.x * TILE, selected ? 0.08 : -0.12, coord.z * TILE]}>
      <mesh
        geometry={grassGeometry}
        material={selected ? GHOST_SELECTED : GHOST}
        position={[0, -GRASS_HEIGHT / 2, 0]}
        onClick={(e) => {
          e.stopPropagation()
          haptic(12)
          selectGhost(coord)
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      />
      <group ref={plus}>
        <mesh material={PLUS} raycast={() => null}>
          <boxGeometry args={[0.34, 0.08, 0.08]} />
        </mesh>
        <mesh material={PLUS} raycast={() => null}>
          <boxGeometry args={[0.08, 0.08, 0.34]} />
        </mesh>
      </group>
      {selected && (
        <Html center position={[0, 1.0, 0]} zIndexRange={[20, 0]}>
          <BuyChip coord={coord} />
        </Html>
      )}
    </group>
  )
}

// Bulle de prix : « 🐚 25 · ACHETER ». Grisée avec le manque si on n'a pas assez de coquillages.
function BuyChip({ coord }: { coord: Coord }) {
  const shells = useGame((s) => s.shells)
  const price = useGame((s) => s.cellPrice())
  const buy = useGame((s) => s.buyCell)
  const can = shells >= price
  return (
    <button
      onClick={() => {
        if (buy(coord.x, coord.z)) {
          haptic(30)
          selectGhost(null)
        } else haptic(6)
      }}
      className={[
        'flex animate-pop items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 font-display text-label-chunky-lg shadow-chunk-lg transition-all active:translate-y-1 active:shadow-chunk-press',
        can ? 'bg-primary-container text-on-primary shadow-[0_5px_0_#00573f]' : 'bg-surface-container-high text-on-surface-variant',
      ].join(' ')}
    >
      <span>🐚 {formatNumber(price)}</span>
      <span className="text-[12px] uppercase">{can ? 'Acheter' : `Il manque ${formatNumber(price - shells)}`}</span>
    </button>
  )
}

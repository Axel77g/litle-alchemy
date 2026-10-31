import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TILE_DROP_HEIGHT, TILE_DROP_TIME, forgetTileDrop, hasImpacts, hasTileDrops, tileDropStart, triggerImpact, waveOffset } from '../fx/effects'
import { TILE } from './constants'
import { DIRT_HEIGHT, GRASS_HEIGHT, dirtGeometry, grassGeometry } from './geometry'
import type { World as WorldMap } from '../engine/types'

// Le sol de l'île : toutes les cases d'herbe dans UN InstancedMesh, toute la terre dans un autre.
// Deux draw calls quelle que soit la taille de l'île (avant : 2 meshes + 1 matériau par case, multipliés par chaque passe de rendu).
// La couleur de chaque case passe par instanceColor : les matériaux sont blancs et se teintent par instance.

const GRASS = new THREE.Color('#5ab552')
const LOCKED = new THREE.Color('#6b6a78') // case achetable, grisée
const DIRT = new THREE.Color('#6e472b')
const LOCKED_DIRT = new THREE.Color('#4a4955')

const TUFT = new THREE.Color('#7be068')
const PEBBLE = new THREE.Color('#9a9aa6')
const tuftGeometry = new THREE.BoxGeometry(1, 1, 1)
const tuftMaterial = new THREE.MeshStandardMaterial({ roughness: 0.9 })

const grassMaterial = new THREE.MeshStandardMaterial({ roughness: 0.8 })
const dirtMaterial = new THREE.MeshStandardMaterial({ roughness: 0.9 })

// Pseudo-aléatoire stable par case (0..1) : le monde ne change pas à chaque rendu
export const rand = (x: number, z: number, seed: number) => {
  const n = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453
  return n - Math.floor(n)
}

// Petite variation de hauteur pour donner vie à l'île
export const tileLift = (x: number, z: number) => rand(x, z, 1) * 0.08

// Hauteur du dessus de l'herbe de la case (x, z) à cet instant : relief + onde qui passe + chute si la case vient d'être achetée.
// Fonction pure : le sol et les objets posés dessus la lisent chacun pour rester collés ensemble.
export function tileHeight(x: number, z: number, now = performance.now()): number {
  let y = tileLift(x, z) + waveOffset(x, z, now)
  if (hasTileDrops()) {
    const bornAt = tileDropStart(x, z)
    if (bornAt !== undefined) {
      const t = (now - bornAt) / 1000
      if (t < TILE_DROP_TIME) y += TILE_DROP_HEIGHT * (1 - (t / TILE_DROP_TIME) ** 2)
    }
  }
  return y
}

// `world` : Map "x,z" -> cellule (voir engine/grid.ts)
const UP = new THREE.Vector3(0, 1, 0)

export default function Ground({ world }: { world: WorldMap }) {
  const cells = useMemo(() => [...world.values()].filter((c) => c.terrain !== 'VOID'), [world])
  const grass = useRef<THREE.InstancedMesh>(null!)
  const dirt = useRef<THREE.InstancedMesh>(null!)
  const tufts = useRef<THREE.InstancedMesh>(null!)
  const settled = useRef(false) // les instances sont à leur place de repos : inutile de recalculer tant qu'aucune animation ne tourne
  // Brins d'herbe et cailloux : 2 ou 3 petits cubes par case débloquée, position/taille/teinte stables (rand) -> le sol a du grain
  const bits = useMemo(() => {
    const list: { cell: number; ox: number; oz: number; w: number; h: number; rot: number; pebble: boolean }[] = []
    cells.forEach((c, cell) => {
      if (!c.unlocked) return
      const n = 2 + Math.floor(rand(c.x, c.z, 10) * 2)
      for (let k = 0; k < n; k++) {
        const pebble = rand(c.x, c.z, 20 + k) < 0.18
        list.push({
          cell,
          ox: (rand(c.x, c.z, 30 + k) - 0.5) * TILE * 0.8,
          oz: (rand(c.x, c.z, 40 + k) - 0.5) * TILE * 0.8,
          w: pebble ? 0.1 + rand(c.x, c.z, 50 + k) * 0.05 : 0.07 + rand(c.x, c.z, 50 + k) * 0.03,
          h: pebble ? 0.07 : 0.1 + rand(c.x, c.z, 60 + k) * 0.08,
          rot: rand(c.x, c.z, 70 + k) * Math.PI,
          pebble,
        })
      }
    })
    return list
  }, [cells])
  const matrix = useMemo(() => new THREE.Matrix4(), [])
  const color = useMemo(() => new THREE.Color(), [])
  const { position, quat, scale } = useMemo(() => ({ position: new THREE.Vector3(), quat: new THREE.Quaternion(), scale: new THREE.Vector3() }), [])

  const writeMatrices = () => {
    const now = performance.now()
    cells.forEach((c, i) => {
      const y = tileHeight(c.x, c.z, now)
      // la terre ne suit pas le relief de l'herbe (on retire `lift`), mais suit l'onde
      matrix.makeTranslation(c.x * TILE, y - GRASS_HEIGHT / 2, c.z * TILE)
      grass.current.setMatrixAt(i, matrix)
      matrix.makeTranslation(c.x * TILE, y - 0.15 - DIRT_HEIGHT / 2 - tileLift(c.x, c.z), c.z * TILE)
      dirt.current.setMatrixAt(i, matrix)
    })
    grass.current.instanceMatrix.needsUpdate = true
    dirt.current.instanceMatrix.needsUpdate = true
    bits.forEach((b, i) => {
      const c = cells[b.cell]
      matrix.compose(
        position.set(c.x * TILE + b.ox, tileHeight(c.x, c.z, now) + b.h / 2 - 0.01, c.z * TILE + b.oz),
        quat.setFromAxisAngle(UP, b.rot),
        scale.set(b.w, b.h, b.w),
      )
      tufts.current.setMatrixAt(i, matrix)
    })
    tufts.current.instanceMatrix.needsUpdate = true
  }

  // Couleurs : teinte légèrement différente par case, grisée si la case est encore à acheter
  useLayoutEffect(() => {
    cells.forEach((c, i) => {
      color.copy(GRASS).offsetHSL((rand(c.x, c.z, 2) - 0.5) * 0.03, 0, (rand(c.x, c.z, 3) - 0.5) * 0.06)
      grass.current.setColorAt(i, c.unlocked ? color : color.lerp(LOCKED, 0.9))
      dirt.current.setColorAt(i, c.unlocked ? DIRT : LOCKED_DIRT)
    })
    bits.forEach((b, i) => tufts.current.setColorAt(i, b.pebble ? PEBBLE : color.copy(TUFT).offsetHSL(0, 0, (rand(i, b.cell, 80) - 0.5) * 0.1)))
    grass.current.instanceColor!.needsUpdate = true
    dirt.current.instanceColor!.needsUpdate = true
    if (tufts.current.instanceColor) tufts.current.instanceColor.needsUpdate = true
    writeMatrices()
    settled.current = true
  }, [cells, bits]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    const active = hasImpacts() || hasTileDrops()
    if (!active && settled.current) return
    // Case achetée qui vient de toucher terre : son atterrissage fait une onde dans l'île
    if (hasTileDrops()) {
      const now = performance.now()
      for (const c of cells) {
        const bornAt = tileDropStart(c.x, c.z)
        if (bornAt !== undefined && (now - bornAt) / 1000 >= TILE_DROP_TIME) {
          forgetTileDrop(c.x, c.z)
          triggerImpact(c.x, c.z, 2.5)
        }
      }
    }
    writeMatrices()
    settled.current = !active
  })

  // key : un InstancedMesh a une capacité fixe, on le recrée quand l'île change de taille.
  // frustumCulled={false} : sa sphère englobante ne tiendrait pas compte de la chute des cases (8 unités au-dessus).
  return (
    <group>
      <instancedMesh key={`grass-${cells.length}`} ref={grass} args={[grassGeometry, grassMaterial, cells.length]} receiveShadow frustumCulled={false} />
      <instancedMesh key={`tufts-${bits.length}`} ref={tufts} args={[tuftGeometry, tuftMaterial, bits.length]} castShadow receiveShadow frustumCulled={false} />
      <instancedMesh key={`dirt-${cells.length}`} ref={dirt} args={[dirtGeometry, dirtMaterial, cells.length]} receiveShadow frustumCulled={false} />
    </group>
  )
}

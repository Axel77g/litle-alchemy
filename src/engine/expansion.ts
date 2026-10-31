// Agrandissement de l'île : on achète, avec des coquillages, une case voisine d'une case existante.
// Le prix augmente à chaque case achetée : baseCost × growth^(cases achetées).
import { getCell, placeEntity, unlockCell } from './grid'
import { AREAS, type Ruleset } from './items'
import type { ItemId, World } from './types'

export interface ExpansionRules {
  baseCost: number // prix de la première case
  growth: number // multiplicateur de prix à chaque achat (1.12 = +12 %)
  startCells: number // nombre de cases de l'île de départ (sert à compter les achats)
  spawnChance: number // chance (0..1) qu'un producteur apparaisse sur la case achetée
  spawnItems: ItemId[] // producteurs possibles (tirés au hasard)
}

export interface Coord {
  x: number
  z: number
}

// Cases achetables : vides, et touchant (en croix) une case débloquée. Calculées à la demande, pas stockées dans le monde.
export function expansionCandidates(world: World): Coord[] {
  const seen = new Set<string>()
  const out: Coord[] = []
  for (const cell of world.values()) {
    if (!cell.unlocked || cell.terrain === 'VOID') continue
    for (const [dx, dz] of AREAS.cross) {
      const x = cell.x + dx
      const z = cell.z + dz
      const key = `${x},${z}`
      if (seen.has(key) || getCell(world, x, z)) continue
      seen.add(key)
      out.push({ x, z })
    }
  }
  return out
}

export const cellsBought = (rules: ExpansionRules, world: World) => Math.max(0, world.size - rules.startCells)

export const expansionCost = (rules: ExpansionRules, world: World): number =>
  Math.ceil(rules.baseCost * rules.growth ** cellsBought(rules, world))

export const isCandidate = (world: World, x: number, z: number) => expansionCandidates(world).some((c) => c.x === x && c.z === z)

// Achète la case (x, z). Retourne le nouveau monde et le prix payé, ou undefined si la case n'est pas achetable ou trop chère.
// Avec une faible chance (spawnChance), un producteur (arbre, rocher...) apparaît sur la nouvelle case.
// `rng` est injectable pour tester (Math.random par défaut).
export function buyCell(rules: Ruleset, exp: ExpansionRules, world: World, shells: number, x: number, z: number, rng: () => number = Math.random) {
  const cost = expansionCost(exp, world)
  if (shells < cost || !isCandidate(world, x, z)) return undefined
  let next = unlockCell(rules, world, x, z)
  let spawned: ItemId | undefined
  if (exp.spawnItems.length && rng() < exp.spawnChance) {
    spawned = exp.spawnItems[Math.floor(rng() * exp.spawnItems.length)]
    next = placeEntity(rules, next, x, z, spawned)
  }
  return { world: next, cost, spawned }
}

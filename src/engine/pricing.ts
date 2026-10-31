// Prix de pose des producteurs : cost × COST_GROWTH^(exemplaires déjà sur l'île). Fusionner, améliorer (Silex sur un villageois) et déplacer restent gratuits.
import { findRecipe, type Ruleset } from './items'
import type { ItemId, World } from './types'

export const COST_GROWTH = 1.15

export function placementCost(rules: Ruleset, world: World, itemId: ItemId): number {
  const def = rules.items[itemId]
  if (!def?.cost) return 0
  const tag = def.costTag
  let n = 0
  for (const cell of world.values()) {
    const e = cell.entity
    if (e && (tag ? rules.items[e.itemId]?.tags?.includes(tag) : e.itemId === itemId)) n++
  }
  return Math.ceil(def.cost * COST_GROWTH ** n)
}

// Prix d'une amélioration : déposer `itemId` (Silex, Pierre, Bâton, Ocre...) sur le producteur de la case (x, z) peut en créer un autre (Cro-Magnon -> Chasseur),
// et ce producteur se paie comme s'il était posé. 0 si la case n'est pas concernée (ou pour une frénésie).
export function useCost(rules: Ruleset, world: World, x: number, z: number, itemId: ItemId): number {
  const entity = world.get(`${x},${z}`)?.entity
  if (!entity || rules.items[itemId]?.frenzy) return 0
  const result = findRecipe(rules, entity.itemId, itemId)
  return result && rules.items[result].kind === 'producer' ? placementCost(rules, world, result) : 0
}

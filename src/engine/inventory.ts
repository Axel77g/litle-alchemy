// Inventaire du dock : piles d'items. Fonctions pures (retournent un nouvel inventaire).
import { findCraft, type Ruleset } from './items'
import type { Inventory, ItemId } from './types'

export const countOf = (inv: Inventory, id: ItemId) => inv[id] ?? 0

export const addItems = (inv: Inventory, id: ItemId, n: number): Inventory => ({ ...inv, [id]: countOf(inv, id) + n })

export function takeItems(inv: Inventory, id: ItemId, n = 1): Inventory | undefined {
  if (countOf(inv, id) < n) return undefined
  const next = { ...inv, [id]: countOf(inv, id) - n }
  if (next[id] === 0) delete next[id]
  return next
}

// Combien de fois la fusion a + b peut-elle être faite avec cet inventaire ? (0 si aucune recette ne correspond)
export function maxMerges(rules: Ruleset, inv: Inventory, a: ItemId, b: ItemId): number {
  const recipe = findCraft(rules, inv, a, b)
  if (!recipe) return 0
  const need = new Map<ItemId, number>()
  for (const id of recipe.inputs) need.set(id, (need.get(id) ?? 0) + 1)
  return Math.min(...[...need].map(([id, n]) => Math.floor(countOf(inv, id) / n)))
}

// Fusion dans le dock : consomme les ingrédients de la recette qui correspond à a + b, `times` fois, et crée `times` résultats
export function mergeItems(rules: Ruleset, inv: Inventory, a: ItemId, b: ItemId, times = 1): Inventory | undefined {
  const recipe = findCraft(rules, inv, a, b)
  if (!recipe || times < 1 || times > maxMerges(rules, inv, a, b)) return undefined
  let next: Inventory | undefined = inv
  for (let i = 0; i < times; i++) for (const id of recipe.inputs) next = next && takeItems(next, id)
  return next && addItems(next, recipe.result, times)
}

// --- Capacité du dock ---------------------------------------------------------
export const totalCards = (inv: Inventory) => Object.values(inv).reduce((sum, n) => sum + n, 0)

// Capacité = base + les places données par les producteurs posés (ex : le Chien)
export function dockCapacity(rules: Ruleset, world: Map<string, { entity: { itemId: ItemId } | null }>, base: number): number {
  let cap = base
  for (const cell of world.values()) if (cell.entity) cap += rules.items[cell.entity.itemId]?.dockBonus ?? 0
  return cap
}

// Ajoute des produits dans le dock sans dépasser la capacité. Retourne l'inventaire et ce qui a été perdu.
export function addWithCapacity(inv: Inventory, items: Inventory, capacity: number) {
  let next = inv
  let free = Math.max(0, capacity - totalCards(inv))
  const lost: Inventory = {}
  for (const [id, n] of Object.entries(items)) {
    const kept = Math.min(n, free)
    if (kept > 0) next = addItems(next, id, kept)
    if (n > kept) lost[id] = n - kept
    free -= kept
  }
  return { inventory: next, lost }
}

// --- Vente ------------------------------------------------------------------
export const sellValueOf = (rules: Ruleset, id: ItemId) => rules.items[id]?.sellValue

// Vend n exemplaires : retourne le nouvel inventaire et les coquillages gagnés (undefined si invendable ou stock insuffisant)
export function sellItems(rules: Ruleset, inv: Inventory, id: ItemId, n: number): { inventory: Inventory; shells: number } | undefined {
  const value = sellValueOf(rules, id)
  const next = value && n >= 1 ? takeItems(inv, id, n) : undefined
  return next && value ? { inventory: next, shells: value * n } : undefined
}

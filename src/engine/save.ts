// Sauvegarde : le monde (Map) est converti en tableau JSON. Les modifiers ne sont pas sauvés : ils sont recalculés au chargement.
import type { Ruleset } from './items'
import type { GridCell, Inventory, World } from './types'
import { keyOf, recalculateAuras } from './grid'

const VERSION = 1

export interface SaveData {
  version: number
  worldId: string
  savedAt: number // Date.now() : sert au calcul du gain hors-ligne
  shells: number
  inventory: Inventory
  seen?: Record<string, true> // items déjà obtenus (grimoire)
  hour?: number // heure du jeu
  cells: Omit<GridCell, 'modifiers'>[]
}

export function serialize(worldId: string, data: { world: World; shells: number; inventory: Inventory; seen?: Record<string, true>; hour?: number }): SaveData {
  return {
    version: VERSION,
    worldId,
    savedAt: Date.now(),
    shells: data.shells,
    inventory: data.inventory,
    seen: data.seen,
    hour: data.hour,
    cells: [...data.world.values()].map(({ modifiers: _modifiers, ...cell }) => cell),
  }
}

// Retourne undefined si la sauvegarde est absente, d'une autre version ou d'un autre monde
export function deserialize(rules: Ruleset, worldId: string, raw: unknown) {
  const save = raw as SaveData | null
  if (!save || save.version !== VERSION || save.worldId !== worldId || !Array.isArray(save.cells)) return undefined
  const world: World = new Map()
  for (const cell of save.cells) {
    // un item qui n'existe plus dans les règles est retiré plutôt que de planter
    const entity = cell.entity && rules.items[cell.entity.itemId] ? cell.entity : null
    world.set(keyOf(cell.x, cell.z), { ...cell, entity, modifiers: [] })
  }
  return { world: recalculateAuras(rules, world), shells: save.shells, inventory: save.inventory, savedAt: save.savedAt, seen: save.seen, hour: save.hour }
}

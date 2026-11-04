// État initial d'une partie, en fonctions sans store : utilisées par le chargement, « nouvelle partie » et la simulation d'absence.
import { advanceClock, clock, START_HOUR } from '../engine/clock'
import type { Finale } from '../engine/finale'
import type { ExpansionRules } from '../engine/expansion'
import { createWorld, ensureTerrainSources } from '../engine/grid'
import { addItems, dockCapacity, totalCards } from '../engine/inventory'
import type { Ruleset } from '../engine/items'
import { catchUp, OFFLINE_CAP } from '../engine/offline'
import { advanceTime } from '../engine/production'
import type { Inventory, ItemId, World } from '../engine/types'

// Un monde jouable, tel que content/ le décrit
export interface WorldDef {
  id: string
  name: string
  rules: Ruleset
  ground: number[][]
  objects: (ItemId | null)[][]
  expansion: ExpansionRules
  goals: { item: ItemId; text: string }[]
  finale: Finale
  dockCapacity: number
  startingInventory: Record<ItemId, number>
}

export interface OfflineReport {
  seconds: number
  capped: boolean
  shells: number
  items: Inventory
  doubled?: boolean // le joueur a regardé une pub : le gain a déjà été doublé
}

export interface Progress {
  world: World
  shells: number
  inventory: Inventory
  seen: Record<ItemId, true> // items déjà obtenus un jour (grimoire)
}

// Items déjà vus : ceux de la sauvegarde (s'il y en a une), plus tout ce qu'on possède ou qui est posé (anciennes sauvegardes sans grimoire)
export function collectSeen(saved: Record<ItemId, true> | undefined, inventory: Inventory, world: World) {
  const seen: Record<ItemId, true> = { ...saved }
  for (const id of Object.keys(inventory)) seen[id] = true
  for (const cell of world.values()) if (cell.entity) seen[cell.entity.itemId] = true
  return seen
}

// Partie neuve : l'état de départ du monde (sans événements : les objets de départ apparaissent directement, pas de chute)
export function freshProgress(def: WorldDef): Progress {
  const world = ensureTerrainSources(def.rules, createWorld(def.rules, def.ground, def.objects))
  const inventory = { ...def.startingInventory }
  return { world, shells: 0, inventory, seen: collectSeen(undefined, inventory, world) }
}

export interface SavedProgress extends Partial<Progress> {
  hour?: number
}

// Avance une absence de `elapsed` secondes : production hors-ligne (plafonnée, à rendement réduit), rangée dans le dock dans la limite de sa place.
// Fait aussi avancer l'horloge de jeu. Le monde est modifié en place (compteurs de production).
export function simulateAbsence(def: WorldDef, world: World, inventory: Inventory, elapsed: number) {
  const { real, effective } = catchUp(elapsed)
  const free = Math.max(0, dockCapacity(def.rules, world, def.dockCapacity) - totalCards(inventory))
  const gains = advanceTime(def.rules, world, effective, clock, { free })
  advanceClock(real)
  let next = inventory
  for (const [id, n] of Object.entries(gains.items)) next = addItems(next, id, n)
  const report: OfflineReport = { seconds: real, capped: elapsed > OFFLINE_CAP, shells: gains.shells, items: gains.items }
  return { inventory: next, shells: gains.shells, report }
}

// Reprend une sauvegarde (s'il y en a une) : rattrape l'absence depuis `savedAt`, ou retombe sur une partie neuve
export function restoreProgress(def: WorldDef, saved: (SavedProgress & { world: World; savedAt: number }) | undefined, now: number) {
  if (!saved) return { ...freshProgress(def), report: null as OfflineReport | null }
  const world = ensureTerrainSources(def.rules, saved.world)
  let inventory = saved.inventory ?? { ...def.startingInventory }
  let shells = saved.shells ?? 0
  if (saved.hour !== undefined) clock.hour = saved.hour
  const away = simulateAbsence(def, world, inventory, (now - saved.savedAt) / 1000)
  inventory = away.inventory
  shells += away.shells
  return { world, shells, inventory, seen: collectSeen(saved.seen, inventory, world), report: away.report.seconds > 5 ? away.report : null }
}

export const resetClock = () => void (clock.hour = START_HOUR)

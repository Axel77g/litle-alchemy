// Store global (Zustand) : seule porte d'entrée pour modifier le jeu.
// Les fonctions de engine/ sont pures ; le store applique le résultat et annonce les événements.
import { create } from 'zustand'
import { advanceClock, clock, isNight } from '../engine/clock'
import { diffWorlds, emit } from '../engine/events'
import { buyCell, expansionCost, type ExpansionRules } from '../engine/expansion'
import { createWorld, expandIsland, moveEntity, placeEntity, previewBoardDrop, previewDrop, removeEntity, unlockCell, useOnEntity, type Coord } from '../engine/grid'
import { addItems, dockCapacity, mergeItems, sellItems, takeItems, totalCards } from '../engine/inventory'
import { findCraft, findRecipe, type Ruleset } from '../engine/items'
import { advanceTime } from '../engine/production'
import type { Inventory, ItemId, World } from '../engine/types'
import { world1 } from '../content/world1'
import { loadSave } from './persist'

// Gain hors-ligne plafonné (en secondes)
export const OFFLINE_CAP = 8 * 3600

export interface OfflineReport {
  seconds: number
  capped: boolean
  shells: number
  items: Inventory
}

interface GameState {
  rules: Ruleset // règles du monde courant (items + recettes)
  expansion: ExpansionRules
  worldId: string
  worldName: string
  world: World
  shells: number
  inventory: Inventory
  offlineReport: OfflineReport | null
  seen: Record<ItemId, true> // items déjà obtenus un jour (grimoire)
  goals: { item: ItemId; text: string }[] // objectifs du monde, dans l'ordre
  night: boolean // il fait nuit : les personnages sont rentrés chez eux et produisent plus
  victory: boolean // le monde est terminé

  capacity(): number // nombre de cartes que le dock peut contenir
  sell(itemId: ItemId, n?: number): boolean // vend des cartes du dock contre des coquillages
  pickUp(x: number, z: number): boolean // reprend un producteur de l'île dans le dock
  moveOnBoard(from: Coord, to: Coord): boolean // déplace un producteur de l'île, ou le fusionne avec celui de la case visée
  place(x: number, z: number, itemId: ItemId): void // pose un producteur du dock sur le plateau
  remove(x: number, z: number): void
  unlock(x: number, z: number): void
  expand(): void // debug : gratuit
  buyCell(x: number, z: number): boolean // achat d'une case voisine de l'île (coquillages) ; false si impossible ou trop cher
  cellPrice(): number // prix de la prochaine case
  give(itemId: ItemId, n?: number): void
  merge(a: ItemId, b: ItemId, times?: number): void // fusion dans le dock (times fois : voir ui/MergeSheet)
  use(x: number, z: number, itemId: ItemId): void // item du dock sur un producteur du plateau
  drop(x: number, z: number, itemId: ItemId): boolean // dépôt d'une carte du dock sur une case : pose ou utilisation
  dismissOfflineReport(): void
  tick(now?: number): void // avance la production jusqu'à now (ms)
  advance(seconds: number): void // avance la production de N secondes (tests / debug), sans toucher à l'horloge
}

export const useGame = create<GameState>((set, get) => {
  const { rules, expansion } = world1

  // --- État initial : sauvegarde éventuelle + rattrapage hors-ligne
  const saved = loadSave(rules, world1.id)
  let world = saved?.world ?? createWorld(rules, world1.ground, world1.objects)
  let shells = saved?.shells ?? 0
  let inventory: Inventory = saved?.inventory ?? { ...world1.startingInventory }
  let offlineReport: OfflineReport | null = null
  let lastTick = Date.now()
  if (saved?.hour !== undefined) clock.hour = saved.hour
  if (saved) {
    const elapsed = (lastTick - saved.savedAt) / 1000
    const seconds = Math.min(Math.max(elapsed, 0), OFFLINE_CAP)
    const space = { free: Math.max(0, dockCapacity(rules, world, world1.dockCapacity) - totalCards(inventory)) }
    const gains = advanceTime(rules, world, seconds, clock, space)
    advanceClock(seconds)
    shells += gains.shells
    for (const [id, n] of Object.entries(gains.items)) inventory = addItems(inventory, id, n)
    if (seconds > 5) offlineReport = { seconds, capped: elapsed > OFFLINE_CAP, shells: gains.shells, items: gains.items }
  }
  // Items déjà vus : ceux de la sauvegarde, plus tout ce qu'on possède ou qui est posé (anciennes sauvegardes sans grimoire)
  const seen: Record<ItemId, true> = { ...saved?.seen }
  for (const id of Object.keys(inventory)) seen[id] = true
  for (const cell of world.values()) if (cell.entity) seen[cell.entity.itemId] = true
  const finalGoal = world1.goals[world1.goals.length - 1]?.item

  // Applique un nouveau monde : événements d'abord (les FX se préparent), puis état (React redessine)
  const commit = (next: World, extra: Partial<GameState> = {}) => {
    const before = get().world
    if (next !== before) diffWorlds(before, next).forEach(emit)
    set({ world: next, ...extra })
    track()
  }

  // Grimoire : repère les items jamais obtenus (dans le dock ou posés sur l'île), annonce les découvertes et la victoire
  const track = () => {
    const { inventory, world, seen } = get()
    const found = new Set<ItemId>()
    for (const [id, n] of Object.entries(inventory)) if (n > 0 && !seen[id]) found.add(id)
    for (const cell of world.values()) if (cell.entity && !seen[cell.entity.itemId]) found.add(cell.entity.itemId)
    if (!found.size) return
    const next = { ...seen }
    for (const id of found) next[id] = true
    set({ seen: next })
    for (const id of found) emit({ type: 'discovered', itemId: id })
    if (finalGoal && found.has(finalGoal) && !get().victory) {
      set({ victory: true })
      emit({ type: 'victory' })
    }
  }

  // Fait produire tout le plateau pendant dt secondes et range les gains (coquillages, dock)
  const advance = (dt: number) => {
    if (dt <= 0) return
    const space = { free: Math.max(0, get().capacity() - totalCards(get().inventory)) }
    const { shells, items, produced, blocked } = advanceTime(rules, get().world, dt, clock, space)
    advanceClock(dt)
    const night = isNight(clock.hour)
    if (night !== get().night) set({ night })
    produced.forEach((p) => emit({ type: 'produced', ...p }))
    blocked.forEach((itemId) => emit({ type: 'dockFull', itemId })) // dock plein : cette production est en pause
    if (shells === 0 && Object.keys(items).length === 0) return
    let inventory = get().inventory
    for (const [id, n] of Object.entries(items)) inventory = addItems(inventory, id, n)
    set({ shells: get().shells + shells, inventory })
    track()
  }

  return {
    rules,
    expansion,
    worldId: world1.id,
    worldName: world1.name,
    world,
    shells,
    inventory,
    offlineReport,
    seen,
    goals: world1.goals,
    night: isNight(clock.hour),
    victory: !!finalGoal && !!seen[finalGoal],

    capacity: () => dockCapacity(rules, get().world, world1.dockCapacity),
    sell(itemId, n = 1) {
      const sold = sellItems(rules, get().inventory, itemId, n)
      if (!sold) return false
      set({ shells: get().shells + sold.shells, inventory: sold.inventory })
      emit({ type: 'sold', itemId })
      return true
    },
    pickUp(x, z) {
      const entity = get().world.get(`${x},${z}`)?.entity
      if (!entity || totalCards(get().inventory) >= get().capacity()) return false
      commit(removeEntity(rules, get().world, x, z), { inventory: addItems(get().inventory, entity.itemId, 1) })
      return true
    },
    moveOnBoard(from, to) {
      const world = get().world
      const merging = previewBoardDrop(rules, world, from, to) === 'merge'
      const next = moveEntity(rules, world, from, to)
      if (!next) return false
      commit(next)
      if (merging) emit({ type: 'merged', result: next.get(`${to.x},${to.z}`)!.entity!.itemId })
      return true
    },

    place(x, z, itemId) {
      const rest = takeItems(get().inventory, itemId)
      if (!rest) return
      const next = placeEntity(rules, get().world, x, z, itemId)
      if (next !== get().world) commit(next, { inventory: rest })
    },
    remove: (x, z) => commit(removeEntity(rules, get().world, x, z)),
    unlock: (x, z) => commit(unlockCell(rules, get().world, x, z)),
    expand: () => commit(expandIsland(rules, get().world)),
    buyCell(x, z) {
      const bought = buyCell(rules, expansion, get().world, get().shells, x, z)
      if (!bought) return false
      emit({ type: 'cellBought', x, z })
      commit(bought.world, { shells: get().shells - bought.cost })
      return true
    },
    cellPrice: () => expansionCost(expansion, get().world),
    give(itemId, n = 1) {
      set({ inventory: addItems(get().inventory, itemId, n) })
      track()
    },
    merge(a, b, times = 1) {
      const recipe = findCraft(rules, get().inventory, a, b)
      const inventory = mergeItems(rules, get().inventory, a, b, times)
      if (inventory) {
        set({ inventory })
        track()
        if (recipe) emit({ type: 'merged', result: recipe.result })
      }
    },
    use(x, z, itemId) {
      const rest = takeItems(get().inventory, itemId)
      const next = rest && useOnEntity(rules, get().world, x, z, itemId)
      if (next) {
        commit(next, { inventory: rest })
        // Une vraie fusion (Silex sur Cro-Magnon...), pas un Steak donné pour la frénésie
        const target = get().world.get(`${x},${z}`)?.entity
        if (target && !rules.items[itemId].frenzy) emit({ type: 'merged', result: target.itemId })
      }
    },

    drop(x, z, itemId) {
      const action = previewDrop(rules, get().world, x, z, itemId)
      if (action === 'place') get().place(x, z, itemId)
      else if (action === 'use') get().use(x, z, itemId)
      return action !== undefined
    },
    dismissOfflineReport: () => set({ offlineReport: null }),

    tick(now = Date.now()) {
      const dt = Math.min((now - lastTick) / 1000, OFFLINE_CAP)
      lastTick = now
      advance(dt)
    },
    advance: (seconds) => advance(seconds),
  }
})

// Utilisé par la sauvegarde pour ne dépendre que de l'état utile
export const snapshot = () => {
  const { world, shells, inventory, seen } = useGame.getState()
  return { world, shells, inventory, seen, hour: clock.hour }
}

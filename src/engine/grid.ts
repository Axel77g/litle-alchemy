// Logique du monde : un dictionnaire de cellules indexé par "x,z" (types dans types.ts).
// Pas de tableau -> les coordonnées négatives marchent, l'île peut grandir dans toutes les directions.
// Toutes les fonctions sont pures : elles retournent un nouveau monde sans modifier l'ancien.
import { AREAS, type Ruleset } from './items'
import { findRecipe } from './items'
import type { GridCell, ItemId, PlacedEntity, World } from './types'

export const keyOf = (x: number, z: number) => `${x},${z}`

export const getCell = (world: World, x: number, z: number): GridCell | undefined => world.get(keyOf(x, z))

// crypto.randomUUID n'existe qu'en contexte sécurisé (https / localhost) : pas en http via l'IP du réseau
let nextId = 0
const newId = () => crypto.randomUUID?.() ?? `entity-${Date.now().toString(36)}-${nextId++}`

export const createEntity = (rules: Ruleset, itemId: ItemId, level = 1): PlacedEntity => ({
  id: newId(), // clé stable pour React / animations
  itemId,
  level,
  progress: (rules.items[itemId]?.production ?? []).map(() => 0), // un compteur par production
  frenzyTimer: 0,
  produced: (rules.items[itemId]?.production ?? []).map(() => 0),
})

// Construit le monde depuis les tableaux 2D de content/world1/layout.ts. Le centre des tableaux devient (0, 0).
export function createWorld(rules: Ruleset, ground: number[][], objects: (ItemId | null)[][]): World {
  const world: World = new Map()
  const offsetX = Math.floor(Math.max(...ground.map((r) => r.length)) / 2)
  const offsetZ = Math.floor(ground.length / 2)
  ground.forEach((row, row_z) =>
    row.forEach((cell, col_x) => {
      if (!cell) return
      const x = col_x - offsetX
      const z = row_z - offsetZ
      const itemId = objects[row_z]?.[col_x]
      if (itemId && rules.items[itemId]?.kind !== 'producer') throw new Error(`layout: "${itemId}" ne peut pas être posé sur le plateau`)
      world.set(keyOf(x, z), {
        x,
        z,
        terrain: 'GRASS',
        unlocked: true,
        entity: itemId ? createEntity(rules, itemId) : null,
        modifiers: [],
      })
    }),
  )
  return recalculateAuras(rules, world)
}

// À appeler UNIQUEMENT quand le monde change (pose, déplacement, fusion), jamais à chaque frame.
// Retourne un nouveau Map (les cellules sont copiées) pour que React détecte le changement.
export function recalculateAuras(rules: Ruleset, world: World): World {
  const next: World = new Map()
  for (const [key, cell] of world) next.set(key, { ...cell, modifiers: [] })

  for (const cell of next.values()) {
    const aura = cell.entity && rules.items[cell.entity.itemId]?.aura
    if (!aura) continue
    // zone d'effet : toute l'île, ou les voisins définis par la forme (hors de l'île : pas de test de bornes, la case n'existe pas)
    const targets =
      aura.area === 'global'
        ? [...next.values()]
        : AREAS[aura.area].map(([dx, dz]) => getCell(next, cell.x + dx, cell.z + dz))
    for (const target of targets) {
      if (!target || target.terrain === 'VOID') continue
      if (aura.affectsTag) {
        const targetDef = target.entity && rules.items[target.entity.itemId]
        if (!targetDef?.tags?.includes(aura.affectsTag)) continue
      }
      if (aura.speedMultiplier) {
        target.modifiers.push({ stat: 'speed', op: 'add', value: aura.speedMultiplier, source: cell.entity!.id })
      }
      if (aura.valueMultiplier) {
        target.modifiers.push({ stat: 'value', op: 'add', value: aura.valueMultiplier, source: cell.entity!.id })
      }
    }
  }
  return next
}

// --- Modifications (retournent un nouveau monde avec auras à jour) ---------

const update = (rules: Ruleset, world: World, x: number, z: number, patch: Partial<GridCell>): World => {
  const cell = getCell(world, x, z)
  if (!cell) return world
  const next = new Map(world)
  next.set(keyOf(x, z), { ...cell, ...patch })
  return recalculateAuras(rules, next)
}

// Seuls les items de kind 'producer' (ouvriers, usines, bâtiments) se posent sur le plateau
export const placeEntity = (rules: Ruleset, world: World, x: number, z: number, itemId: ItemId): World => {
  const cell = getCell(world, x, z)
  if (!cell || !cell.unlocked || cell.entity) return world
  if (rules.items[itemId]?.kind !== 'producer') return world
  return update(rules, world, x, z, { entity: createEntity(rules, itemId) })
}

export const removeEntity = (rules: Ruleset, world: World, x: number, z: number): World =>
  update(rules, world, x, z, { entity: null })

// La frénésie ne s'applique qu'aux producteurs ciblés, et pas à un producteur déjà en frénésie (le steak serait gâché)
const canFrenzy = (rules: Ruleset, entity: PlacedEntity, itemId: ItemId) =>
  entity.frenzyTimer <= 0 && !!rules.items[entity.itemId]?.tags?.includes(rules.items[itemId].frenzy!.targetTag)

// Utilise un item du dock sur un producteur du plateau (ex : Silex sur Cro-Magnon -> Chasseur).
// Retourne le nouveau monde, ou undefined si aucune recette ne donne un producteur.
export function useOnEntity(rules: Ruleset, world: World, x: number, z: number, itemId: ItemId): World | undefined {
  const cell = getCell(world, x, z)
  if (!cell?.entity) return undefined
  const frenzy = rules.items[itemId]?.frenzy
  if (frenzy) {
    if (!canFrenzy(rules, cell.entity, itemId)) return undefined
    return update(rules, world, x, z, { entity: { ...cell.entity, frenzyTimer: frenzy.duration } })
  }
  const result = findRecipe(rules, cell.entity.itemId, itemId)
  if (!result || rules.items[result].kind !== 'producer') return undefined
  return update(rules, world, x, z, { entity: createEntity(rules, result, cell.entity.level) })
}

// Que se passerait-il si on déposait cet item du dock sur cette case ? (sert au survol pendant le glisser-déposer)
export type DropAction = 'place' | 'use' | 'move' | 'merge'
export function previewDrop(rules: Ruleset, world: World, x: number, z: number, itemId: ItemId): DropAction | undefined {
  const cell = getCell(world, x, z)
  if (!cell || !cell.unlocked) return undefined
  if (!cell.entity) return rules.items[itemId]?.kind === 'producer' ? 'place' : undefined
  if (rules.items[itemId]?.frenzy) return canFrenzy(rules, cell.entity, itemId) ? 'use' : undefined
  const result = findRecipe(rules, cell.entity.itemId, itemId)
  return result && rules.items[result].kind === 'producer' ? 'use' : undefined
}

// --- Déplacer / fusionner des producteurs déjà posés sur l'île ------------------

export interface Coord {
  x: number
  z: number
}

// Glisser le producteur de `from` sur `to` : le déplace (case libre) ou lance la recette (case occupée : Chasseur + Chasseur = Mammouth)
export function previewBoardDrop(rules: Ruleset, world: World, from: Coord, to: Coord): 'move' | 'merge' | undefined {
  if (from.x === to.x && from.z === to.z) return undefined
  const src = getCell(world, from.x, from.z)
  const dst = getCell(world, to.x, to.z)
  if (!src?.entity || !dst || !dst.unlocked || dst.terrain === 'VOID') return undefined
  if (!dst.entity) return 'move'
  const result = findRecipe(rules, src.entity.itemId, dst.entity.itemId)
  return result && rules.items[result].kind === 'producer' ? 'merge' : undefined
}

export function moveEntity(rules: Ruleset, world: World, from: Coord, to: Coord): World | undefined {
  const action = previewBoardDrop(rules, world, from, to)
  if (!action) return undefined
  const src = getCell(world, from.x, from.z)!
  const dst = getCell(world, to.x, to.z)!
  const next = new Map(world)
  next.set(keyOf(from.x, from.z), { ...src, entity: null })
  if (action === 'move') next.set(keyOf(to.x, to.z), { ...dst, entity: src.entity })
  else {
    const result = findRecipe(rules, src.entity!.itemId, dst.entity!.itemId)!
    next.set(keyOf(to.x, to.z), { ...dst, entity: createEntity(rules, result, Math.max(src.entity!.level, dst.entity!.level)) })
  }
  return recalculateAuras(rules, next)
}

// Agrandit l'île : crée ou débloque une case (x, z peuvent être négatifs)
export function unlockCell(rules: Ruleset, world: World, x: number, z: number): World {
  const next = new Map(world)
  const cell = getCell(world, x, z)
  next.set(keyOf(x, z), {
    x,
    z,
    entity: null,
    modifiers: [],
    ...cell,
    terrain: 'GRASS',
    unlocked: true,
  })
  return recalculateAuras(rules, next)
}

// Agrandit l'île d'une couche : toutes les cases vides voisines (en croix) d'une case existante sont débloquées
export function expandIsland(rules: Ruleset, world: World): World {
  let next = world
  for (const cell of world.values()) {
    if (cell.terrain === 'VOID') continue
    for (const [dx, dz] of AREAS.cross) {
      if (!getCell(next, cell.x + dx, cell.z + dz)) next = unlockCell(rules, next, cell.x + dx, cell.z + dz)
    }
  }
  return next
}

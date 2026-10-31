// Définitions d'items et recettes. Tout est donnée : un nouveau monde = un nouveau jeu de définitions,
// le moteur ne change pas. createRuleset() valide la cohérence des données au démarrage.
import type { Area, ItemId, TerrainType } from './types'

// matière : ingrédient (dock) · producer : ouvrier / usine / bâtiment, posé sur le plateau · catalyst : consommable qui transforme (ex : Chaleur)
export type ItemKind = 'material' | 'producer' | 'catalyst'

// Monnaie : pas un item, elle va directement dans le HUD
export const SHELL = 'shell'

export interface Production {
  output: ItemId | typeof SHELL
  every: number // secondes entre deux productions (avant modifiers)
  amount?: number // quantité produite (1 par défaut)
  limit?: number // nombre total de productions possibles ; ensuite le bâtiment est « épuisé » (ex : une cabane ne fait qu'un bonhomme)
}

export type AreaShape = 'cross' | 'square' | 'global' // global : toutes les cases de l'île

// Aura de productivité : s'applique aux cases voisines (calculée dans recalculateAuras)
export interface Aura {
  area: AreaShape
  speedMultiplier?: number // bonus additif : 0.5 => +50 %
  valueMultiplier?: number // bonus additif sur la valeur des coquillages produits : 0.2 => +20 %
  affectsTag?: string // si défini, seuls les items portant ce tag sont boostés
}

export interface ItemDef {
  id: ItemId
  name: string
  icon: string // emoji / icône 2D pour le dock et le HUD
  kind: ItemKind
  tier: number
  tags?: string[]
  model?: string // clé du modèle 3D (scene/objects.tsx) : obligatoire pour un producer ; sur les autres cartes, sert à rendre l'icône (ui/IconStudio.tsx)
  production?: Production[]
  aura?: Aura
  sellValue?: number // coquillages gagnés en vendant 1 exemplaire (absent = invendable)
  nightMultiplier?: number // multiplicateur de production la nuit (les personnages rentrent chez eux et produisent plus)
  flood?: boolean // posé sur une case d'herbe vide, il la transforme en bloc d'eau (objet consommé)
  // Prix de pose (🐚) du 1er exemplaire ; chaque exemplaire déjà sur l'île le multiplie par COST_GROWTH (voir engine/pricing.ts).
  // costTag : le compte se fait sur tous les items de l'île portant ce tag (les ouvriers comptent ensemble, même une fois devenus Chasseurs).
  cost?: number
  costTag?: string
  noPop?: boolean // pas de petit saut à chaque production (décor et bâtiments : seuls les êtres vivants sautent)
  dockBonus?: number // places de dock en plus tant que ce producteur est sur l'île (ex : le Chien)
  // Frénésie : utilisé sur un producteur portant le tag `targetTag`, il passe en vitesse ×3 pendant `duration` secondes (objet consommé)
  frenzy?: { duration: number; targetTag: string }
}

// Recette : une liste d'ingrédients (avec répétitions, ex : 3 bâtons) qui donne un résultat. L'ordre n'importe pas.
export interface Recipe {
  inputs: ItemId[]
  result: ItemId
}

// Zones d'effet
const CROSS: Area = [
  [0, 1],
  [0, -1],
  [-1, 0],
  [1, 0],
] // Manhattan 1 : les 4 cases adjacentes
const SQUARE: Area = [...CROSS, [-1, -1], [1, -1], [-1, 1], [1, 1]] // Tchebychev 1 : les 8 cases autour
export const AREAS: Record<Exclude<AreaShape, 'global'>, Area> = { cross: CROSS, square: SQUARE }

// Écrit les items sans répéter l'id (la clé de l'objet) et garde les clés typées pour l'autocomplétion
export function defineItems<K extends string>(defs: Record<K, Omit<ItemDef, 'id'>>): Record<K, ItemDef> {
  const out = {} as Record<K, ItemDef>
  for (const id of Object.keys(defs) as K[]) out[id] = { id, ...defs[id] }
  return out
}

export interface Ruleset {
  items: Record<ItemId, ItemDef>
  recipes: Recipe[]
  recipeIndex: Map<string, ItemId> // ingrédients triés "a|b|c" -> résultat
  terrainAuras: Partial<Record<TerrainType, Aura>> // bonus donnés par une case d'un certain terrain à ses voisines (ex : l'eau arrose les champs)
  terrainProduction: Partial<Record<TerrainType, Production[]>> // ce que produit toute case d'un certain terrain (ex : l'eau produit de l'eau)
}

export interface TerrainRules {
  auras?: Ruleset['terrainAuras']
  production?: Ruleset['terrainProduction']
}

const recipeKey = (inputs: ItemId[]) => [...inputs].sort().join('|')

export function createRuleset(items: Record<ItemId, ItemDef>, recipes: Recipe[], terrain: TerrainRules = {}): Ruleset {
  const known = (id: ItemId) => id in items
  const errors: string[] = []

  for (const item of Object.values(items)) {
    if (item.kind === 'producer' && !item.model) errors.push(`${item.id}: un producer doit avoir un model 3D`)
    if (item.sellValue !== undefined && item.sellValue <= 0) errors.push(`${item.id}: sellValue doit être > 0`)
    if (item.kind !== 'producer' && (item.production || item.aura || item.nightMultiplier || item.dockBonus)) errors.push(`${item.id}: seul un producer peut produire ou avoir une aura`)
    if (item.flood && item.kind !== 'material') errors.push(`${item.id}: seule une matière peut inonder une case`)
    for (const p of item.production ?? []) {
      if (p.output !== SHELL && !known(p.output)) errors.push(`${item.id}: produit un item inconnu "${p.output}"`)
      if (p.every <= 0) errors.push(`${item.id}: "every" doit être > 0`)
      if (p.limit !== undefined && p.limit < 1) errors.push(`${item.id}: "limit" doit être >= 1`)
    }
  }

  const recipeIndex = new Map<string, ItemId>()
  for (const r of recipes) {
    const label = `${r.inputs.join(' + ')} -> ${r.result}`
    if (r.inputs.length < 2) errors.push(`recette ${label}: il faut au moins 2 ingrédients`)
    for (const id of [...r.inputs, r.result]) if (!known(id)) errors.push(`recette ${label}: item inconnu "${id}"`)
    const key = recipeKey(r.inputs)
    if (recipeIndex.has(key)) errors.push(`recette en double : ${label}`)
    recipeIndex.set(key, r.result)
  }

  for (const [name, productions] of Object.entries(terrain.production ?? {})) {
    for (const p of productions ?? []) {
      if (p.output !== SHELL && !known(p.output)) errors.push(`terrain ${name}: produit un item inconnu "${p.output}"`)
      if (p.every <= 0) errors.push(`terrain ${name}: "every" doit être > 0`)
      if (p.limit !== undefined) errors.push(`terrain ${name}: "limit" n'est pas géré pour un terrain`)
    }
  }

  if (errors.length) throw new Error(`Données de monde invalides :\n- ${errors.join('\n- ')}`)
  return { items, recipes, recipeIndex, terrainAuras: terrain.auras ?? {}, terrainProduction: terrain.production ?? {} }
}

// Fusion à deux (ex : utiliser un item sur un producteur du plateau) : que donnent a et b ensemble ?
export const findRecipe = (rules: Ruleset, a: ItemId, b: ItemId): ItemId | undefined => rules.recipeIndex.get(recipeKey([a, b]))

const countIn = (list: readonly ItemId[], id: ItemId) => list.reduce((n, x) => n + (x === id ? 1 : 0), 0)

// Fusion dans le dock : quand on lâche la carte a sur la carte b, quelle recette se déclenche ?
// Il faut que a et b fassent partie de ses ingrédients ET que l'inventaire contienne tout (ex : 3 bâtons pour un mur).
// Les recettes les plus courtes passent en premier.
export function findCraft(rules: Ruleset, inventory: Record<ItemId, number>, a: ItemId, b: ItemId): Recipe | undefined {
  return [...rules.recipes]
    .sort((x, y) => x.inputs.length - y.inputs.length)
    .find((r) => {
      if (countIn(r.inputs, a) < 1 || countIn(r.inputs, b) < (a === b ? 2 : 1)) return false
      return [...new Set(r.inputs)].every((id) => (inventory[id] ?? 0) >= countIn(r.inputs, id))
    })
}

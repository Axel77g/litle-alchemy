// Types du moteur. Voir grid.ts pour la logique et items.ts pour les définitions d'items.

// COUCHE 1 : le sol. Ajoute ici 'WATER', 'MUD_PUDDLE', ...
export type TerrainType = 'VOID' | 'GRASS' | 'WATER'

// Identifiant d'un item (ex : 'stone', 'hunter'). Les items sont définis en données, par monde (voir items.ts).
export type ItemId = string

// COUCHE 2 : un objet posé sur une case (seuls les items de kind 'producer' peuvent y être posés)
export interface PlacedEntity {
  id: string // unique : sert de clé stable pour React / les animations
  itemId: ItemId
  level: number
  progress: number[] // secondes "effectives" accumulées, une entrée par production de l'item (voir production.ts)
  frenzyTimer: number // secondes de frénésie restantes (vitesse ×3) ; > 0 si on vient de lui donner un steak
  produced?: number[] // nombre de productions déjà faites, une entrée par production (sert aux productions à `limit`)
}

// Inventaire du dock : piles d'items par id
export type Inventory = Record<ItemId, number>

// COUCHE 3 : bonus reçus par une case, en liste (calculés par recalculateAuras, jamais écrits à la main).
// Valeur finale d'une stat = (1 + Σ add) × Π mul  (voir statMultiplier dans modifiers.ts)
export type Stat = 'speed' | 'value'
export interface Modifier {
  stat: Stat
  op: 'add' | 'mul'
  value: number // add : 0.5 = +50 % · mul : 2 = ×2
  source: string // id de l'entité à l'origine du bonus
}

export interface GridCell {
  x: number
  z: number // l'axe "y" de la grille 2D = l'axe Z en 3D
  terrain: TerrainType
  unlocked: boolean // false = case achetable, affichée grisée
  entity: PlacedEntity | null
  modifiers: Modifier[]
  progress?: number[] // compteurs de production du TERRAIN (ex : un bloc d'eau), comme ceux d'une entité (voir production.ts)
  produced?: number[]
}

// Le monde : dictionnaire "x,z" -> cellule (les coordonnées négatives sont donc possibles)
export type World = Map<string, GridCell>

// Zone d'effet : liste de décalages [dx, dz] autour de l'entité
export type Area = ReadonlyArray<readonly [number, number]>

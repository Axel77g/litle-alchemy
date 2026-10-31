// Monde 1 : l'Âge de Pierre. Données seulement : aucune logique ici.
import { defineItems, type Recipe } from '../../engine/items'

export const world1Items = defineItems({
  // Matières premières (dock)
  stone: { name: 'Caillou', icon: '🪨', kind: 'material', model: 'stone', tier: 1, sellValue: 1 },
  stick: { name: 'Bâton', icon: '🪵', kind: 'material', model: 'stick', tier: 1, sellValue: 1 },
  wall: { name: 'Mur', icon: '🧱', kind: 'material', model: 'wall', tier: 2, sellValue: 4 },
  flint_tool: { name: 'Outil en Silex', icon: '🗡️', kind: 'material', model: 'flint_tool', tier: 1, sellValue: 3 },
  spark: { name: 'Étincelle', icon: '✨', kind: 'material', model: 'spark', tier: 3, sellValue: 2 },
  raw_meat: { name: 'Viande crue', icon: '🥩', kind: 'material', model: 'raw_meat', tier: 2, sellValue: 10 },
  // Donné à un Chasseur : frénésie (×3 vitesse) pendant 60 s
  grilled_steak: { name: 'Steak grillé', icon: '🍖', kind: 'material', model: 'grilled_steak', tier: 3, sellValue: 50, frenzy: { duration: 60, targetTag: 'hungry' } },

  mud: { name: 'Boue', icon: '🟤', kind: 'material', model: 'mud', tier: 1, sellValue: 1 },
  brick: { name: 'Brique', icon: '🧱', kind: 'material', model: 'brick', tier: 3, sellValue: 8 },
  wolf: { name: 'Loup sauvage', icon: '🐺', kind: 'material', model: 'wolf', tier: 4, sellValue: 12 },
  weird_stone: { name: 'Caillou bizarre', icon: '💎', kind: 'material', model: 'weird_stone', tier: 4, sellValue: 15 },
  // Le portail vers le monde suivant : l'obtenir termine le monde 1
  bronze_age: { name: "L'Âge du Bronze", icon: '🏺', kind: 'material', model: 'bronze_age', tier: 5 },

  // Catalyseurs (dock) : transforment un autre item
  heat: { name: 'Chaleur', icon: '🔥', kind: 'catalyst', model: 'heat', tier: 3, sellValue: 3 },

  // Producteurs (posés sur le plateau)
  rock_deposit: {
    name: 'Rocher',
    icon: '⛰️',
    kind: 'producer',
    tier: 1,
    model: 'rock',
    production: [{ output: 'stone', every: 10 }],
  },
  bush: {
    name: 'Buisson',
    icon: '🌿',
    kind: 'producer',
    tier: 1,
    model: 'tree',
    production: [{ output: 'stick', every: 10 }],
  },
  cro_magnon: {
    name: 'Cro-Magnon',
    icon: '🧍',
    kind: 'producer',
    tier: 1,
    tags: ['worker'],
    nightMultiplier: 1.5,
    model: 'caveman',
    production: [{ output: 'shell', every: 1 }],
  },
  hunter: {
    name: 'Chasseur',
    icon: '🏹',
    kind: 'producer',
    tier: 2,
    tags: ['worker', 'hungry'],
    nightMultiplier: 1.5,
    model: 'hunter',
    production: [
      { output: 'shell', every: 1, amount: 5 },
      { output: 'raw_meat', every: 15 },
    ],
  },
  hut: {
    name: 'Cabane',
    icon: '🛖',
    kind: 'producer',
    tier: 3,
    tags: ['home'],
    model: 'hut',
    // Une cabane n'abrite qu'un seul bonhomme : un Cro-Magnon après 30 s, puis elle est épuisée
    production: [{ output: 'cro_magnon', every: 30, limit: 1 }],
  },
  mud_puddle: {
    name: 'Flaque',
    icon: '💧',
    kind: 'producer',
    tier: 1,
    model: 'puddle',
    production: [{ output: 'mud', every: 10 }],
  },
  miner: {
    name: 'Mineur',
    icon: '⛏️',
    kind: 'producer',
    tier: 2,
    tags: ['worker', 'hungry'],
    nightMultiplier: 1.5,
    model: 'miner',
    // Des cailloux en continu, et de temps en temps un Caillou bizarre (le minerai de l'Âge du Bronze)
    production: [
      { output: 'stone', every: 6 },
      { output: 'weird_stone', every: 90 },
    ],
  },
  lumberjack: {
    name: 'Bûcheron',
    icon: '🪓',
    kind: 'producer',
    tier: 2,
    tags: ['worker'],
    nightMultiplier: 1.5,
    model: 'lumberjack',
    production: [{ output: 'stick', every: 6 }],
  },
  tribal_hut: {
    name: 'Hutte tribale',
    icon: '🛖',
    kind: 'producer',
    tier: 4,
    tags: ['home'],
    model: 'tribal_hut',
    // Le gros revenu de l'âge de pierre, et une nouvelle recrue toutes les minutes
    production: [
      { output: 'shell', every: 1, amount: 25 },
      { output: 'cro_magnon', every: 60 },
    ],
  },
  dog: {
    name: 'Chien préhistorique',
    icon: '🐕',
    kind: 'producer',
    tier: 4,
    model: 'dog',
    dockBonus: 15, // il ramasse tout : +15 places dans le dock
  },
  mammoth: {
    name: 'Mammouth',
    icon: '🦣',
    kind: 'producer',
    tier: 4,
    model: 'mammoth',
    production: [{ output: 'shell', every: 1, amount: 40 }],
  },
  painter: {
    name: 'Peintre rupestre',
    icon: '🎨',
    kind: 'producer',
    tier: 5,
    nightMultiplier: 1, // ×1 : aucun effet sur la production (il n'en a pas), mais c'est ce qui le fait rentrer chez lui la nuit
    model: 'painter',
    // Il dessine des bisons sur les murs : +20 % de coquillages sur toute l'île
    aura: { area: 'global', valueMultiplier: 0.2 },
  },
  furnace: {
    name: 'Fournaise primitive',
    icon: '🏭',
    kind: 'producer',
    tier: 5,
    model: 'furnace',
    production: [{ output: 'heat', every: 6 }],
  },
  campfire: {
    name: 'Feu de Camp',
    icon: '🏕️',
    kind: 'producer',
    tier: 3,
    model: 'campfire',
    production: [{ output: 'heat', every: 12 }],
    // Aura : les ouvriers sur les 4 cases adjacentes travaillent +50 % plus vite
    aura: { area: 'cross', speedMultiplier: 0.5, affectsTag: 'worker' },
  },
})

export type World1ItemId = keyof typeof world1Items

export const world1Recipes: (Recipe & { inputs: World1ItemId[]; result: World1ItemId })[] = [
  { inputs: ['stone', 'stick'], result: 'flint_tool' },
  { inputs: ['cro_magnon', 'flint_tool'], result: 'hunter' },
  { inputs: ['stone', 'stone'], result: 'spark' },
  { inputs: ['spark', 'stick'], result: 'campfire' },
  { inputs: ['raw_meat', 'heat'], result: 'grilled_steak' },
  { inputs: ['stick', 'stick', 'stick'], result: 'wall' }, // 3 bâtons -> 1 mur
  { inputs: ['wall', 'wall', 'wall', 'wall', 'campfire'], result: 'hut' }, // 4 murs + un feu de camp -> cabane
  // Métiers : s'obtiennent aussi en utilisant l'item sur un Cro-Magnon posé sur l'île
  { inputs: ['cro_magnon', 'stone'], result: 'miner' },
  { inputs: ['cro_magnon', 'stick'], result: 'lumberjack' },
  { inputs: ['cro_magnon', 'mud'], result: 'painter' },
  // Boue, brique, hutte
  { inputs: ['mud', 'heat'], result: 'brick' },
  { inputs: ['brick', 'stick'], result: 'tribal_hut' },
  // Domestication : le loup est attiré par l'odeur de la viande
  { inputs: ['raw_meat', 'raw_meat'], result: 'wolf' },
  { inputs: ['wolf', 'cro_magnon'], result: 'dog' },
  // Deux chasseurs pour capturer un mammouth (se fait aussi en les glissant l'un sur l'autre sur l'île)
  { inputs: ['hunter', 'hunter'], result: 'mammoth' },
  // Fin du monde 1
  { inputs: ['campfire', 'brick'], result: 'furnace' },
  { inputs: ['furnace', 'weird_stone'], result: 'bronze_age' },
]

// Objectifs : le HUD affiche le premier pas encore atteint ; l'avancement = objectifs atteints / total.
// Le dernier (l'Âge du Bronze) termine le monde.
export const world1Goals: { item: World1ItemId; text: string }[] = [
  { item: 'flint_tool', text: 'Fabriquer un Outil en Silex' },
  { item: 'hunter', text: 'Créer un Chasseur' },
  { item: 'wall', text: 'Construire un Mur' },
  { item: 'hut', text: 'Bâtir une Cabane' },
  { item: 'grilled_steak', text: 'Cuisiner un Steak grillé' },
  { item: 'brick', text: 'Cuire une Brique' },
  { item: 'dog', text: 'Apprivoiser un Chien' },
  { item: 'mammoth', text: 'Capturer un Mammouth' },
  { item: 'painter', text: 'Recruter un Peintre rupestre' },
  { item: 'furnace', text: 'Forger la Fournaise' },
  { item: 'bronze_age', text: "Ouvrir l'Âge du Bronze" },
]

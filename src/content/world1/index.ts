import { createRuleset } from '../../engine/items'
import { world1Finale, world1Goals, world1Items, world1Recipes } from './items'
import { ground, objects } from './layout'

// Un monde = règles (items + recettes) + plan de départ + stock de départ. Le moteur ne connaît que cette forme.
export const world1 = {
  id: 'world1',
  name: 'Âge de Pierre',
  // Un bloc d'eau produit de l'eau, et arrose : +50 % de blé sur les champs des 4 cases adjacentes
  rules: createRuleset(world1Items, world1Recipes, {
    production: { WATER: [{ output: 'water', every: 10 }] },
    auras: { WATER: { area: 'cross', speedMultiplier: 0.5, affectsTag: 'crop' } },
  }),
  ground,
  objects,
  // Agrandissement : 1re case à 25 🐚, puis +12 % à chaque case achetée
  expansion: {
    baseCost: 25,
    growth: 1.12,
    startCells: ground.flat().filter(Boolean).length,
    // 1 fois sur 8, un buisson, un rocher ou une flaque apparaît sur la case achetée
    spawnChance: 1 / 8,
    spawnItems: ['bush', 'rock_deposit', 'mud_puddle'],
  },
  goals: world1Goals,
  finale: world1Finale,
  dockCapacity: 1000, // nombre de cartes que le dock peut contenir (le Chien en ajoute)
  startingInventory: { stone: 2, stick: 2 } as Record<string, number>,
}

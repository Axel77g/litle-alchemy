// Le tutoriel de la toute première partie : une étape à la fois, dans l'ordre. Données seulement : la mécanique est dans store.ts et runner.ts,
// l'affichage dans ui/TutorialOverlay.tsx, les textes dans les fichiers de langue (`tutorial.<id>`).
//
// Parcours : Étincelle -> (découverte) -> Feu de Camp -> cadeau de coquillages -> pose du feu -> la production tourne (le joueur fabrique son Silex)
// -> Silex sur le Cro-Magnon (Chasseur) -> agrandir l'île -> objectif. Puis, plus tard, le chapitre « boosts » (steak).
import { totalCards } from '../engine/inventory'
import { placementCost } from '../engine/pricing'
import type { ItemId } from '../engine/types'
import { useGame } from '../store/game'
import { formatNumber } from '../shared/format'
import type { TutorialContext, TutorialStep } from './types'

// Coquillages offerts pour poser le Feu de Camp (il coûte 100 🐚 et le joueur démarre à 0)
const GIFT = 880
// Case où l'on montre de poser le feu : celle à côté du Cro-Magnon de départ (voir content/world1/layout.ts)
const CAMPFIRE_CELL = { x: 0, z: -1 }

const owned = ({ game }: TutorialContext, id: ItemId) => (game.inventory[id] ?? 0) > 0
const onIsland = ({ game }: TutorialContext, id: ItemId) => [...game.world.values()].some((c) => c.entity?.itemId === id)
// Un Chasseur est en frénésie (il a mangé un steak)
const frenzied = ({ game }: TutorialContext) => [...game.world.values()].some((c) => c.entity?.itemId === 'hunter' && c.entity.frenzyTimer > 0)
const hunterCost = ({ game }: TutorialContext) => placementCost(game.rules, game.world, 'hunter')

export const STEPS: TutorialStep[] = [
  { id: 'spark', target: '[data-item="stone"]', to: '[data-item="stone"]', when: (c) => owned(c, 'spark') || owned(c, 'campfire') || onIsland(c, 'campfire') },
  { id: 'discovery', target: '[data-tut="discovery"]', holdsDiscovery: true },
  { id: 'campfire', target: '[data-item="spark"]', to: '[data-item="stick"]', when: (c) => owned(c, 'campfire') || onIsland(c, 'campfire') },
  // Poser un producteur se paie : on offre de quoi démarrer
  {
    id: 'gift',
    target: '[data-tut="shells"]',
    vars: () => ({ gift: formatNumber(GIFT) }),
    enter: () => useGame.setState((s) => ({ shells: s.shells + GIFT })),
  },
  { id: 'place', target: '[data-item="campfire"]', to: { cell: CAMPFIRE_CELL }, when: (c) => onIsland(c, 'campfire') },
  // La simulation tourne : le joueur fait son Silex avec ce que l'île produit, et attend d'avoir de quoi payer le Chasseur
  {
    id: 'wait',
    target: '[data-tut="shells"]',
    running: true,
    ack: true,
    vars: (c) => ({ cost: formatNumber(hunterCost(c)) }),
    when: (c) => onIsland(c, 'hunter') || (owned(c, 'flint_tool') && c.game.shells >= hunterCost(c)),
  },
  // Le jeu se fige : Silex sur le Cro-Magnon. Sautée si le joueur l'a déjà fait.
  {
    id: 'hunter',
    target: '[data-item="flint_tool"]',
    to: { entity: 'cro_magnon' },
    vars: (c) => ({ cost: formatNumber(hunterCost(c)) }),
    when: (c) => onIsland(c, 'hunter'),
  },
  { id: 'expand', target: '[data-tut="expand"]', when: ({ ui }) => ui.editMode },
  { id: 'goal', target: '[data-tut="goal"]' },

  // Chapitre « boosts » : au premier steak possible (la viande crue vient d'être découverte), on montre la Chaleur puis le steak au Chasseur.
  // Le jeu est figé pendant ces étapes : on redonne ce qui manque (la Chaleur est lente à venir).
  {
    id: 'grill',
    startOn: (e) => e.type === 'discovered' && e.itemId === 'raw_meat',
    target: '[data-item="raw_meat"]',
    to: '[data-item="heat"]',
    enter: ({ game }) => (['raw_meat', 'heat'] as const).forEach((id) => !game.inventory[id] && game.give(id)),
    when: (c) => owned(c, 'grilled_steak') || frenzied(c),
  },
  { id: 'steak', target: '[data-item="grilled_steak"]', to: { entity: 'hunter' }, when: frenzied },

  // Chapitre « dock plein » : la première fois que la production se met en pause faute de place, on montre où vendre
  {
    id: 'full',
    startOn: (e) => e.type === 'dockFull',
    target: '[data-sell]',
    when: ({ game }) => totalCards(game.inventory) < game.capacity(),
  },
]

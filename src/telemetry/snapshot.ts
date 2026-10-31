// Lecture de l'état du jeu pour l'enregistrement (partagée par les joueurs et le bot : même mesure des deux côtés).
import { shellRate } from '../engine/production'
import { totalCards } from '../engine/inventory'
import { useGame } from '../store/game'
import type { Sample } from './schema'

export function storeSnapshot(): Omit<Sample, 't'> {
  const { shells, world, rules, night, inventory } = useGame.getState()
  let producers = 0
  for (const c of world.values()) if (c.entity) producers++
  return { shells, rate: shellRate(rules, world, night), cells: world.size, producers, cards: totalCards(inventory) }
}

export const seenIds = () => Object.keys(useGame.getState().seen)

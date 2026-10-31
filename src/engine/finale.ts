// Fin d'un monde. Ce n'est pas un item qu'on fabrique : c'est une condition, donnée par le monde.
// Il faut avoir DÉCOUVERT certains items (ils sont dans le grimoire) ET posséder assez de coquillages : un jeu idle se termine à l'usure,
// pas par une recette. Les coquillages ne sont pas dépensés.
import type { ItemId } from './types'

export interface Finale {
  text: string // ex : « Dresser le Cercle de pierres »
  requires: ItemId[] // items à avoir déjà obtenus un jour
  shells: number // coquillages à posséder
}

export interface FinaleStatus {
  missing: ItemId[] // items pas encore découverts
  found: number // items découverts
  reached: boolean
}

export function finaleStatus(finale: Finale, seen: Record<ItemId, true>, shells: number): FinaleStatus {
  const missing = finale.requires.filter((id) => !seen[id])
  return { missing, found: finale.requires.length - missing.length, reached: missing.length === 0 && shells >= finale.shells }
}

import type { GameEvent } from '../engine/events'
import type { ItemId } from '../engine/types'
import type { useGame } from '../store/game'
import type { useUi } from '../interaction/uiStore'

// Ce que le guide met en lumière :
//  - un sélecteur CSS : un élément de l'interface (carte du dock, compteur, bouton...) ;
//  - { cell } : une case de l'île, par ses coordonnées ;
//  - { entity } : l'endroit où se trouve, sur l'île, un item posé (ex : le Cro-Magnon). Rien n'est mis en lumière tant qu'il n'y en a pas.
export type Target = string | { cell: { x: number; z: number } } | { entity: ItemId }

// L'état du jeu et de l'interface, tel qu'une étape peut le lire
export interface TutorialContext {
  game: ReturnType<typeof useGame.getState>
  ui: ReturnType<typeof useUi.getState>
}

export interface TutorialStep {
  id: string // le texte affiché est `tutorial.<id>` dans les fichiers de langue
  target: Target
  to?: Target // arrivée du geste : une main glisse de `target` vers `to`
  vars?: (ctx: TutorialContext) => Record<string, string | number> // variables du texte (ex : un prix calculé, jamais écrit en dur)
  // Validation : par un événement du moteur, par l'état du jeu / de l'interface, ou les deux (la première qui arrive).
  // `when` est aussi testée à l'arrivée sur l'étape : une étape déjà accomplie est sautée. Sans `done` ni `when` : bouton « OK ».
  done?: (e: GameEvent, ctx: TutorialContext) => boolean
  when?: (ctx: TutorialContext) => boolean
  enter?: (ctx: TutorialContext) => void // préparation à l'arrivée sur l'étape (donner un item manquant, offrir des coquillages...)
  holdsDiscovery?: boolean // la bannière « Nouvelle découverte ! » reste affichée tant que l'étape dure (voir Celebrations)
  startOn?: (e: GameEvent) => boolean // première étape d'un chapitre à part : le guide s'y lance de lui-même quand cet événement arrive (une seule fois : voir runner)
  ack?: boolean // étape d'attente : bouton « J'ai compris » qui masque le guide, il ne revient qu'à la validation de l'étape (voir `hiddenFor`)
  running?: boolean // la simulation tourne pendant cette étape (par défaut : le jeu est gelé, voir gameGate)
}

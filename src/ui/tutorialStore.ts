// Tutoriel de la toute première partie : une étape à la fois, validée par ce que le joueur fait vraiment (événements du moteur).
import { create } from 'zustand'
import type { GameEvent } from '../engine/events'
import { useUi } from './uiStore'

export interface TutorialStep {
  id: string
  target: string // sélecteur CSS de l'élément mis en lumière
  to?: string // sélecteur de l'arrivée du geste : une main glisse de `target` vers `to`
  done?: (e: GameEvent) => boolean // validée par cet événement du moteur
  doneWhen?: (ui: ReturnType<typeof useUi.getState>) => boolean // ... ou par l'état de l'interface
  // sans `done` ni `doneWhen` : l'étape se valide avec le bouton « OK »
}

export const STEPS: TutorialStep[] = [
  { id: 'merge', target: '[data-item="stone"]', to: '[data-item="stick"]', done: (e) => e.type === 'merged' && e.result === 'flint_tool' },
  // La bannière de découverte reste affichée tant que cette étape dure (voir Celebrations)
  { id: 'discovery', target: '[data-tut="discovery"]' },
  { id: 'shells', target: '[data-tut="shells"]' },
  // Le Chasseur coûte cher au début : on l'explique (bouton OK) sans attendre que le joueur l'achète
  { id: 'hunter', target: '[data-item="flint_tool"]' },
  { id: 'expand', target: '[data-tut="expand"]', doneWhen: (ui) => ui.editMode },
  { id: 'goal', target: '[data-tut="goal"]' },
]

// Seulement une partie neuve (pas de sauvegarde au chargement), et jamais en autopilote
const fresh = !useUi.getState().hasSave && !new URLSearchParams(location.search).has('autoplay')

// intro : le mot d'accueil (scénario) passe avant la première étape
export const useTutorial = create<{ step: number | null; intro: boolean }>(() => ({ step: fresh ? 0 : null, intro: fresh }))
export const endIntro = () => useTutorial.setState({ intro: false })

export const nextStep = () => useTutorial.setState((s) => ({ step: s.step === null || s.step + 1 >= STEPS.length ? null : s.step + 1 }))
export const endTutorial = () => useTutorial.setState({ step: null, intro: false })

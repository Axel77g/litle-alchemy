// Fait avancer le tutoriel : surveille la validation de l'étape en cours (événement du moteur ou état du jeu), et la prépare à son arrivée.
// Hors de React : l'overlay ne fait qu'afficher (ui/TutorialOverlay.tsx).
import { isAutoplay } from '../shared/autoplayMode'
import { onGameEvent } from '../engine/events'
import { useGame } from '../store/game'
import { leaveEditMode, useUi } from '../interaction/uiStore'
import { completeStep, currentStep, inFirstChapter, useTutorial } from './store'
import { STEPS } from './steps'
import type { TutorialContext, TutorialStep } from './types'

// Les chapitres lancés par un événement ne se montrent qu'une fois, même après un rechargement (ex : « dock plein » peut se répéter)
const SEEN_KEY = 'tutorial.seen'
const readSeen = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]')
  } catch {
    return []
  }
}
const hasSeen = (id: string) => readSeen().includes(id)
const markSeen = (id: string) => {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...readSeen(), id]))
  } catch {}
}

const context = (): TutorialContext => ({ game: useGame.getState(), ui: useUi.getState() })

// Surveille une étape jusqu'à ce qu'on appelle la fonction renvoyée
function watch(step: TutorialStep): () => void {
  let disposed = false
  const off: (() => void)[] = []
  const complete = () => completeStep(step.id)

  step.enter?.(context())

  // Les écouteurs ne s'installent qu'une fois l'événement en cours terminé : sinon l'événement qui vient de valider l'étape précédente
  // (la boucle d'événements du moteur visite aussi les écouteurs ajoutés pendant son parcours) validerait aussi celle-ci.
  queueMicrotask(() => {
    if (disposed) return
    const { done, when } = step
    if (done) off.push(onGameEvent((e) => done(e, context()) && complete()))
    if (when) {
      const check = () => when(context()) && complete()
      off.push(useGame.subscribe(check), useUi.subscribe(check))
      check() // déjà accomplie à l'arrivée : on passe
    }
  })

  return () => {
    disposed = true
    off.forEach((fn) => fn())
  }
}

// À appeler une fois au démarrage. L'étape n'est surveillée que quand l'overlay est affiché (pas pendant l'accueil ni l'introduction).
export function initTutorial() {
  let watched: string | null = null
  let stop: (() => void) | undefined

  const sync = () => {
    const { stepId, intro } = useTutorial.getState()
    const active = stepId !== null && !intro && !useUi.getState().homeOpen ? stepId : null
    if (active === watched) return
    stop?.()
    stop = undefined
    watched = active
    const step = currentStep(active)
    if (step) stop = watch(step)
  }

  useTutorial.subscribe(sync)

  // Chapitres qui se lancent sur un événement (`startOn`), une seule fois : l'événement ne se produit qu'une fois (ex : première découverte).
  // S'il arrive pendant un autre chapitre, on le garde pour la fin de celui-ci.
  if (!isAutoplay) {
    let pending: string | null = null
    const start = () => {
      const { stepId, intro, skipped } = useTutorial.getState()
      if (!pending || stepId !== null || intro || skipped) return
      markSeen(pending)
      useTutorial.setState({ stepId: pending, hiddenFor: null })
      pending = null
    }
    onGameEvent((e) => {
      const step = STEPS.find((s) => s.startOn?.(e))
      if (step && !hasSeen(step.id)) (pending = step.id), start()
    })
    useTutorial.subscribe(start)
  }
  // Fin du tutoriel (terminé ou passé) : le mode construction, ouvert pour l'étape « agrandir l'île », est refermé
  useTutorial.subscribe((s, prev) => {
    if (prev.stepId !== null && s.stepId === null && inFirstChapter(prev.stepId)) leaveEditMode()
  })
  useUi.subscribe(sync)
  sync()
}

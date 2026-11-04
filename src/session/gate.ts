// La partie ne démarre qu'une fois l'accueil passé, le mot d'introduction fermé (« C'est parti ! ») et le tutoriel terminé : d'ici là, le jeu est figé,
// pour que la production n'inonde pas le joueur de découvertes avant qu'il ait compris les premiers gestes.
// Ce module calcule la phase (voir store/phase.ts) à partir de l'interface et du tutoriel.
import { useUi } from '../interaction/uiStore'
import { isAutoplay } from '../shared/autoplayMode'
import { computePhase, setPhase } from '../store/phase'
import { currentStep, useTutorial } from '../tutorial/store'

// L'autopilote (balance / tests) joue sans passer par l'accueil
if (!isAutoplay) {
  const sync = () => {
    const { stepId, intro } = useTutorial.getState()
    // Pendant le tutoriel le jeu est figé, sauf sur les étapes qui demandent de voir la production tourner (`running`)
    const guided = stepId !== null && !currentStep(stepId)?.running
    setPhase(computePhase(useUi.getState().homeOpen, intro, guided))
  }
  useUi.subscribe(sync)
  useTutorial.subscribe(sync)
  sync()
}

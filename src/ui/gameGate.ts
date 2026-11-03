// La partie ne démarre qu'une fois l'accueil passé, le mot d'introduction fermé (« C'est parti ! ») et le tutoriel terminé : d'ici là, le jeu est figé,
// pour que la production n'inonde pas le joueur de découvertes avant qu'il ait compris les premiers gestes.
import { freezeGame } from '../store/game'
import { currentStep, useTutorial } from '../tutorial/store'
import { isAutoplay } from './autoplayMode'
import { useUi } from './uiStore'

// L'autopilote (balance / tests) joue sans passer par l'accueil
if (!isAutoplay) {
  const sync = () => {
    const { stepId, intro } = useTutorial.getState()
    const early = useUi.getState().homeOpen || intro // avant « C'est parti ! »
    // Pendant le tutoriel le jeu est figé, sauf sur les étapes qui demandent de voir la production tourner (`running`)
    const guided = stepId !== null && !currentStep(stepId)?.running
    freezeGame(early || guided, early)
  }
  useUi.subscribe(sync)
  useTutorial.subscribe(sync)
  sync()
}

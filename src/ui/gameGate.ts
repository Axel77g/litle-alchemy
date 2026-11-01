// La partie ne démarre qu'une fois l'accueil passé, le mot d'introduction fermé (« C'est parti ! ») et le tutoriel terminé : d'ici là, le jeu est figé,
// pour que la production n'inonde pas le joueur de découvertes avant qu'il ait compris les premiers gestes.
import { freezeGame } from '../store/game'
import { useTutorial } from './tutorialStore'
import { useUi } from './uiStore'

// L'autopilote (balance / tests) joue sans passer par l'accueil
if (!new URLSearchParams(location.search).has('autoplay')) {
  const sync = () => {
    const { step, intro } = useTutorial.getState()
    const early = useUi.getState().homeOpen || intro // avant « C'est parti ! »
    freezeGame(early || step !== null, early)
  }
  useUi.subscribe(sync)
  useTutorial.subscribe(sync)
  sync()
}

import { snapshot, useGame } from '../store/game'
import { clearSave, writeSave } from '../store/persist'
import { restartTelemetry } from '../telemetry'
import { beginTutorial } from '../tutorial/store'
import { useUi } from './uiStore'

// « Nouvelle partie » : on part de l'état initial SANS recharger la page (un rechargement refait tout : code, modèles 3D, shaders, icônes, tutoriel).
// Sans sauvegarde au chargement, la partie en mémoire est déjà neuve (et le tutoriel armé) : il suffit de quitter l'accueil.
export function newGame() {
  if (useUi.getState().hasSave) {
    clearSave() // l'autosave est coupée tant que l'accueil / l'introduction sont ouverts (voir gameGate) : la nouvelle partie n'est écrite qu'après « C'est parti ! »
    useGame.getState().reset()
    restartTelemetry()
    beginTutorial()
    useUi.setState({
      hasSave: false,
      drag: null,
      hover: null,
      selectedGhost: null,
      editMode: false,
      mergePrompt: null,
      sellPrompt: null,
      infoCard: null,
      cellInfo: null,
      grimoireOpen: false,
      newDiscoveries: 0,
      victoryDismissed: false,
    })
  }
  useUi.setState({ homeOpen: false })
}

// Retour à l'écran d'accueil en cours de partie. L'accueil fige le jeu ET coupe l'autosave (voir gameGate) : on sauvegarde donc d'abord,
// et on marque la sauvegarde comme existante pour que « Reprendre » apparaisse.
export function openHome() {
  writeSave(useGame.getState().worldId, snapshot())
  useUi.setState({ homeOpen: true, hasSave: true, editMode: false, grimoireOpen: false, drag: null, hover: null })
}

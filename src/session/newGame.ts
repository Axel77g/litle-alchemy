import { snapshot, useGame } from '../store/game'
import { clearSave, writeSave } from '../store/persist'
import { restartTelemetry } from '../telemetry'
import { beginTutorial } from '../tutorial/store'
import { enterHome, leaveHome, resetUiForNewGame, useUi } from '../interaction/uiStore'

// « Nouvelle partie » : on part de l'état initial SANS recharger la page (un rechargement refait tout : code, modèles 3D, shaders, icônes, tutoriel).
// Sans sauvegarde au chargement, la partie en mémoire est déjà neuve (et le tutoriel armé) : il suffit de quitter l'accueil.
export function newGame() {
  if (useUi.getState().hasSave) {
    clearSave() // l'autosave est coupée tant que l'accueil / l'introduction sont ouverts (voir gameGate) : la nouvelle partie n'est écrite qu'après « C'est parti ! »
    useGame.getState().reset()
    restartTelemetry()
    beginTutorial()
    resetUiForNewGame()
  }
  leaveHome()
}

// Retour à l'écran d'accueil en cours de partie. L'accueil fige le jeu ET coupe l'autosave (voir gameGate) : on sauvegarde donc d'abord,
// et on marque la sauvegarde comme existante pour que « Reprendre » apparaisse.
export function openHome() {
  writeSave(useGame.getState().worldId, snapshot())
  enterHome()
}

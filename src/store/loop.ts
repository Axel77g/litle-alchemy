// Boucle de simulation : indépendante du rendu 3D (10 ticks/s). Comme la production se calcule sur le temps écoulé,
// un onglet en arrière-plan (setInterval ralenti) rattrape son retard sans rien perdre.
import { snapshot, useGame } from './game'
import { writeSave } from './persist'

const TICK_MS = 100
const AUTOSAVE_MS = 5000

export function startLoop() {
  const save = () => writeSave(useGame.getState().worldId, snapshot())
  const tick = setInterval(() => useGame.getState().tick(), TICK_MS)
  const autosave = setInterval(save, AUTOSAVE_MS)
  window.addEventListener('beforeunload', save)
  document.addEventListener('visibilitychange', () => document.hidden && save())
  return () => {
    clearInterval(tick)
    clearInterval(autosave)
    window.removeEventListener('beforeunload', save)
  }
}

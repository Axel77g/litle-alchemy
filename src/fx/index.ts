// Branche les FX sur les événements du moteur. À appeler une fois au démarrage.
import { SHELL } from '../engine/items'
import { onGameEvent } from '../engine/events'
import { TILE_DROP_TIME, forgetDrop, forgetPop, registerDrop, registerTileDrop, tileDropStart, triggerImpact, triggerPop } from './effects'
import { launchShells } from './shellFlight'

export function initFx() {
  return onGameEvent((e) => {
    if (e.type === 'entityPlaced') {
      // L'objet tombera du ciel ; si sa case vient d'être achetée (et tombe encore), il attend qu'elle ait atterri
      const tileBorn = tileDropStart(e.x, e.z)
      registerDrop(e.entity.id, tileBorn === undefined ? undefined : tileBorn + TILE_DROP_TIME * 1000)
    }
    if (e.type === 'entityMoved') registerDrop(e.entity.id) // il se repose : il retombe sur sa nouvelle case
    if (e.type === 'entityRemoved') {
      forgetDrop(e.entity.id)
      forgetPop(e.entity.id)
    }
    if (e.type === 'produced') {
      triggerPop(e.entityId) // le producteur « saute »
      if (e.output === SHELL) launchShells(e.x, e.z, e.amount) // et le coquillage file vers le compteur
    }
    if (e.type === 'cellUnlocked') registerTileDrop(e.x, e.z) // la nouvelle case tombe du ciel
    if (e.type === 'terrainChanged') triggerImpact(e.x, e.z, 2.5) // l'eau jaillit : une onde se propage dans l'île
    // à venir : chiffres flottants...
  })
}

// Branche les sons sur les événements du moteur. À appeler une fois au démarrage.
// Les fichiers à jouer se déclarent dans manifest.ts : ce fichier ne contient que la logique.
import { onGameEvent } from '../engine/events'
import { DROP_TIME, TILE_DROP_TIME } from '../fx/effects'
import { initAmbience } from './ambience'
import { MERGE_SUCCESS_DELAY_MS, PRODUCE_SOUND } from './manifest'
import { initMusic } from './music'
import { sfx } from './sfx'
import { unlockAudio, whenReady } from './engine'

export { isMuted, setMuted } from './engine'

const later = (seconds: number, fn: () => void) => void setTimeout(fn, seconds * 1000)

export function initAudio() {
  unlockAudio()
  // Ambiances et musique démarrent au premier geste (le navigateur interdit le son avant)
  whenReady(initAmbience)
  initMusic()

  return onGameEvent((e) => {
    switch (e.type) {
      case 'produced':
        sfx(PRODUCE_SOUND[e.output] ?? 'pop')
        break
      // l'impact tombe à la fin de la chute (voir fx/effects.ts)
      case 'entityPlaced':
      case 'entityMoved':
        later(DROP_TIME, () => sfx('place'))
        break
      case 'cellUnlocked':
        later(TILE_DROP_TIME, () => sfx('tile'))
        break
      case 'terrainChanged':
        sfx('tile')
        break
      case 'entityRemoved':
        sfx('remove')
        break
      case 'discovered':
        sfx('discovered')
        break
      case 'dockFull':
        sfx('dockFull')
        break
      case 'itemGrabbed':
        sfx('grab')
        break
      case 'itemReleased':
        sfx('release')
        break
      case 'dockHover':
        sfx('hover')
        break
      case 'merged':
        sfx('merge')
        setTimeout(() => sfx('success'), MERGE_SUCCESS_DELAY_MS)
        break
      case 'sold':
      case 'cellBought':
        sfx('sell')
        break
      case 'victory':
        sfx('victory')
        break
    }
  })
}

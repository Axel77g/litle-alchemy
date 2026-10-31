// Joue un son ponctuel du manifest (silencieux tant qu'aucun fichier n'est chargé).
import { SFX, type SfxKey } from './manifest'
import { pickLoaded } from './samples'
import { jitter, play, playBuffer } from './engine'

export function sfx(key: SfxKey) {
  const def = SFX[key]
  play(key, def.minGapMs ?? 0, () => {
    const buffer = pickLoaded(key, def.files)
    if (buffer) playBuffer(buffer, def.volume ?? 1, jitter(def.pitchJitter ?? 0.05))
  })
}

// Joue un son ponctuel du manifest (silencieux tant qu'aucun fichier n'est chargé).
import { SFX, type SfxKey } from './manifest'
import { pickLoaded } from './samples'
import { getContext, jitter, play, playBuffer, type Voice } from './engine'

const CHOKE_FADE = 0.04 // secondes : fondu du son coupé

// Les pops partagent un même groupe : le dernier lancé coupe le précédent, quelle que soit sa clé (saisie, survol, relâchement)
const group = (key: SfxKey) => (SFX[key].files === SFX.grab.files ? 'pop' : key)
const groupVoice = new Map<string, Voice>()

export function sfx(key: SfxKey) {
  const def = SFX[key]
  play(key, def.minGapMs ?? 0, () => {
    const buffer = pickLoaded(key, def.files)
    if (!buffer) return
    const g = group(key)
    const prev = def.choke ? groupVoice.get(g) : undefined
    const c = getContext()
    if (prev && c) {
      prev.gain.gain.cancelScheduledValues(c.currentTime)
      prev.gain.gain.setTargetAtTime(0, c.currentTime, CHOKE_FADE / 3)
      try {
        prev.src.stop(c.currentTime + CHOKE_FADE * 2)
      } catch {
        // déjà terminé
      }
    }
    const voice = playBuffer(buffer, def.volume ?? 1, jitter(def.pitchJitter ?? 0.05))
    if (voice && def.choke) groupVoice.set(g, voice)
  })
}

// Musique de fond : les pistes du manifest, en boucle (une seule piste) ou à la suite (plusieurs).
import { useGame } from '../store/game'
import { MUSIC } from './manifest'
import { urlOf } from './samples'
import { getContext, getMaster, whenReady } from './engine'

export function initMusic() {
  if (MUSIC.tracks.length === 0) return

  whenReady(() => {
    const ctx = getContext()
    const master = getMaster()
    if (!ctx || !master) return

    const el = new Audio()
    el.loop = MUSIC.tracks.length === 1
    el.preload = 'auto'
    const gain = ctx.createGain()
    gain.gain.value = 0
    ctx.createMediaElementSource(el).connect(gain).connect(master)

    let index = 0
    const start = () => {
      el.src = urlOf(MUSIC.tracks[index])
      el.play().catch(() => console.warn(`[audio] musique "${MUSIC.tracks[index]}" introuvable ou illisible dans public/audio/`))
    }
    el.addEventListener('ended', () => {
      index = (index + 1) % MUSIC.tracks.length
      start()
    })

    // Volume : fondu à l'entrée, plus bas la nuit
    const setVolume = (night: boolean) => gain.gain.setTargetAtTime(MUSIC.volume * (night ? MUSIC.nightVolume : 1), ctx.currentTime, 1.5)
    setVolume(useGame.getState().night)
    useGame.subscribe((s, prev) => s.night !== prev.night && setVolume(s.night))

    // Onglet caché : la musique se met en pause
    document.addEventListener('visibilitychange', () => (document.hidden ? el.pause() : void el.play().catch(() => {})))

    start()
  })
}

// Autopilote : le bot de référence (world1Bot) joue une partie neuve devant le joueur, avec le vrai store, les vraies règles et les vraies animations.
// La session est jetable : la sauvegarde est coupée (disableSaving) et la télémétrie mise en pause, donc recharger la page rend la vraie partie intacte.
import { useGame } from '../store/game'
import { disableSaving } from '../store/persist'
import { pauseTelemetry } from '../telemetry'
import { useAutoplay } from './state'
import { createWorld1Bot, startNewGame } from './world1Bot'

const TICK_MS = 250
const SUB_STEP = 2 // s de jeu entre deux décisions du bot (comme dans l'outil d'équilibrage)
const MAX_SUB_STEPS = 40 // plafond par tick : à très grande vitesse le bot décide moins souvent plutôt que de figer l'écran

export function setAutoplaySpeed(speed: number) {
  useAutoplay.setState({ speed: Math.max(1, speed) })
}

export function startAutoplay(speed = 10) {
  if (useAutoplay.getState().active) return setAutoplaySpeed(speed)
  disableSaving()
  pauseTelemetry()
  startNewGame()
  useAutoplay.setState({ active: true, speed: Math.max(1, speed) })

  let virtual = 0 // secondes de jeu écoulées depuis le début de l'autopilote
  const bot = createWorld1Bot(() => virtual)
  let last = performance.now()
  const timer = setInterval(() => {
    const game = useGame.getState()
    if (game.victory) return clearInterval(timer)
    const now = performance.now()
    const real = Math.min(1, (now - last) / 1000)
    last = now
    if (document.hidden) return
    const { speed } = useAutoplay.getState()
    // La boucle normale du store avance déjà du temps réel : on ajoute le reste pour atteindre la vitesse demandée
    const extra = real * (speed - 1)
    const n = Math.min(MAX_SUB_STEPS, Math.max(1, Math.ceil(extra / SUB_STEP)))
    for (let i = 0; i < n; i++) {
      bot.step()
      if (extra > 0) useGame.getState().advance(extra / n)
    }
    virtual += real * speed
  }, TICK_MS)
}

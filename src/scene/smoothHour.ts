import { clock } from '../engine/clock'

// L'horloge du moteur n'avance que 10 fois par seconde (store/loop.ts), alors que la scène rend à 30-60 images/s :
// tout ce qui en dépend directement (la marche vers la cabane) avancerait par à-coups. On prolonge donc l'heure
// entre deux ticks avec le temps réel écoulé depuis qu'elle a changé.
const MAX_EXTRAPOLATION = 0.2 // secondes : au-delà, la boucle est en retard (onglet en arrière-plan...), on ne devine plus
let seen = NaN
let seenAt = 0

export function smoothHour(): number {
  const now = performance.now()
  if (clock.hour !== seen) {
    seen = clock.hour
    seenAt = now
  }
  if (clock.paused) return clock.hour
  return clock.hour + Math.min((now - seenAt) / 1000, MAX_EXTRAPOLATION) * clock.hoursPerSecond
}

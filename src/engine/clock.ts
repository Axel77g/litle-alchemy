// Horloge du jeu (jour / nuit). Elle vit dans le moteur car la nuit change le gameplay : les personnages rentrent chez eux
// et produisent plus. La scène 3D ne fait que la lire pour l'éclairage (voir scene/skyCycle.ts).
export const DAY_SECONDS = 60 // durée d'un jour complet (24 h de jeu) en secondes réelles

export const START_HOUR = 8 // heure de jeu d'une partie neuve
export const clock = { hour: START_HOUR, hoursPerSecond: 24 / DAY_SECONDS, paused: false }

// Fenêtre de nuit « de gameplay » : bonus de production de 20 h 30 à 5 h 30
export const NIGHT_START = 20.5
export const NIGHT_END = 5.5
const NIGHT_LENGTH = 24 - NIGHT_START + NIGHT_END

const wrap = (h: number) => ((h % 24) + 24) % 24
export const isNight = (hour: number) => {
  const h = wrap(hour)
  return h >= NIGHT_START || h < NIGHT_END
}

const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t))
  return c * c * (3 - 2 * c)
}

// 0 = en plein jour (les personnages travaillent dehors), 1 = chez eux. Ils partent à partir de 19 h et ressortent vers 7 h.
export function homeProgress(hour: number): number {
  const h = wrap(hour)
  if (h >= 19) return smooth((h - 19) / (NIGHT_START - 19))
  if (h < 7) return 1 - smooth((h - NIGHT_END) / (7 - NIGHT_END))
  return 0
}

// Part de la fenêtre [hour, hour + seconds] passée de nuit (0..1). Exact, même pour des centaines de jours hors-ligne.
export function nightFraction(startHour: number, seconds: number, hoursPerSecond = clock.hoursPerSecond): number {
  const total = seconds * hoursPerSecond
  if (total <= 0) return isNight(startHour) ? 1 : 0
  const days = Math.floor(total / 24)
  const rest = total - days * 24
  const s = wrap(startHour)
  let overlap = 0
  for (const k of [-1, 0, 1, 2]) {
    const a = NIGHT_START + 24 * k
    const b = NIGHT_END + 24 * (k + 1)
    overlap += Math.max(0, Math.min(s + rest, b) - Math.max(s, a))
  }
  return (days * NIGHT_LENGTH + overlap) / total
}

// Fait avancer l'horloge de `seconds` secondes réelles
export function advanceClock(seconds: number) {
  if (!clock.paused) clock.hour = wrap(clock.hour + seconds * clock.hoursPerSecond)
}

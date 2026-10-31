// Lecture des parties de vrais joueurs (fichier exporté par le jeu) et comparaison avec le bot, objectif par objectif.
// Les seuils des verdicts sont des HEURISTIQUES pour repérer où regarder, pas des vérités : ils supposent assez de joueurs (une dizaine au moins)
// et le bot est un repère plutôt pessimiste (voir bot-world1.ts).
import type { Run } from '../../src/telemetry/schema'

export interface GoalStat {
  item: string
  text: string
  reached: number // joueurs qui l'ont atteint
  total: number
  median?: number // temps de jeu actif médian des joueurs qui l'ont atteint, avec date connue
  botMedian?: number
  ratio?: number // médiane joueurs / médiane bot
  verdict: string
}

export interface PlayersSummary {
  count: number
  finished: number // parties terminées (victoire)
  medianMinutes: number // temps de jeu actif médian
  medianSessions: number
  returned: number // joueurs revenus au moins 20 h après leur première session
  rejectedPer10Min: number // gestes refusés, médiane (signal de confusion)
  dockFullMedian: number
  lastGoal: Record<string, number> // dernier objectif atteint -> nombre de joueurs qui s'y sont arrêtés
}

const median = (xs: number[]) => {
  if (!xs.length) return undefined
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}

// Mur : moins de la moitié des joueurs y arrivent. Lent / rapide : médiane humaine très loin de celle du bot.
export const WALL_BELOW = 0.5
export const SLOW_ABOVE = 3
export const FAST_BELOW = 0.5

export interface PlayersAnalysis {
  goals: GoalStat[]
  summary: PlayersSummary
}

export function analyzePlayers(players: Run[], bots: Run[], goals: { item: string; text: string }[]): PlayersAnalysis {
  const stats: GoalStat[] = goals.map((g) => {
    const known = players.map((p) => p.discovered[g.item]).filter((x): x is number => x !== undefined)
    const early = players.filter((p) => p.discovered[g.item] === undefined && p.preexisting.includes(g.item)).length // atteint avant l'enregistrement : date inconnue
    const botMedian = median(bots.map((b) => b.discovered[g.item]).filter((x): x is number => x !== undefined))
    const med = median(known)
    const reached = known.length + early
    const ratio = med !== undefined && botMedian ? med / botMedian : undefined
    let verdict = 'ok'
    if (players.length && reached / players.length < WALL_BELOW) verdict = `MUR ? ${Math.round((100 * reached) / players.length)} % y arrivent`
    else if (ratio !== undefined && ratio > SLOW_ABOVE) verdict = `lent ×${ratio.toFixed(1)}`
    else if (ratio !== undefined && ratio < FAST_BELOW) verdict = `rapide ×${(1 / ratio).toFixed(1)}`
    else if (botMedian === undefined) verdict = 'pas de repère bot'
    return { item: g.item, text: g.text, reached, total: players.length, median: med, botMedian, ratio, verdict }
  })

  const lastGoal: Record<string, number> = {}
  for (const p of players) {
    const last = [...goals].reverse().find((g) => p.discovered[g.item] !== undefined || p.preexisting.includes(g.item))
    const key = last?.text ?? 'aucun'
    lastGoal[key] = (lastGoal[key] ?? 0) + 1
  }
  const returned = players.filter((p) => p.sessions.some((s) => s.startedAt - p.sessions[0].startedAt >= 20 * 3600 * 1000)).length
  return {
    goals: stats,
    summary: {
      count: players.length,
      finished: players.filter((p) => p.victoryAt !== undefined).length,
      medianMinutes: (median(players.map((p) => p.seconds)) ?? 0) / 60,
      medianSessions: median(players.map((p) => p.sessions.length)) ?? 0,
      returned,
      rejectedPer10Min: median(players.map((p) => (p.seconds > 0 ? (p.counters.rejected / p.seconds) * 600 : 0))) ?? 0,
      dockFullMedian: median(players.map((p) => p.counters.dockFull)) ?? 0,
      lastGoal,
    },
  }
}

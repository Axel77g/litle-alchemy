// Joueur de référence du monde 1 : un bot glouton qui joue avec le VRAI store (mêmes règles que le jeu : production, nuit, auras, prix des cases).
// Il sert à estimer des durées, pas à trouver la meilleure stratégie : il ne pose pas de feux de camp supplémentaires et ne place rien pour
// profiter des auras au mieux. Ses temps sont donc plutôt pessimistes ; un joueur malin ira plus vite.
// Un autre monde aura sa propre politique (les décisions dépendent des recettes) : le moteur de mesure, lui, est commun.
import { world1 } from '../../src/content/world1'
import { createWorld1Bot, startNewGame } from '../../src/autoplay/world1Bot'
import { catchUp } from '../../src/engine/offline'
import { onGameEvent } from '../../src/engine/events'
import { shellRate } from '../../src/engine/production'
import { createRecorder } from '../../src/telemetry/recorder'
import type { Run } from '../../src/telemetry/schema'
import { seenIds, storeSnapshot } from '../../src/telemetry/snapshot'
import { balanceVersion } from '../../src/telemetry/version'
import { useGame } from '../../src/store/game'

// La mesure (échantillons, découvertes, compteurs) vient du recorder partagé avec les joueurs : même code des deux côtés.
// On y ajoute ce qui est propre à une simulation.
export type RunResult = Run & {
  millionAt?: number // premier instant où le compteur a atteint le seuil, même si des items manquaient
  finalShells: number
  finalRate: number
  simulated: number // secondes de jeu actif simulées
  wallSeconds: number // secondes écoulées au total (jeu actif + absences) quand la partie s'arrête
  wallAtVictory?: number // idem, à la fin du monde
  board: Record<string, number> // ce qui est posé à la fin
  cellsBought: number
  log: string[]
  firstPlaced: Record<string, number> // premier instant (jeu actif) où chaque producteur a été posé sur l'île
}

export const POLICY = 'world1-greedy-v2'

// rhythm : le joueur joue `activeSeconds`, s'absente `awaySeconds` (l'île produit à OFFLINE_EFFICIENCY), et recommence. Sans rhythm : il joue en continu.
export interface Rhythm {
  activeSeconds: number
  awaySeconds: number
}

export function runWorld1(opts: { maxSeconds: number; step: number; rhythm?: Rhythm; maxWallSeconds?: number }): RunResult {
  startNewGame()
  const G = useGame
  const s = () => G.getState()
  const cells = () => [...s().world.values()]
  const log: string[] = []
  let t = 0
  const say = (m: string) => log.push(`${String(Math.round(t)).padStart(5)} s  ${m}`)

  const rec = createRecorder(
    { now: () => t, snapshot: storeSnapshot, seen: seenIds },
    { source: 'bot', policy: POLICY, worldId: world1.id, balanceVersion: balanceVersion(), startedFresh: true },
  )
  const discovered = rec.run.discovered
  // Le journal lisible ne sert qu'au débogage du bot
  const firstPlaced: Record<string, number> = {}
  const unsubscribe = onGameEvent((e) => {
    if (e.type === 'entityPlaced') firstPlaced[e.entity.itemId] ??= t
    if (e.type === 'discovered') say(`découvert : ${s().rules.items[e.itemId]?.name ?? e.itemId}`)
  })

  const bot = createWorld1Bot(() => t, say)
  const step = bot.step

  let millionAt: number | undefined
  let wall = 0
  let wallAtVictory: number | undefined
  let sessionStart = 0
  const target = world1.finale.shells
  const maxWall = opts.maxWallSeconds ?? Infinity
  const noteVictory = () => {
    if (wallAtVictory === undefined && rec.run.victoryAt !== undefined) wallAtVictory = wall
  }
  for (t = 0; t <= opts.maxSeconds && wall <= maxWall && rec.run.victoryAt === undefined; t += opts.step) {
    step()
    s().advance(opts.step)
    wall += opts.step
    if (millionAt === undefined && s().shells >= target) millionAt = t
    if (Math.round(t) % 10 === 0 || t === 0) rec.sample()
    noteVictory()
    if (opts.rhythm && rec.run.victoryAt === undefined && t - sessionStart >= opts.rhythm.activeSeconds) {
      // Absence : la production tourne (au tarif hors-ligne) sans aucun geste. Par tranches pour dater la fin du monde si elle tombe pendant l'absence.
      sessionStart = t
      const { effective } = catchUp(opts.rhythm.awaySeconds)
      const chunks = Math.max(1, Math.ceil(opts.rhythm.awaySeconds / 600))
      for (let i = 0; i < chunks && rec.run.victoryAt === undefined; i++) {
        s().advance(effective / chunks)
        wall += opts.rhythm.awaySeconds / chunks
        if (millionAt === undefined && s().shells >= target) millionAt = t
        noteVictory()
      }
    }
  }
  unsubscribe()
  const run = rec.stop()
  run.seconds = t
  const board: Record<string, number> = {}
  for (const c of cells()) if (c.entity) board[c.entity.itemId] = (board[c.entity.itemId] ?? 0) + 1
  return { ...run, millionAt, finalShells: s().shells, finalRate: shellRate(s().rules, s().world, s().night), simulated: t, wallSeconds: wall, wallAtVictory, firstPlaced, board, cellsBought: bot.cellsBought, log }
}

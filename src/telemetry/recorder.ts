// Cœur de l'enregistrement d'une partie. Aucune dépendance au navigateur : il tourne aussi sous Node (c'est ce qui permet au bot de s'en servir).
// Deux choses lui sont injectées :
//  - l'horloge now() : le temps réel pour un joueur, le temps simulé pour le bot (qui appelle store.advance(), sans attendre) ;
//  - snapshot() : l'état à échantillonner.
// Il écoute le bus d'événements du moteur ; c'est l'appelant qui décide QUAND échantillonner (setInterval pour un joueur, un pas simulé pour le bot).
import { onGameEvent } from '../engine/events'
import { SCHEMA_VERSION, type Counters, type Run, type Sample } from './schema'

export interface RecorderDeps {
  now(): number
  snapshot(): Omit<Sample, 't'>
  seen(): string[] // items déjà connus au moment de créer la partie
}

export interface RecorderMeta {
  source: Run['source']
  policy?: string
  worldId: string
  balanceVersion: string
  startedFresh: boolean
}

const MAX_SAMPLES = 2000 // au-delà, on garde un échantillon sur deux : l'historique reste entier mais plus grossier
const DOCK_FULL_GAP = 5 // s : deux « dock plein » plus rapprochés font un seul épisode

export const emptyCounters = (): Counters => ({ merges: 0, placements: 0, sells: 0, cellsBought: 0, dockFull: 0, rejected: 0 })

export function createRecorder(deps: RecorderDeps, meta: RecorderMeta, resume?: Run) {
  const known = deps.seen()
  const run: Run = resume ?? {
    schema: SCHEMA_VERSION,
    source: meta.source,
    policy: meta.policy,
    worldId: meta.worldId,
    balanceVersion: meta.balanceVersion,
    startedAt: Date.now(),
    startedFresh: meta.startedFresh,
    seconds: 0,
    samples: [],
    discovered: Object.fromEntries(meta.startedFresh ? known.map((id) => [id, 0]) : []),
    preexisting: known,
    counters: emptyCounters(),
    sessions: [],
  }
  let lastDockFull = -Infinity

  const off = onGameEvent((e) => {
    const t = deps.now()
    switch (e.type) {
      case 'discovered':
        run.discovered[e.itemId] ??= t
        break
      case 'victory':
        run.victoryAt ??= t
        break
      case 'merged':
        run.counters.merges++
        break
      case 'entityPlaced':
        run.counters.placements++
        break
      case 'sold':
        run.counters.sells++
        break
      case 'cellBought':
        run.counters.cellsBought++
        break
      case 'actionRejected':
        run.counters.rejected++
        break
      case 'dockFull':
        // émis à chaque tick tant que c'est plein : on compte des épisodes
        if (t - lastDockFull > DOCK_FULL_GAP) run.counters.dockFull++
        lastDockFull = t
        break
    }
  })

  return {
    run,
    sample() {
      run.samples.push({ t: deps.now(), ...deps.snapshot() })
      if (run.samples.length > MAX_SAMPLES) run.samples = run.samples.filter((_, i, a) => i % 2 === 0 || i === a.length - 1)
    },
    stop() {
      off()
      return run
    },
  }
}

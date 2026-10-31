// Télémétrie côté joueur : enregistre sa partie (même format que le bot de tools/balance) et la garde dans localStorage.
// RIEN NE QUITTE L'APPAREIL : ni envoi, ni identifiant. L'envoi (et le consentement qu'il exige) viendra dans une étape séparée.
// La partie se poursuit d'une session à l'autre tant que la sauvegarde et les règles du monde sont les mêmes (voir balanceVersion).
import { loadSave } from '../store/persist'
import { useGame } from '../store/game'
import { createRecorder } from './recorder'
import { isRun, type Run } from './schema'
import { seenIds, storeSnapshot } from './snapshot'
import { balanceVersion } from './version'

const KEY = 'little-alchemy-telemetry'
const OFF_KEY = 'little-alchemy-telemetry-off'
const MAX_RUNS = 5 // on garde les dernières parties (une nouvelle commence quand le jeu change ou que la sauvegarde est effacée)
const SAMPLE_EVERY = 10 // s de jeu actif entre deux échantillons
const PERSIST_EVERY = 10

let runs: Run[] = []

function read(): Run[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter(isRun) : []
  } catch {
    return []
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(runs.slice(-MAX_RUNS)))
  } catch {
    /* stockage plein ou indisponible : on perd l'historique, jamais la partie */
  }
}

export function isTelemetryEnabled() {
  try {
    return localStorage.getItem(OFF_KEY) !== '1'
  } catch {
    return true
  }
}

export function setTelemetryEnabled(enabled: boolean) {
  try {
    if (enabled) localStorage.removeItem(OFF_KEY)
    else localStorage.setItem(OFF_KEY, '1')
  } catch {
    /* sans stockage, le choix vaut pour cette session seulement */
  }
}

export const getRuns = (): Run[] => runs

export function clearTelemetry() {
  runs = []
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* rien à faire */
  }
}

// Télécharge les parties enregistrées (le fichier est lu par `npm run balance -- --players fichier.json`)
export function downloadRuns() {
  const url = URL.createObjectURL(new Blob([JSON.stringify(runs, null, 1)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `parties-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function initTelemetry() {
  if (!isTelemetryEnabled()) return
  const game = useGame.getState()
  const version = balanceVersion()
  // À lire ICI : l'autosave n'a pas encore tourné, la sauvegarde est donc celle de la session précédente (ou absente : partie neuve)
  const save = loadSave(game.rules, game.worldId)
  runs = read()
  const last = runs.at(-1)
  const resume = last && save && last.source === 'human' && last.worldId === game.worldId && last.balanceVersion === version ? last : undefined

  let seconds = resume?.seconds ?? 0
  const rec = createRecorder(
    { now: () => seconds, snapshot: storeSnapshot, seen: seenIds },
    { source: 'human', worldId: game.worldId, balanceVersion: version, startedFresh: !save },
    resume,
  )
  if (!resume) runs.push(rec.run)
  const session = { startedAt: Date.now(), seconds: 0, offlineSeconds: save ? Math.max(0, (Date.now() - save.savedAt) / 1000) : 0 }
  rec.run.sessions.push(session)
  rec.sample()

  let lastTick = performance.now()
  let sinceSample = 0
  let sincePersist = 0
  setInterval(() => {
    const now = performance.now()
    const dt = Math.min(2, (now - lastTick) / 1000) // un ordinateur en veille ne compte pas comme du jeu
    lastTick = now
    if (document.hidden) return // temps de jeu ACTIF : onglet visible seulement
    seconds += dt
    rec.run.seconds = seconds
    session.seconds += dt
    sinceSample += dt
    sincePersist += dt
    if (sinceSample >= SAMPLE_EVERY) {
      sinceSample = 0
      rec.sample()
    }
    if (sincePersist >= PERSIST_EVERY) {
      sincePersist = 0
      persist()
    }
  }, 1000)
  const flush = () => persist()
  document.addEventListener('visibilitychange', () => document.hidden && flush())
  window.addEventListener('pagehide', flush)
  persist()
}

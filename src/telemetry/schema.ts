// Format commun d'une partie enregistrée. Un humain et le bot de tools/balance produisent exactement le même : c'est ce qui permet de les comparer.
// Le temps `t` est le TEMPS DE JEU ACTIF en secondes (onglet visible). Le gain hors-ligne n'y est pas compté : il apparaît comme un saut
// de coquillages entre deux échantillons, et la durée de l'absence est notée dans `sessions`.
export const SCHEMA_VERSION = 1

export interface Sample {
  t: number
  shells: number
  rate: number // coquillages par seconde à cet instant
  cells: number // taille de l'île
  producers: number // producteurs posés
  cards: number // cartes dans le dock
}

export interface Counters {
  merges: number // fusions réussies (dock, item sur producteur, producteurs entre eux)
  placements: number
  sells: number
  cellsBought: number
  dockFull: number // épisodes où le dock plein a bloqué la production (pas le nombre de ticks)
  rejected: number // cartes lâchées sur une cible qui les a refusées : un signal de confusion
}

export interface SessionInfo {
  startedAt: number // Date.now()
  seconds: number // temps de jeu actif pendant cette session
  offlineSeconds: number // temps passé hors du jeu avant cette session (0 si c'est la première)
}

export interface Run {
  schema: number
  source: 'bot' | 'human'
  policy?: string // bot : nom et version de la politique
  worldId: string
  balanceVersion: string // empreinte des données du monde : elle change dès qu'un chiffre d'équilibrage change
  startedAt: number
  startedFresh: boolean // l'enregistrement a commencé sur une partie toute neuve (sinon `preexisting` n'a pas de date)
  seconds: number // temps de jeu actif total
  samples: Sample[]
  discovered: Record<string, number> // premier instant où chaque item a été obtenu
  preexisting: string[] // items déjà connus quand l'enregistrement a commencé
  victoryAt?: number
  counters: Counters
  sessions: SessionInfo[]
}

// Contrôle minimal avant de lire un fichier venu de l'extérieur
export function isRun(x: unknown): x is Run {
  const r = x as Run | null
  return !!r && typeof r === 'object' && r.schema === SCHEMA_VERSION && (r.source === 'bot' || r.source === 'human') && typeof r.worldId === 'string' && Array.isArray(r.samples) && typeof r.discovered === 'object' && !!r.counters
}

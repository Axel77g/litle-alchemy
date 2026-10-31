// Effets visuels éphémères (hors données du monde : ne déclenchent aucun re-rendu React).
// triggerImpact() enregistre une onde de choc ; chaque Tile lit waveOffset() à chaque frame.

interface Impact {
  x: number
  z: number
  radius: number
  start: number // performance.now() en ms
}

const WAVE_SPEED = 7 // cases par seconde
const WAVE_DURATION = 0.55 // durée du soulèvement d'une case, en secondes
const WAVE_AMPLITUDE = 0.28 // hauteur du soulèvement au centre

let impacts: Impact[] = []

export const triggerImpact = (x: number, z: number, radius = 3) => {
  impacts.push({ x, z, radius, start: performance.now() })
}

export const hasImpacts = () => impacts.length > 0

// Décalage vertical (en unités 3D) de la case (x, z) à l'instant now, somme de toutes les ondes actives
export function waveOffset(x: number, z: number, now = performance.now()): number {
  if (impacts.length === 0) return 0
  let offset = 0
  for (const imp of impacts) {
    const d = Math.hypot(x - imp.x, z - imp.z)
    if (d > imp.radius) continue
    const t = (now - imp.start) / 1000 - d / WAVE_SPEED // l'onde arrive plus tard quand on est loin
    if (t < 0 || t > WAVE_DURATION) continue
    const falloff = 1 - d / (imp.radius + 1) // plus faible en s'éloignant
    offset += WAVE_AMPLITUDE * falloff * Math.sin((Math.PI * t) / WAVE_DURATION)
  }
  return offset
}

// Supprime les ondes terminées (appelé une fois par frame)
export function pruneImpacts(now = performance.now()) {
  if (impacts.length === 0) return
  impacts = impacts.filter((i) => (now - i.start) / 1000 < WAVE_DURATION + i.radius / WAVE_SPEED)
}

// --- Chute d'un objet posé ---
export const DROP_HEIGHT = 9
export const DROP_TIME = 0.5 // secondes de chute

// --- Registre des chutes : entité (id) -> instant de pose. Rempli par initFx() depuis les événements du moteur.
const drops = new Map<string, number>()
export const dropStart = (entityId: string) => drops.get(entityId)
// `at` : instant du début de la chute (peut être dans le futur : l'objet attend, invisible, que sa case ait atterri)
export const registerDrop = (entityId: string, at = performance.now()) => drops.set(entityId, at)
export const forgetDrop = (entityId: string) => drops.delete(entityId)

// --- Pop : un producteur « saute » quand il vient de produire. entité (id) -> instant de la dernière production.
const pops = new Map<string, number>()
export const popStart = (entityId: string) => pops.get(entityId)
export const triggerPop = (entityId: string) => pops.set(entityId, performance.now())
export const forgetPop = (entityId: string) => pops.delete(entityId)
export const POP_DURATION = 0.42 // secondes

// --- Chute d'une case achetée : "x,z" -> instant de l'achat
const tileDrops = new Map<string, number>()
export const tileDropStart = (x: number, z: number) => tileDrops.get(`${x},${z}`)
export const registerTileDrop = (x: number, z: number) => tileDrops.set(`${x},${z}`, performance.now())
export const forgetTileDrop = (x: number, z: number) => tileDrops.delete(`${x},${z}`)
export const hasTileDrops = () => tileDrops.size > 0
export const TILE_DROP_HEIGHT = 8
export const TILE_DROP_TIME = 0.5

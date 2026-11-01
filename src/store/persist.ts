// Sauvegarde dans localStorage (le jeu fonctionne aussi sans : tout est protégé par try/catch).
import { deserialize, serialize } from '../engine/save'
import type { Ruleset } from '../engine/items'

const KEY = 'little-alchemy-save'

export function loadSave(rules: Ruleset, worldId: string) {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? deserialize(rules, worldId, JSON.parse(raw)) : undefined
  } catch {
    return undefined
  }
}

// Coupe toute écriture : un reset doit pouvoir effacer la sauvegarde sans que la fermeture de la page (beforeunload) ne la réécrive
let disabled = false
export const disableSaving = () => void (disabled = true)

export function writeSave(worldId: string, data: Parameters<typeof serialize>[1]) {
  if (disabled) return
  try {
    localStorage.setItem(KEY, JSON.stringify(serialize(worldId, data)))
  } catch {
    /* stockage plein ou indisponible : on ignore */
  }
}

export const clearSave = () => {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* rien à faire */
  }
}

// Une sauvegarde existe-t-elle ? (écran d'accueil : « Reprendre »)
export const hasSave = () => {
  try {
    return localStorage.getItem(KEY) !== null
  } catch {
    return false
  }
}

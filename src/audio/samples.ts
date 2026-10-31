// Chargement des fichiers audio du manifest : récupérés et décodés une fois, puis gardés en mémoire.
import { getContext } from './engine'

const buffers = new Map<string, AudioBuffer>()
const pending = new Set<string>()
const warned = new Set<string>()

export const urlOf = (path: string) => `${import.meta.env.BASE_URL}audio/${path}`
export const bufferOf = (path: string) => buffers.get(path)

function warnOnce(path: string) {
  if (warned.has(path)) return
  warned.add(path)
  console.warn(`[audio] "${path}" introuvable ou illisible dans public/audio/`)
}

// Lance le chargement (sans attendre). Un fichier manquant n'est pas une erreur : le son reste muet.
export function preload(paths: readonly string[]) {
  const ctx = getContext()
  if (!ctx) return
  for (const path of paths) {
    if (buffers.has(path) || pending.has(path)) continue
    pending.add(path)
    fetch(urlOf(path))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => ctx.decodeAudioData(data)) // en dev, un fichier absent renvoie index.html : le décodage échoue ici
      .then((buffer) => void buffers.set(path, buffer))
      .catch(() => warnOnce(path))
      .finally(() => pending.delete(path))
  }
}

// Variante au hasard parmi les fichiers déjà chargés, sans répéter la précédente quand il y a le choix
const last = new Map<string, string>()
export function pickLoaded(key: string, files: readonly string[]): AudioBuffer | undefined {
  const ready = files.filter((f) => buffers.has(f))
  if (ready.length === 0) return undefined
  const choices = ready.length > 1 ? ready.filter((f) => f !== last.get(key)) : ready
  const file = choices[Math.floor(Math.random() * choices.length)]
  last.set(key, file)
  return buffers.get(file)
}

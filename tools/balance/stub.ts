// Le store lit localStorage au démarrage (sauvegarde) : hors navigateur il n'existe pas.
// Ce fichier doit être importé EN PREMIER, avant tout module qui touche au store.
const memory = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
} as unknown as Storage

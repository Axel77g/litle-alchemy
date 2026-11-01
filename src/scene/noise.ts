// Bruit déterministe pour désynchroniser les personnages : chacun tire sa graine de l'id de son entité (stable d'une image à l'autre).

// Hash FNV-1a d'une chaîne -> [0, 1[. `salt` donne plusieurs valeurs indépendantes pour un même id.
export function hash01(text: string, salt = 0): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  h ^= h >>> 13
  h = Math.imul(h, 0x5bd1e995)
  h ^= h >>> 15
  return (h >>> 0) / 4294967296
}

const lattice = (i: number, seed: number) => hash01(String(i), Math.floor(seed * 1e6))

// Bruit de valeur 1D lissé, dans [-1, 1] : varie doucement avec `t`, différent pour chaque `seed` ([0, 1[).
export function noise1(t: number, seed: number): number {
  const i = Math.floor(t)
  const f = t - i
  const u = f * f * (3 - 2 * f)
  return (lattice(i, seed) * (1 - u) + lattice(i + 1, seed) * u) * 2 - 1
}

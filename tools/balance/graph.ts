// Analyse statique d'un monde : à partir des seules données (items, recettes, productions, état de départ), sans jouer.
// Calcule pour chaque item le temps de RÉFÉRENCE avant de l'obtenir, le chemin critique, les impasses et la structure du graphe.
//
// Modèle (volontairement simple, donc lisible) :
//  - les actions du joueur sont instantanées et il a assez de place ;
//  - chaque producteur existe en autant d'exemplaires que sur la carte de départ (1 s'il faut d'abord le fabriquer) ;
//  - aucun bonus (aura, nuit, frénésie) et aucune concurrence entre deux chaînes pour un même item.
// Ce n'est donc ni un minimum ni un maximum : c'est un point de repère. Le temps réel vient de la simulation (bot-world1.ts).
import { SHELL, type Ruleset } from '../../src/engine/items'
import type { ItemId } from '../../src/engine/types'

export interface StartState {
  inventory: Record<ItemId, number>
  board: Record<ItemId, number> // producteurs déjà posés sur la carte de départ
  terrains: Record<string, number> // nombre de cases de chaque terrain (ex : WATER)
}

export type Way =
  | { kind: 'start' }
  | { kind: 'recipe'; inputs: ItemId[] }
  | { kind: 'producer'; producer: ItemId; every: number; amount: number }
  | { kind: 'terrain'; terrain: string; every: number }

export interface Timed {
  t: number
  way: Way
}

export interface PathStep {
  id: string
  t: number
  way: Way
}

export interface GraphNode {
  id: string
  name: string
  kind: string
  first: number // temps de référence (s) pour en avoir un exemplaire
  way: Way
  depth: number // nombre d'étapes depuis le départ (sert à ranger le graphe en colonnes)
  usedInRecipes: number
  flags: string[] // ex : « impasse », « inaccessible »
}

export interface GraphEdge {
  from: string
  to: string
  kind: 'recipe' | 'produces' | 'terrain'
  label?: string
}

export interface Analysis {
  nodes: GraphNode[]
  edges: GraphEdge[]
  solve: (id: ItemId, n?: number) => Timed
  criticalPath: (id: ItemId) => PathStep[]
}

export function analyze(rules: Ruleset, start: StartState, finaleRequires: ItemId[]): Analysis {
  const have: Record<string, number> = {}
  for (const src of [start.inventory, start.board]) for (const [id, n] of Object.entries(src)) have[id] = (have[id] ?? 0) + n

  const producersOf: Record<string, { producer: ItemId; every: number; amount: number }[]> = {}
  for (const it of Object.values(rules.items))
    for (const p of it.production ?? []) if (p.output !== SHELL) (producersOf[p.output] ??= []).push({ producer: it.id, every: p.every, amount: p.amount ?? 1 })
  const terrainOf: Record<string, { terrain: string; count: number; every: number; amount: number }[]> = {}
  for (const [terrain, list] of Object.entries(rules.terrainProduction))
    for (const p of list ?? []) if (p.output !== SHELL && (start.terrains[terrain] ?? 0) > 0) (terrainOf[p.output] ??= []).push({ terrain, count: start.terrains[terrain], every: p.every, amount: p.amount ?? 1 })
  const recipesFor: Record<string, ItemId[][]> = {}
  for (const r of rules.recipes) (recipesFor[r.result] ??= []).push(r.inputs)

  const memo = new Map<string, Timed>()
  const stack = new Set<string>()
  const never: Timed = { t: Infinity, way: { kind: 'start' } }

  // Plus tôt, combien de secondes pour avoir n exemplaires de `id` ?
  function solve(id: ItemId, n = 1): Timed {
    const owned = have[id] ?? 0
    if (n <= owned) return { t: 0, way: { kind: 'start' } }
    const key = `${id}#${n}`
    const cached = memo.get(key)
    if (cached) return cached
    if (stack.has(key)) return never // cycle : cette branche ne mène nulle part
    stack.add(key)
    const k = n - owned
    let best = never
    for (const p of producersOf[id] ?? []) {
      const t = solve(p.producer, 1).t + Math.ceil(k / (p.amount * Math.max(1, have[p.producer] ?? 0))) * p.every
      if (t < best.t) best = { t, way: { kind: 'producer', producer: p.producer, every: p.every, amount: p.amount } }
    }
    for (const p of terrainOf[id] ?? []) {
      const t = Math.ceil(k / (p.amount * p.count)) * p.every
      if (t < best.t) best = { t, way: { kind: 'terrain', terrain: p.terrain, every: p.every } }
    }
    for (const inputs of recipesFor[id] ?? []) {
      const need = new Map<ItemId, number>()
      for (const inp of inputs) need.set(inp, (need.get(inp) ?? 0) + 1)
      let t = 0
      for (const [inp, c] of need) t = Math.max(t, solve(inp, c * k).t)
      if (t < best.t) best = { t, way: { kind: 'recipe', inputs } }
    }
    stack.delete(key)
    memo.set(key, best)
    return best
  }

  // Ce qui retarde le plus : on remonte, à chaque étape, l'ingrédient le plus long à obtenir
  function criticalPath(id: ItemId): PathStep[] {
    const path: PathStep[] = []
    let cur = id
    let n = 1
    for (let guard = 0; guard < 40; guard++) {
      const r = solve(cur, n)
      path.push({ id: cur, t: r.t, way: r.way })
      if (r.way.kind === 'producer') {
        cur = r.way.producer
        n = 1
      } else if (r.way.kind === 'recipe') {
        const k = Math.max(1, n - (have[cur] ?? 0))
        const need = new Map<ItemId, number>()
        for (const inp of r.way.inputs) need.set(inp, (need.get(inp) ?? 0) + 1)
        let worst: [ItemId, number] | undefined
        let worstT = -1
        for (const [inp, c] of need) {
          const t = solve(inp, c * k).t
          if (t > worstT) [worst, worstT] = [[inp, c * k], t]
        }
        if (!worst || worstT <= 0) break
        ;[cur, n] = worst
      } else break
    }
    return path
  }

  const depthMemo = new Map<string, number>()
  const depth = (id: ItemId, seen = new Set<string>()): number => {
    if (depthMemo.has(id)) return depthMemo.get(id)!
    if (seen.has(id)) return 0
    seen.add(id)
    const w = solve(id, 1).way
    const d = w.kind === 'recipe' ? 1 + Math.max(0, ...w.inputs.map((i) => depth(i, seen))) : w.kind === 'producer' ? 1 + depth(w.producer, seen) : w.kind === 'terrain' ? 1 : 0
    depthMemo.set(id, d)
    return d
  }

  const usedAsInput = new Map<string, number>()
  for (const r of rules.recipes) for (const i of new Set(r.inputs)) usedAsInput.set(i, (usedAsInput.get(i) ?? 0) + 1)

  const nodes: GraphNode[] = Object.values(rules.items).map((it) => {
    const r = solve(it.id, 1)
    const flags: string[] = []
    if (!Number.isFinite(r.t)) flags.push('inaccessible')
    const useful = usedAsInput.has(it.id) || finaleRequires.includes(it.id) || it.frenzy || it.flood || it.kind === 'producer'
    if (!useful) flags.push('impasse')
    return { id: it.id, name: it.name, kind: it.kind, first: r.t, way: r.way, depth: depth(it.id), usedInRecipes: usedAsInput.get(it.id) ?? 0, flags }
  })

  const edges: GraphEdge[] = []
  for (const r of rules.recipes) for (const i of new Set(r.inputs)) edges.push({ from: i, to: r.result, kind: 'recipe', label: r.inputs.filter((x) => x === i).length > 1 ? `×${r.inputs.filter((x) => x === i).length}` : undefined })
  for (const it of Object.values(rules.items)) for (const p of it.production ?? []) if (p.output !== SHELL) edges.push({ from: it.id, to: p.output, kind: 'produces', label: `${p.every}s` })
  for (const [terrain, list] of Object.entries(rules.terrainProduction))
    for (const p of list ?? []) {
      if (p.output === SHELL || !(start.terrains[terrain] ?? 0)) continue
      nodes.push({ id: `terrain:${terrain}`, name: `Bloc ${terrain === 'WATER' ? "d'eau" : terrain}`, kind: 'terrain', first: 0, way: { kind: 'start' }, depth: 0, usedInRecipes: 0, flags: [] })
      edges.push({ from: `terrain:${terrain}`, to: p.output, kind: 'terrain', label: `${p.every}s` })
    }
  return { nodes, edges, solve, criticalPath }
}

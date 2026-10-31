// Outil d'équilibrage : npm run balance [-- --seed 1 --runs 5 --max-hours 8 --shells 5000000 --out balance-report]
// --shells remplace, pour cette mesure seulement, le seuil de coquillages de la fin du monde (« et si l'objectif était plus gros ? »).
// 1. analyse le graphe des items (temps de référence, chemin critique, impasses) à partir des seules données du monde ;
// 2. fait jouer un bot de référence avec les vraies règles et mesure : découvertes, revenu, temps pour finir ;
// 3. écrit un rapport HTML (graphes) et un JSON, et résume le tout dans la console.
import './stub' // doit rester le premier import
import { mkdirSync, writeFileSync } from 'node:fs'
import { world1 } from '../../src/content/world1'
import { runWorld1 } from './bot-world1'
import { analyze, type PathStep, type StartState } from './graph'
import { renderReport } from './report'

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback
}
const seed = Number(arg('seed', '1'))
const maxSeconds = Number(arg('max-hours', '8')) * 3600
const out = arg('out', 'balance-report')

const runs = Number(arg('runs', '5'))
if (arg('shells', '')) world1.finale.shells = Number(arg('shells', ''))

// Reproductible : l'achat d'une case tire au hasard le producteur qui y apparaît
const seedRandom = (seed: number) => {
  let state = seed >>> 0
  Math.random = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let x = Math.imul(state ^ (state >>> 15), 1 | state)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

export const duration = (s: number) => {
  if (!Number.isFinite(s)) return 'jamais'
  if (s < 60) return `${Math.round(s)} s`
  if (s < 3600) return `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')} s`
  return `${Math.floor(s / 3600)} h ${String(Math.round((s % 3600) / 60)).padStart(2, '0')} min`
}

const rules = world1.rules
const finale = world1.finale
const start: StartState = { inventory: world1.startingInventory, board: {}, terrains: {} }
for (const id of world1.objects.flat()) if (id) start.board[id] = (start.board[id] ?? 0) + 1
for (const v of world1.ground.flat()) if (v === 2) start.terrains.WATER = (start.terrains.WATER ?? 0) + 1

// --- 1. graphe ---
const graph = analyze(rules, start, finale.requires)
const name = (id: string) => rules.items[id]?.name ?? id
const pathText = (steps: PathStep[]) => steps.map((p) => `${name(p.id)} (${duration(p.t)})`).join(' ← ')
const dead = graph.nodes.filter((n) => n.flags.length)

console.log(`\n=== ${world1.name} : fin du monde « ${finale.text} » ===`)
console.log(`${graph.nodes.length} nœuds, ${graph.edges.length} liens.`)
console.log('\n-- Graphe (temps de référence : 1 exemplaire de chaque producteur, sans bonus) --')
for (const id of finale.requires) console.log(`  ${name(id).padEnd(10)} ${duration(graph.solve(id).t).padStart(9)}   chemin critique : ${pathText(graph.criticalPath(id))}`)
console.log(dead.length ? `  Problèmes : ${dead.map((n) => `${n.name} (${n.flags.join(', ')})`).join(' ; ')}` : '  Aucune impasse, tout est accessible.')

// --- 2. bot : plusieurs parties, graines différentes ---
console.log(`\n-- Bot de référence (${runs} parties, graines ${seed}..${seed + runs - 1}, jusqu'à ${duration(maxSeconds)} chacune) --`)
const t0 = Date.now()
const results = Array.from({ length: runs }, (_, i) => {
  seedRandom(seed + i)
  return runWorld1({ maxSeconds, step: 2 })
})
const run = results[0]
const itemsAtOf = (r: (typeof results)[number]) => {
  const at = finale.requires.map((id) => r.discovered[id])
  return at.every((x) => x !== undefined) ? Math.max(...(at as number[])) : undefined
}
const projectedOf = (r: (typeof results)[number]) => r.victoryAt ?? (r.finalRate > 0 ? r.simulated + (finale.shells - r.finalShells) / r.finalRate : Infinity)
const itemsAt = itemsAtOf(run)
const projected = projectedOf(run)
console.log(`  (calculé en ${((Date.now() - t0) / 1000).toFixed(1)} s)`)
console.log('\n  Première partie, objectifs :')
for (const g of world1.goals) console.log(`  ${(run.discovered[g.item] === undefined ? 'non visé' : duration(run.discovered[g.item])).padStart(10)}  ${g.text}`)
console.log(`\n  Items de la fin découverts à : ${itemsAt === undefined ? 'jamais' : duration(itemsAt)}`)
for (const m of [5, 10, 20, 30, 60]) {
  const smp = run.samples.find((x) => x.t >= m * 60)
  if (smp) console.log(`  à ${String(m).padStart(3)} min : ${Math.round(smp.shells).toLocaleString('fr-FR').padStart(11)} 🐚 en caisse, ${Math.round(smp.rate).toLocaleString('fr-FR').padStart(7)} 🐚/s`)
}
const finishes = results.map(projectedOf).sort((a, b) => a - b)
const reachedAll = results.every((r) => r.victoryAt !== undefined)
console.log(`\n  ${reachedAll ? 'FIN DU MONDE' : 'Fin (extrapolée pour les parties non terminées)'} : min ${duration(finishes[0])} · médiane ${duration(finishes[Math.floor(finishes.length / 2)])} · max ${duration(finishes[finishes.length - 1])}`)
console.log(`  Île finale (partie 1) : ${Object.entries(run.board).map(([id, n]) => `${n}× ${name(id)}`).join(', ')} (${run.cellsBought} cases achetées)`)

// --- 3. rapport ---
mkdirSync(out, { recursive: true })
writeFileSync(`${out}/index.html`, renderReport({ worldName: world1.name, finale, graph, results, itemsAt: results.map(itemsAtOf), finishes: results.map(projectedOf), seed, rules, goals: world1.goals }))
writeFileSync(`${out}/data.json`, JSON.stringify({ world: world1.id, seed, finale, nodes: graph.nodes, edges: graph.edges, discovered: run.discovered, finishes: results.map(projectedOf), samples: run.samples }, null, 1))
console.log(`\nRapport : ${out}/index.html\n`)

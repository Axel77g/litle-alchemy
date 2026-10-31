// Rapport HTML autonome (SVG écrit à la main, aucune bibliothèque) : s'ouvre hors ligne, dans n'importe quel navigateur.
import type { Finale } from '../../src/engine/finale'
import type { Ruleset } from '../../src/engine/items'
import type { RunResult } from './bot-world1'
import type { Run } from '../../src/telemetry/schema'
import type { Analysis, GraphNode } from './graph'
import type { PlayersAnalysis } from './players'

export interface ReportInput {
  worldName: string
  finale: Finale
  graph: Analysis
  results: RunResult[]
  itemsAt: (number | undefined)[]
  finishes: number[]
  seed: number
  rules: Ruleset
  goals: { item: string; text: string }[]
  players: Run[] // vraies parties (vide si --players n'est pas utilisé)
  playerAnalysis?: PlayersAnalysis
  ignored?: string // pourquoi certaines parties ont été écartées
  rhythm?: { label: string; wall: number[]; active: number[] } // le bot avec sessions et absences : durée en jours
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const dur = (s: number | undefined) => {
  if (s === undefined || !Number.isFinite(s)) return '—'
  if (s < 60) return `${Math.round(s)} s`
  if (s < 3600) return `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')}`
  return `${Math.floor(s / 3600)} h ${String(Math.round((s % 3600) / 60)).padStart(2, '0')}`
}
const num = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k` : String(Math.round(n)))

interface Mark {
  t: number
  label: string
}
interface ChartOpts {
  title: string
  note?: string
  series: { pts: { t: number; v: number }[]; cls: string }[]
  log?: boolean
  marks?: Mark[]
  hline?: { v: number; label: string }
  unit: string
  until?: number // ne montre que le début (en secondes) : un zoom
}

function chart(o0: ChartOpts): string {
  const o = o0.until === undefined ? o0 : { ...o0, series: o0.series.map((s) => ({ ...s, pts: s.pts.filter((p) => p.t <= o0.until!) })), marks: o0.marks?.filter((m) => m.t <= o0.until!) }
  const W = 900
  const H = 270
  const L = 58
  const R = 14
  const T = 16
  const B = 34
  const pts = o.series.flatMap((s) => s.pts)
  const tMax = Math.max(60, ...pts.map((p) => p.t))
  const positive = pts.map((p) => p.v).filter((v) => v > 0)
  const vMax = Math.max(1, ...(o.hline ? [o.hline.v] : []), ...pts.map((p) => p.v))
  const vMin = o.log ? Math.max(0.1, 10 ** Math.floor(Math.log10(Math.min(...positive, 1) || 1))) : 0
  const x = (t: number) => L + (t / tMax) * (W - L - R)
  const yv = (v: number) => {
    if (!o.log) return T + (1 - v / vMax) * (H - T - B)
    const lo = Math.log10(vMin)
    const hi = Math.log10(vMax)
    return T + (1 - (Math.log10(Math.max(v, vMin)) - lo) / (hi - lo || 1)) * (H - T - B)
  }
  // Graduations « rondes » : au plus ~10, en minutes, heures ou jours selon la durée
  const STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 180, 360, 720, 1440, 2880, 7200]
  const stepMin = STEPS.find((m) => (tMax / 60) / m <= 10) ?? STEPS[STEPS.length - 1]
  const tickLabel = (m: number) => (m === 0 ? '0' : stepMin >= 1440 ? `${m / 1440} j` : stepMin >= 60 ? `${+(m / 60).toFixed(1)} h` : `${m} min`)
  const xTicks: string[] = []
  for (let m = 0; m * 60 <= tMax; m += stepMin) xTicks.push(`<line x1="${x(m * 60)}" x2="${x(m * 60)}" y1="${T}" y2="${H - B}" class="grid"/><text x="${x(m * 60)}" y="${H - B + 16}" text-anchor="middle">${tickLabel(m)}</text>`)
  const yTicks: string[] = []
  if (o.log) for (let e = Math.log10(vMin); e <= Math.log10(vMax) + 1e-9; e++) yTicks.push(`<line x1="${L}" x2="${W - R}" y1="${yv(10 ** e)}" y2="${yv(10 ** e)}" class="grid"/><text x="${L - 6}" y="${yv(10 ** e) + 4}" text-anchor="end">${num(10 ** e)}</text>`)
  else for (let k = 0; k <= 4; k++) yTicks.push(`<line x1="${L}" x2="${W - R}" y1="${yv((vMax * k) / 4)}" y2="${yv((vMax * k) / 4)}" class="grid"/><text x="${L - 6}" y="${yv((vMax * k) / 4) + 4}" text-anchor="end">${num((vMax * k) / 4)}</text>`)
  const lines = o.series.map((s) => `<polyline class="${s.cls}" points="${s.pts.map((p) => `${x(p.t).toFixed(1)},${yv(p.v).toFixed(1)}`).join(' ')}"/>`).join('')
  const marks = (o.marks ?? []).map((m, i) => `<line x1="${x(m.t)}" x2="${x(m.t)}" y1="${T}" y2="${H - B}" class="mark"/><text x="${x(m.t) + 4}" y="${T + 11 + i * 12}" class="marklabel">${esc(m.label)}</text>`).join('')
  const hline = o.hline ? `<line x1="${L}" x2="${W - R}" y1="${yv(o.hline.v)}" y2="${yv(o.hline.v)}" class="mark"/><text x="${W - R - 4}" y="${yv(o.hline.v) - 5}" text-anchor="end" class="marklabel">${esc(o.hline.label)}</text>` : ''
  return `<section><h2>${esc(o.title)}</h2>${o.note ? `<p class="note">${o.note}</p>` : ''}<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title)}">${xTicks.join('')}${yTicks.join('')}${lines}${marks}${hline}<text x="${L}" y="11" class="unit">${esc(o.unit)}${o.log ? ' (échelle logarithmique)' : ''}</text></svg></section>`
}

// Temps de doublement : à chaque instant, combien de temps faut-il pour que le revenu double (à partir de là) ?
// Un point sans doublement avant la fin de la partie est omis : on ne sait pas encore.
interface Sampled {
  t: number
  rate: number
}
function doublingSeries(samples: Sampled[]): { t: number; v: number }[] {
  const out: { t: number; v: number }[] = []
  for (let i = 0; i < samples.length; i++) {
    const a = samples[i]
    if (a.rate <= 0) continue
    const j = samples.findIndex((b, k) => k > i && b.rate >= a.rate * 2)
    if (j >= 0) out.push({ t: a.t, v: Math.max(1, samples[j].t - a.t) })
  }
  return out
}
function doublingStats(samples: Sampled[]) {
  const pts = doublingSeries(samples)
  const rates = samples.map((s) => s.rate).filter((v) => v > 0)
  const doublings = rates.length ? Math.log2(Math.max(...rates) / rates[0]) : 0
  if (!pts.length) return { doublings, median: undefined, worst: undefined, worstAt: undefined, last: undefined }
  const sortedV = pts.map((p) => p.v).sort((a, b) => a - b)
  const worst = pts.reduce((m, p) => (p.v > m.v ? p : m))
  return { doublings, median: sortedV[Math.floor(sortedV.length / 2)], worst: worst.v, worstAt: worst.t, last: pts[pts.length - 1] }
}
function doublingSection(r: ReportInput): string {
  const main = r.results[0]
  const rows: { name: string; samples: Sampled[] }[] = [{ name: 'Bot (partie 1)', samples: main.samples }, ...r.players.map((p, i) => ({ name: `Joueur ${i + 1}`, samples: p.samples }))]
  const trs = rows
    .map((row) => {
      const d = doublingStats(row.samples)
      return `<tr><td>${esc(row.name)}</td><td>${d.doublings.toFixed(1)}</td><td>${dur(d.median)}</td><td>${dur(d.worst)}${d.worstAt === undefined ? '' : ` <small>(à ${dur(d.worstAt)})</small>`}</td><td>${d.last ? `${dur(d.last.v)} <small>(à ${dur(d.last.t)})</small>` : '—'}</td></tr>`
    })
    .join('')
  const chartHtml = chart({
    title: 'Temps de doublement du revenu',
    note: 'Pour chaque instant : temps qu\'il faut, à partir de là, pour que le revenu double. Bas = le joueur voit son revenu exploser ; qui monte = la progression ralentit ; une bosse = un mur. Les points sans doublement avant la fin de la partie sont omis.',
    series: [{ pts: doublingSeries(main.samples), cls: 'main' }, ...r.players.map((p) => ({ pts: doublingSeries(p.samples), cls: 'human' }))],
    log: true,
    unit: 'secondes pour doubler',
  })
  return `${chartHtml}<table style="margin-top:8px"><tr><th></th><th>Doublements (×2) en tout</th><th>Doublement médian</th><th>Le plus long</th><th>Dernier mesuré</th></tr>${trs}</table>`
}

const days = (x: number) => (Number.isFinite(x) ? `${(x / 86400).toFixed(1)} j` : '> 60 j')
function rhythmCards(r: ReportInput): string {
  if (!r.rhythm) return ''
  const w = r.rhythm.wall
  const a = r.rhythm.active
  return `<div class="card"><b>${days(w[Math.floor(w.length / 2)])}</b><span>fin du monde avec un vrai rythme (${esc(r.rhythm.label)}), médiane</span></div>
<div class="card"><b>${dur(a[Math.floor(a.length / 2)])}</b><span>de jeu actif dans ce rythme (médiane)</span></div>
`
}

function graphSvg(g: Analysis): string {
  const nodes = g.nodes
  const maxDepth = Math.max(...nodes.map((n) => n.depth))
  const cols: GraphNode[][] = Array.from({ length: maxDepth + 1 }, () => [])
  for (const n of nodes) cols[n.depth].push(n)
  cols.forEach((c) => c.sort((a, b) => a.first - b.first || a.name.localeCompare(b.name)))
  const NW = 128
  const NH = 26
  const GX = 62
  const GY = 10
  const pos = new Map<string, { x: number; y: number }>()
  cols.forEach((c, ci) => c.forEach((n, ri) => pos.set(n.id, { x: 8 + ci * (NW + GX), y: 8 + ri * (NH + GY) })))
  const W = 16 + cols.length * (NW + GX) - GX
  const H = 16 + Math.max(...cols.map((c) => c.length)) * (NH + GY) - GY
  const finite = nodes.map((n) => n.first).filter(Number.isFinite)
  const tMax = Math.max(1, ...finite)
  const color = (n: GraphNode) => (Number.isFinite(n.first) ? `hsl(${Math.round(140 - 140 * Math.min(1, Math.log10(1 + n.first) / Math.log10(1 + tMax)))} 55% 42%)` : 'hsl(0 0% 40%)')
  const edges = g.edges
    .map((e) => {
      const a = pos.get(e.from)
      const b = pos.get(e.to)
      if (!a || !b) return ''
      const x1 = a.x + NW
      const y1 = a.y + NH / 2
      const x2 = b.x
      const y2 = b.y + NH / 2
      const mid = (x1 + x2) / 2
      return `<path d="M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}" class="edge ${e.kind}"><title>${esc(e.from)} → ${esc(e.to)}${e.label ? ` (${esc(e.label)})` : ''}</title></path>`
    })
    .join('')
  const boxes = nodes
    .map((n) => {
      const p = pos.get(n.id)!
      const bad = n.flags.length ? ' bad' : ''
      return `<g class="node${bad}" transform="translate(${p.x} ${p.y})"><title>${esc(n.name)} — ${dur(n.first)}${n.flags.length ? ` — ${esc(n.flags.join(', '))}` : ''}</title><rect width="${NW}" height="${NH}" rx="6" fill="${color(n)}"/><text x="7" y="11" class="nn">${esc(n.name.length > 17 ? `${n.name.slice(0, 16)}…` : n.name)}</text><text x="7" y="22" class="nt">${dur(n.first)}</text></g>`
    })
    .join('')
  return `<section><h2>Graphe des items</h2><p class="note">Colonnes = nombre d'étapes depuis le départ. Couleur = temps de référence pour en obtenir un exemplaire (vert : tout de suite, rouge : tard). Trait plein : recette. Pointillé bleu : produit par un producteur. Contour rouge : problème (impasse, inaccessible).</p><div class="scroll"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Graphe des items">${edges}${boxes}</svg></div></section>`
}

function playersSection(r: ReportInput): string {
  const a = r.playerAnalysis
  if (!a) return ''
  const m = a.summary
  const rows = a.goals
    .map((g) => `<tr><td>${esc(g.text)}</td><td>${g.reached}/${g.total}</td><td>${dur(g.median)}</td><td>${dur(g.botMedian)}</td><td>${g.ratio === undefined ? '—' : `×${g.ratio.toFixed(1)}`}</td><td><span class="pill${g.verdict.startsWith('MUR') || g.verdict.startsWith('lent') ? ' bad' : ''}">${esc(g.verdict)}</span></td></tr>`)
    .join('')
  const stops = Object.entries(m.lastGoal)
    .sort((x, y) => y[1] - x[1])
    .map(([k, n]) => `<li>${esc(k)} : ${n} joueur(s)</li>`)
    .join('')
  return `<section><h2>Joueurs</h2><p class="note">${m.count} partie(s) comparées au bot${r.ignored ? ` — ${esc(r.ignored)}` : ''}. Les verdicts sont des heuristiques pour savoir où regarder, pas des vérités : il faut une dizaine de joueurs au moins.</p>
<div class="cards">
<div class="card"><b>${m.finished}/${m.count}</b><span>ont terminé le monde</span></div>
<div class="card"><b>${m.medianMinutes.toFixed(0)} min</b><span>de jeu actif (médiane)</span></div>
<div class="card"><b>${m.medianSessions}</b><span>sessions (médiane) · ${m.returned} revenu(s) 20 h+ plus tard</span></div>
<div class="card"><b>${m.rejectedPer10Min.toFixed(1)}</b><span>gestes refusés / 10 min (confusion)</span></div>
</div>
<table style="margin-top:12px"><tr><th>Objectif</th><th>Atteint</th><th>Médiane joueurs</th><th>Médiane bot</th><th>Écart</th><th>Verdict</th></tr>${rows}</table>
<h3 style="font-size:15px;margin:18px 0 4px">Dernier objectif atteint (où ils s'arrêtent)</h3><ul>${stops}</ul></section>`
}

export function renderReport(r: ReportInput): string {
  const main = r.results[0]
  const sorted = [...r.finishes].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const everyReached = r.results.every((x) => x.victoryAt !== undefined)
  const itemsFound = r.itemsAt.filter((x): x is number => x !== undefined)
  const rateMarks: Mark[] = [{ t: r.itemsAt[0] ?? 0, label: 'items de la fin découverts' }]
  if (Number.isFinite(median)) rateMarks.push({ t: Math.min(median, Math.max(...main.samples.map((s) => s.t))), label: 'fin du monde' })
  const goalRows = r.goals
    .map((g) => {
      const times = r.results.map((x) => x.discovered[g.item]).filter((x): x is number => x !== undefined)
      const ref = r.graph.solve(g.item).t
      return `<tr><td>${esc(g.text)}</td><td>${dur(ref)}</td><td>${times.length ? dur(Math.min(...times)) : 'non visé'}</td><td>${times.length === r.results.length ? dur(times.sort((a, b) => a - b)[Math.floor(times.length / 2)]) : times.length ? `${times.length}/${r.results.length} parties` : 'non visé'}</td></tr>`
    })
    .join('')
  const itemRows = [...r.graph.nodes]
    .filter((n) => n.kind !== 'terrain')
    .sort((a, b) => a.first - b.first)
    .map((n) => {
      const sim = main.discovered[n.id]
      return `<tr class="${n.flags.length ? 'bad' : ''}"><td>${esc(n.name)}</td><td>${esc(n.kind)}</td><td>${dur(n.first)}</td><td>${dur(sim)}</td><td>${n.usedInRecipes}</td><td>${esc(n.flags.join(', '))}</td></tr>`
    })
    .join('')
  const paths = r.finale.requires
    .map((id) => `<li><b>${esc(r.rules.items[id]?.name ?? id)}</b> — ${dur(r.graph.solve(id).t)} : ${r.graph.criticalPath(id).map((p) => `${esc(r.rules.items[p.id]?.name ?? p.id)} <small>(${dur(p.t)})</small>`).join(' ← ')}</li>`)
    .join('')

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Équilibrage — ${esc(r.worldName)}</title>
<style>
:root{--bg:#fff;--fg:#1c1b22;--mut:#6b6a78;--line:#d9d8e0;--card:#f5f4f8;--acc:#0b7a5a;--warn:#c0392b;--grid:#e6e5ec}
@media (prefers-color-scheme:dark){:root{--bg:#15141b;--fg:#ecebf2;--mut:#9d9bab;--line:#34323f;--card:#1f1d28;--acc:#4ad4a6;--warn:#ff7a6b;--grid:#2a2833}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif;padding:24px 16px}
main{max-width:940px;margin:0 auto}h1{margin:0 0 4px;font-size:26px}h2{font-size:18px;margin:32px 0 6px}.sub{color:var(--mut);margin:0 0 20px}.note{color:var(--mut);margin:0 0 8px;font-size:13px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}.card{background:var(--card);border-radius:12px;padding:12px 14px}.card b{display:block;font-size:22px;color:var(--acc)}.card span{color:var(--mut);font-size:13px}
svg{width:100%;height:auto;display:block}.grid{stroke:var(--grid);stroke-width:1}svg text{fill:var(--mut);font-size:11px}.main{fill:none;stroke:var(--acc);stroke-width:2.2}.alt{fill:none;stroke:var(--mut);stroke-width:1;opacity:.35}.human{fill:none;stroke:#f59e0b;stroke-width:1.4;opacity:.85}.pill{display:inline-block;padding:1px 8px;border-radius:99px;background:var(--card);font-size:12px}.pill.bad{color:var(--warn)}.mark{stroke:var(--warn);stroke-dasharray:4 3;stroke-width:1.2}.marklabel{fill:var(--warn)!important}.unit{font-weight:600}
.scroll{overflow-x:auto;border:1px solid var(--line);border-radius:12px;padding:6px}.scroll svg{width:auto;max-width:none}.edge{fill:none;stroke:var(--mut);stroke-width:1;opacity:.45}.edge.produces,.edge.terrain{stroke:#3b82f6;stroke-dasharray:4 3;opacity:.7}.nn{fill:#fff!important;font-weight:600;font-size:11px}.nt{fill:#fff!important;opacity:.85;font-size:10px}.node.bad rect{stroke:var(--warn);stroke-width:3}
table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;padding:5px 8px;border-bottom:1px solid var(--line)}th{color:var(--mut);font-weight:600}tr.bad td{color:var(--warn)}ul{padding-left:20px}small{color:var(--mut)}
</style></head><body><main>
<h1>Équilibrage — ${esc(r.worldName)}</h1>
<p class="sub">Fin du monde : « ${esc(r.finale.text)} » = découvrir ${r.finale.requires.map((i) => esc(r.rules.items[i]?.name ?? i)).join(', ')} <b>et</b> posséder ${num(r.finale.shells)} 🐚. ${r.results.length} parties du bot, graines ${r.seed}–${r.seed + r.results.length - 1}.</p>
<div class="cards">
<div class="card"><b>${dur(median)}</b><span>fin du monde (médiane)</span></div>
<div class="card"><b>${dur(sorted[0])} – ${dur(sorted[sorted.length - 1])}</b><span>meilleure – pire partie${everyReached ? '' : ' (extrapolé)'}</span></div>
<div class="card"><b>${dur(itemsFound.length ? Math.max(...itemsFound) : undefined)}</b><span>pour découvrir les ${r.finale.requires.length} items exigés</span></div>
<div class="card"><b>${num(main.samples.at(-1)?.rate ?? 0)} 🐚/s</b><span>revenu en fin de partie 1</span></div>
${rhythmCards(r)}</div>
<p class="note">Le bot est un joueur glouton simple : ses temps sont plutôt pessimistes (il n'optimise pas les auras). Les « temps de référence » du graphe supposent un seul exemplaire de chaque producteur et aucun bonus.</p>
${chart({ title: 'Revenu : coquillages par seconde', note: `Chaque trait est une partie du bot (la 1re en vert)${r.players.length ? ' ; en orange, les joueurs' : ''}.`, series: [...r.results.map((x, i) => ({ pts: x.samples.map((s) => ({ t: s.t, v: s.rate })), cls: i === 0 ? 'main' : 'alt' })), ...r.players.map((p) => ({ pts: p.samples.map((s) => ({ t: s.t, v: s.rate })), cls: 'human' }))], log: true, marks: rateMarks, unit: '🐚/s' })}
${chart({ title: 'Revenu : zoom sur la 1re heure', note: 'Même courbe, début de partie seulement : c\'est là que se voient les premières minutes et les parties des joueurs.', series: [...r.results.map((x, i) => ({ pts: x.samples.map((s) => ({ t: s.t, v: s.rate })), cls: i === 0 ? 'main' : 'alt' })), ...r.players.map((p) => ({ pts: p.samples.map((s) => ({ t: s.t, v: s.rate })), cls: 'human' }))], log: true, until: 3600, unit: '🐚/s' })}
${chart({ title: 'Coquillages en caisse', series: [...r.results.map((x, i) => ({ pts: x.samples.map((s) => ({ t: s.t, v: s.shells })), cls: i === 0 ? 'main' : 'alt' })), ...r.players.map((p) => ({ pts: p.samples.map((s) => ({ t: s.t, v: s.shells })), cls: 'human' }))], hline: { v: r.finale.shells, label: `objectif ${num(r.finale.shells)}` }, marks: rateMarks, unit: '🐚' })}
${doublingSection(r)}
${playersSection(r)}
<section><h2>Chemin critique des items de la fin</h2><p class="note">Ce qui retarde le plus chaque item (graphe seul, sans jouer).</p><ul>${paths}</ul></section>
<section><h2>Objectifs</h2><p class="note">« Non visé » : le bot ne cherche pas cet objectif, ce qui ne veut pas dire qu'il est impossible (voir la colonne référence).</p><table><tr><th>Objectif</th><th>Référence</th><th>Meilleure partie</th><th>Médiane</th></tr>${goalRows}</table></section>
${graphSvg(r.graph)}
<section><h2>Tous les items</h2><table><tr><th>Item</th><th>Type</th><th>Référence</th><th>Partie 1</th><th>Recettes</th><th>Problème</th></tr>${itemRows}</table></section>
</main></body></html>`
}

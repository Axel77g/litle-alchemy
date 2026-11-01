// Perf en direct : l'appareil (iPhone...) envoie ses métriques au PC une fois par seconde, qui les affiche sur /__perf
// (relais : tools/perf/relay.ts, page : tools/perf/dashboard.html). Transport : le WebSocket de HMR de Vite, donc aucun port à ouvrir.
// Actif seulement sur le serveur de dev ET avec `?perf` dans l'URL. Sinon tout est inerte : les wrappers renvoient vers le code d'origine.
import { createElement, Fragment, Profiler, type ProfilerOnRenderCallback, type ReactNode } from 'react'
import { useFrame as useR3FFrame } from '@react-three/fiber'
import { Vector2, type InstancedMesh, type Mesh, type Object3D, type Scene, type WebGLRenderer } from 'three'
import { onGameEvent } from '../engine/events'
import { useGame } from '../store/game'
import { useUi } from '../ui/uiStore'
import { useQuality } from '../scene/quality'

export const PERF_ON = !!import.meta.hot && new URLSearchParams(location.search).has('perf')

const FLUSH_MS = 1000
const BREAKDOWN_EVERY = 3 // la ventilation de la scène parcourt tous les objets : toutes les 3 s suffit
const MAX_GROUPS = 14
const IGNORED_EVENTS = new Set(['produced', 'dockHover']) // trop fréquents pour servir de repères

// --- accumulateurs de la seconde en cours ---------------------------------------------------------------------------------

interface Cost { ms: number; calls: number; max: number }
interface Commits { commits: number; mounts: number; ms: number; max: number }

const fns = new Map<string, Cost>()
const commits = new Map<string, Commits>()
const cpu: number[] = [] // temps CPU de advance() : useFrame + soumission du rendu
const intervals: number[] = [] // temps réel entre deux images 3D rendues
const events: string[] = []
let frames = 0
let lastFrameT = 0
let lastCalls = 0
let lastTriangles = 0
let target = 0
let maxGap = 0 // plus long écart entre deux requestAnimationFrame : le thread principal a-t-il été bloqué ?
let jank = 0
let longTasks = { n: 0, ms: 0 }
let storeUpdates = { game: 0, ui: 0 }

const record = (label: string, ms: number) => {
  const c = fns.get(label) ?? { ms: 0, calls: 0, max: 0 }
  c.ms += ms
  c.calls++
  if (ms > c.max) c.max = ms
  fns.set(label, c)
}

// --- API pour le reste de l'app --------------------------------------------------------------------------------------------

type FrameCallback = Parameters<typeof useR3FFrame>[0]

// Remplace useFrame de R3F : même comportement, mais le temps passé dans le callback est compté sous `label`.
export function useFrame(label: string, callback: FrameCallback, priority?: number) {
  useR3FFrame(
    PERF_ON
      ? (...args) => {
          const t0 = performance.now()
          callback(...args)
          record(label, performance.now() - t0)
        }
      : callback,
    priority,
  )
}

// Chronomètre un bout de code hors rendu (tick de simulation, sauvegarde...)
export function timed<T>(label: string, fn: () => T): T {
  if (!PERF_ON) return fn()
  const t0 = performance.now()
  try {
    return fn()
  } finally {
    record(label, performance.now() - t0)
  }
}

const onRender: ProfilerOnRenderCallback = (id, phase, actualDuration) => {
  const c = commits.get(id) ?? { commits: 0, mounts: 0, ms: 0, max: 0 }
  c.commits++
  if (phase === 'mount') c.mounts++
  c.ms += actualDuration
  if (actualDuration > c.max) c.max = actualDuration
  commits.set(id, c)
}

// Compte les rendus React d'une zone (nombre de commits et temps de rendu). Transparent hors mode perf.
export function PerfProfiler({ id, children }: { id: string; children: ReactNode }) {
  return PERF_ON ? createElement(Profiler, { id, onRender }, children) : createElement(Fragment, null, children)
}

// Repère affiché sur les courbes (ex : « sheet ouverte »). Aussi accessible depuis la console : island.mark('...')
export function perfMark(label: string) {
  if (PERF_ON) events.push(label)
}

// Appelé par FrameLimiter après chaque image rendue
export function perfFrame(t: number, cpuMs: number, calls: number, triangles: number, targetFps: number) {
  if (!PERF_ON) return
  if (lastFrameT) intervals.push(t - lastFrameT)
  lastFrameT = t
  cpu.push(cpuMs)
  frames++
  lastCalls = calls
  lastTriangles = triangles
  target = targetFps
}

let renderer: WebGLRenderer | null = null
let scene: Scene | null = null
export function perfAttach(gl: WebGLRenderer, s: Scene) {
  renderer = gl
  scene = s
}

// --- agrégation ------------------------------------------------------------------------------------------------------------

const r1 = (n: number) => Math.round(n * 10) / 10
const pct = (a: number[], p: number) => {
  if (!a.length) return 0
  const s = [...a].sort((x, y) => x - y)
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]
}
const stat = (a: number[]) => ({ p50: r1(pct(a, 0.5)), p95: r1(pct(a, 0.95)), max: r1(a.length ? Math.max(...a) : 0) })

// Triangles de la scène (avant culling) par groupe : on prend le nom de l'objet nommé le plus proche (les noeuds des GLB le sont)
function breakdown(root: Scene) {
  const groups = new Map<string, { tris: number; meshes: number; shadowTris: number }>()
  const total = { tris: 0, meshes: 0, shadowTris: 0 }
  const labelOf = (o: Object3D) => {
    let top = o
    let named = ''
    for (let p: Object3D | null = o; p && !(p as Scene).isScene; p = p.parent) {
      if (!named && p.name) named = p.name
      top = p
    }
    return named || `${top.type}#${root.children.indexOf(top)}`
  }
  root.traverseVisible((o) => {
    const m = o as Mesh
    if (!m.isMesh) return
    const g = m.geometry
    const vertices = g.index ? g.index.count : g.attributes.position?.count ?? 0
    const tris = (vertices / 3) * ((m as InstancedMesh).isInstancedMesh ? (m as InstancedMesh).count : 1)
    const shadowTris = m.castShadow ? tris : 0
    const key = labelOf(m)
    const e = groups.get(key) ?? { tris: 0, meshes: 0, shadowTris: 0 }
    e.tris += tris
    e.meshes++
    e.shadowTris += shadowTris
    groups.set(key, e)
    total.tris += tris
    total.meshes++
    total.shadowTris += shadowTris
  })
  const sorted = [...groups].sort((a, b) => b[1].tris - a[1].tris)
  const top = sorted.slice(0, MAX_GROUPS).map(([name, v]) => ({ name, ...v, tris: Math.round(v.tris), shadowTris: Math.round(v.shadowTris) }))
  const rest = sorted.slice(MAX_GROUPS).reduce((acc, [, v]) => ({ tris: acc.tris + v.tris, meshes: acc.meshes + v.meshes, shadowTris: acc.shadowTris + v.shadowTris }), { tris: 0, meshes: 0, shadowTris: 0 })
  if (rest.meshes) top.push({ name: 'autres', ...rest, tris: Math.round(rest.tris), shadowTris: Math.round(rest.shadowTris) })
  return { total: { tris: Math.round(total.tris), meshes: total.meshes, shadowTris: Math.round(total.shadowTris) }, groups: top }
}

const device = (() => {
  const ua = navigator.userAgent
  const kind = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : 'Appareil'
  return { id: Math.random().toString(36).slice(2, 8), kind }
})()

let flushCount = 0
let lastFlush = performance.now()

function flush() {
  const now = performance.now()
  const seconds = (now - lastFlush) / 1000
  lastFlush = now
  const info = renderer?.info
  const size = renderer?.getDrawingBufferSize(new Vector2())
  const memory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory // Chrome seulement : absent sur iOS

  const sample = {
    dev: device.id,
    name: `${device.kind} ${innerWidth}×${innerHeight} @${devicePixelRatio}x`,
    seconds: r1(seconds),
    fps: r1(frames / seconds),
    target,
    cpu: stat(cpu),
    interval: stat(intervals),
    raf: { maxGap: r1(maxGap), jank },
    gl: {
      calls: lastCalls,
      triangles: lastTriangles,
      geometries: info?.memory.geometries ?? 0,
      textures: info?.memory.textures ?? 0,
      programs: info?.programs?.length ?? 0,
      dpr: r1(renderer?.getPixelRatio() ?? 0),
      mpx: size ? r1((size.x * size.y) / 1e6) : 0,
      tier: useQuality.getState().tier,
    },
    // coût par seconde de chaque poste : ms cumulées, nombre d'appels, pire appel
    fns: Object.fromEntries([...fns].map(([k, v]) => [k, { ms: r1(v.ms / seconds), calls: Math.round(v.calls / seconds), max: r1(v.max) }])),
    react: Object.fromEntries([...commits].map(([k, v]) => [k, { commits: r1(v.commits / seconds), mounts: v.mounts, ms: r1(v.ms / seconds), max: r1(v.max) }])),
    store: { game: Math.round(storeUpdates.game / seconds), ui: Math.round(storeUpdates.ui / seconds) },
    long: longTasks,
    heapMb: memory ? Math.round(memory.usedJSHeapSize / 1048576) : null,
    ev: events.splice(0),
    scene: scene && flushCount % BREAKDOWN_EVERY === 0 ? breakdown(scene) : undefined,
  }
  flushCount++
  import.meta.hot?.send('perf:sample', sample)

  fns.clear()
  commits.clear()
  cpu.length = 0
  intervals.length = 0
  frames = 0
  maxGap = 0
  jank = 0
  longTasks = { n: 0, ms: 0 }
  storeUpdates = { game: 0, ui: 0 }
}

let started = false
export function initLivePerf() {
  if (!PERF_ON || started) return
  started = true

  let last = 0
  const loop = (t: number) => {
    if (last && !document.hidden) {
      const gap = t - last
      if (gap > maxGap) maxGap = gap
      if (gap > 50) jank++
    }
    last = t
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)

  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        longTasks.n++
        longTasks.ms += e.duration
      }
    }).observe({ entryTypes: ['longtask'] }) // Safari ne le supporte pas : on retombe sur le catch
  } catch {
    /* absent : les gaps de requestAnimationFrame couvrent le besoin */
  }

  useGame.subscribe(() => storeUpdates.game++)
  useUi.subscribe(() => storeUpdates.ui++)
  onGameEvent((e) => {
    if (!IGNORED_EVENTS.has(e.type)) perfMark(e.type)
  })
  let tier = useQuality.getState().tier
  useQuality.subscribe((s) => {
    if (s.tier !== tier) perfMark(`qualité ${tier} → ${s.tier}`)
    tier = s.tier
  })
  document.addEventListener('visibilitychange', () => perfMark(document.hidden ? 'onglet masqué' : 'onglet visible'))

  setInterval(flush, FLUSH_MS)
}

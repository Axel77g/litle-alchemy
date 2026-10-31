// Joueur de référence du monde 1 : un bot glouton qui joue avec le VRAI store (mêmes règles que le jeu : production, nuit, auras, prix des cases).
// Il sert à estimer des durées, pas à trouver la meilleure stratégie : il ne pose pas de feux de camp supplémentaires et ne place rien pour
// profiter des auras au mieux. Ses temps sont donc plutôt pessimistes ; un joueur malin ira plus vite.
// Un autre monde aura sa propre politique (les décisions dépendent des recettes) : le moteur de mesure, lui, est commun.
import { world1 } from '../../src/content/world1'
import { clock } from '../../src/engine/clock'
import { expansionCandidates } from '../../src/engine/expansion'
import { createWorld, ensureTerrainSources } from '../../src/engine/grid'
import { onGameEvent } from '../../src/engine/events'
import { shellRate } from '../../src/engine/production'
import type { GridCell } from '../../src/engine/types'
import { useGame } from '../../src/store/game'

export interface Sample {
  t: number
  shells: number
  rate: number // coquillages par seconde à cet instant
}

export interface RunResult {
  samples: Sample[]
  discovered: Record<string, number> // premier instant où chaque item a été obtenu (s)
  victoryAt?: number
  millionAt?: number // premier instant où le compteur a atteint le seuil, même si des items manquaient
  finalShells: number
  finalRate: number
  simulated: number // secondes simulées
  board: Record<string, number> // ce qui est posé à la fin
  cellsBought: number
  log: string[]
}

// Ordre dans lequel les villageois reçoivent un métier (le bois et la pierre d'abord, puis surtout des chasseurs : 5 🐚/s chacun)
const ROLES = ['lumberjack', 'miner', 'hunter', 'hunter', 'lumberjack', 'hunter', 'hunter', 'miner', 'hunter', 'painter'] as const
const ROLE_ITEM = { lumberjack: 'stick', miner: 'stone', hunter: 'flint_tool', painter: 'ochre' } as const
// Ce que rapporte, en 🐚/s, une case de plus une fois un Mammouth ou une Charrette posé dessus (sert à juger si l'acheter vaut le coup)
const CELL_PAYOFF = 30
const HUT_TARGET = 6 // nombre de cabanes visé (une Hutte tribale compte pour 2) : c'est elles qui fournissent les villageois
// Stock gardé ; le reste est vendu. Les items absents de cette liste ne sont jamais vendus.
const KEEP: Record<string, number> = { stone: 10, stick: 12, mud: 3, water: 3, seed: 2, wheat: 2, log: 6, heat: 3, clay: 0, raw_meat: 0, milk: 0, leather: 0, wool: 0, flour: 0, flint_tool: 4 }

// Remet le store dans l'état d'une nouvelle partie (le store est un singleton : sans cela, une 2e partie reprendrait la 1re)
export function resetWorld1() {
  const rules = world1.rules
  const world = ensureTerrainSources(rules, createWorld(rules, world1.ground, world1.objects))
  const inventory = { ...world1.startingInventory }
  const seen: Record<string, true> = {}
  for (const id of Object.keys(inventory)) seen[id] = true
  for (const c of world.values()) if (c.entity) seen[c.entity.itemId] = true
  clock.hour = 8
  useGame.setState({ world, shells: 0, inventory, seen, victory: false, night: false, offlineReport: null })
}

export function runWorld1(opts: { maxSeconds: number; step: number }): RunResult {
  resetWorld1()
  const G = useGame
  const s = () => G.getState()
  const have = (id: string) => s().inventory[id] ?? 0
  const cells = () => [...s().world.values()]
  const ents = (id: string) => cells().filter((c) => c.entity?.itemId === id)
  const count = (id: string) => ents(id).length
  const log: string[] = []
  let t = 0
  const say = (m: string) => log.push(`${String(Math.round(t)).padStart(5)} s  ${m}`)

  const discovered: Record<string, number> = {}
  for (const id of Object.keys(s().seen)) discovered[id] = 0
  let victoryAt: number | undefined
  const unsubscribe = onGameEvent((e) => {
    if (e.type === 'discovered') {
      discovered[e.itemId] ??= t
      say(`découvert : ${s().rules.items[e.itemId]?.name ?? e.itemId}`)
    }
    if (e.type === 'victory') victoryAt ??= t
  })

  const craft = (a: string, b: string) => {
    const before = s().inventory
    s().merge(a, b)
    return s().inventory !== before
  }

  // --- Où poser ------------------------------------------------------------------------------
  const isFree = (c: GridCell) => c.unlocked && c.terrain === 'GRASS' && !c.entity
  const adjacentTo = (c: GridCell, list: GridCell[]) => list.some((f) => Math.abs(f.x - c.x) + Math.abs(f.z - c.z) === 1)
  const spots = (near?: GridCell[]) =>
    cells()
      .filter(isFree)
      .sort((a, b) => (near ? Number(adjacentTo(b, near)) - Number(adjacentTo(a, near)) : 0) || Math.abs(a.x) + Math.abs(a.z) - (Math.abs(b.x) + Math.abs(b.z)))
  let bought = 0
  // Une case libre ; sinon on agrandit l'île si on en a les moyens
  const spot = (near?: GridCell[]): GridCell | undefined => {
    const free = spots(near)
    if (free[0]) return free[0]
    const cand = expansionCandidates(s().world).sort((a, b) => Math.abs(a.x) + Math.abs(a.z) - (Math.abs(b.x) + Math.abs(b.z)))[0]
    const price = s().cellPrice()
    if (!cand || s().shells < price) return undefined
    // Une case n'est rentable que si elle se rembourse avant la fin : sinon (le prix grimpe de 12 % à chaque achat) elle ne fait que retarder l'objectif
    const rate = Math.max(1, shellRate(s().rules, s().world, s().night))
    const remaining = Math.max(0, world1.finale.shells - s().shells) / rate
    if (price / CELL_PAYOFF >= remaining) return undefined
    if (s().buyCell(cand.x, cand.z)) bought++
    return spots(near)[0]
  }
  const place = (id: string, near?: GridCell[]) => {
    const c = spot(near)
    if (!c) return false
    s().place(c.x, c.z, id)
    return !!s().world.get(`${c.x},${c.z}`)?.entity
  }

  // --- Les gestes, chacun renvoie true s'il a fait quelque chose ----------------------------
  let assigned = 0
  const assignWorkers = () => {
    const role = ROLES[assigned] ?? 'hunter'
    const item = ROLE_ITEM[role]
    if (have(item) < 1) return false
    const idle = ents('cro_magnon')[0] // un villageois déjà posé (celui du départ, ou un autre)
    let at = idle
    if (!at) {
      if (!have('cro_magnon')) return false
      const c = spot(ents('campfire'))
      if (!c) return false
      s().place(c.x, c.z, 'cro_magnon')
      at = s().world.get(`${c.x},${c.z}`)!
    }
    s().use(at.x, at.z, item)
    if (s().world.get(`${at.x},${at.z}`)?.entity?.itemId === 'cro_magnon') return false
    assigned++
    say(`${role} (n°${assigned})`)
    return true
  }
  const placeProducers = () => {
    for (const [id, n] of Object.entries(s().inventory)) {
      const def = s().rules.items[id]
      if (n > 0 && def.kind === 'producer' && id !== 'cro_magnon' && id !== 'campfire') return place(id, def.tags?.includes('worker') ? ents('campfire') : undefined)
    }
    return false
  }
  const mergeOnBoard = (id: string) => {
    const [a, b] = ents(id)
    return !!b && s().moveOnBoard({ x: a.x, z: a.z }, { x: b.x, z: b.z })
  }
  const buildHut = () => {
    const total = count('hut') + 2 * count('tribal_hut') + have('hut')
    if (total >= HUT_TARGET) return false
    if (!have('campfire')) {
      if (have('stone') < 2 || have('stick') < 1) return false
      return craft('stone', 'stone') && craft('spark', 'stick')
    }
    return have('stick') >= 3 && have('mud') >= 1 && craft('stick', 'mud')
  }
  const makeFlint = () => have('flint_tool') < 3 && have('stone') >= 1 && have('stick') >= 1 && craft('stone', 'stick')
  const makeCart = () => have('log') >= 3 && have('flint_tool') >= 2 && craft('log', 'flint_tool') && craft('log', 'flint_tool') && craft('wheel', 'wheel')
  // Chaîne du pain, une seule fois : elle sert à découvrir le Pain et le Champ
  let field = false
  const farm = () => {
    if (!field && have('seed') >= 2 && have('water') >= 1) {
      if (!craft('seed', 'water')) return false
      const water = cells().filter((c) => c.terrain === 'WATER')
      const c = spots().find((f) => adjacentTo(f, water)) ?? spot()
      if (!c) return false
      s().place(c.x, c.z, 'field')
      field = true
      return true
    }
    if (field && !have('flour') && !have('dough') && !have('bread') && !discovered.bread && have('wheat') >= 1 && have('stone') >= 1) return craft('wheat', 'stone')
    if (have('flour') && have('water') >= 1) return craft('flour', 'water')
    if (have('dough') && have('heat') >= 1) return craft('dough', 'heat')
    return false
  }
  let lastSale = -1e9
  const sellSurplus = () => {
    if (t - lastSale < 20) return false
    lastSale = t
    for (const [id, keep] of Object.entries(KEEP)) if (have(id) > keep && s().rules.items[id]?.sellValue) s().sell(id, have(id) - keep)
    return false
  }

  const step = () => {
    sellSurplus()
    // Plusieurs gestes par pas : on s'arrête quand plus rien n'est possible
    for (let guard = 0; guard < 60; guard++) {
      const did =
        assignWorkers() ||
        placeProducers() ||
        mergeOnBoard('hunter') ||
        (count('hut') >= 4 && mergeOnBoard('hut')) ||
        buildHut() ||
        makeFlint() ||
        makeCart() ||
        farm()
      if (!did) break
    }
  }

  const samples: Sample[] = []
  let millionAt: number | undefined
  const target = world1.finale.shells
  for (t = 0; t <= opts.maxSeconds && victoryAt === undefined; t += opts.step) {
    step()
    s().advance(opts.step)
    if (millionAt === undefined && s().shells >= target) millionAt = t
    if (Math.round(t) % 10 === 0 || t === 0) samples.push({ t, shells: s().shells, rate: shellRate(s().rules, s().world, s().night) })
  }
  unsubscribe()
  const board: Record<string, number> = {}
  for (const c of cells()) if (c.entity) board[c.entity.itemId] = (board[c.entity.itemId] ?? 0) + 1
  return { samples, discovered, victoryAt, millionAt, finalShells: s().shells, finalRate: shellRate(s().rules, s().world, s().night), simulated: t, board, cellsBought: bought, log }
}

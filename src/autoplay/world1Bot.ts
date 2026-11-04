// Joueur de référence du monde 1 : un bot glouton qui joue avec le VRAI store (mêmes règles que le jeu : production, nuit, auras, prix).
// Il sert à estimer des durées (tools/balance) et à jouer devant le joueur (src/autoplay). Il ne pose pas de feux de camp supplémentaires et ne place
// rien pour profiter des auras au mieux : ses temps sont plutôt pessimistes ; un joueur malin ira plus vite.
// Un autre monde aura sa propre politique (les décisions dépendent des recettes).
import { world1 } from '../content/world1'
import { expansionCandidates } from '../engine/expansion'
import { findRecipe } from '../engine/items'
import { shellRate } from '../engine/production'
import type { GridCell } from '../engine/types'
import { useGame } from '../store/game'

// Ordre dans lequel les villageois reçoivent un métier (le bois et la pierre d'abord, puis surtout des chasseurs : 5 🐚/s chacun)
const ROLES = ['lumberjack', 'miner', 'hunter', 'hunter', 'lumberjack', 'hunter', 'hunter', 'miner', 'hunter', 'painter'] as const
const ROLE_ITEM = { lumberjack: 'stick', miner: 'stone', hunter: 'flint_tool', painter: 'ochre' } as const
// Ce que rapporte, en 🐚/s, une case de plus une fois un Mammouth ou une Charrette posé dessus (sert à juger si l'acheter vaut le coup)
const CELL_PAYOFF = 30
const HUT_TARGET = 6 // nombre de cabanes visé (une Hutte tribale compte pour 2) : c'est elles qui fournissent les villageois
// Stock gardé ; le reste est vendu. Les items absents de cette liste ne sont jamais vendus.
const KEEP: Record<string, number> = { stone: 10, stick: 12, mud: 3, water: 3, seed: 2, wheat: 2, log: 6, heat: 3, clay: 0, raw_meat: 0, milk: 0, leather: 0, wool: 0, flour: 0, flint_tool: 4 }

// Remet le store dans l'état d'une nouvelle partie (le store est un singleton : sans cela, une 2e partie reprendrait la 1re)
export function startNewGame(startShells = 0) {
  useGame.getState().reset()
  if (startShells) useGame.setState({ shells: startShells })
}

// `now` : temps de jeu écoulé en secondes (sert à espacer les ventes) ; `say` : journal optionnel des grandes étapes.
export function createWorld1Bot(now: () => number, say: (m: string) => void = () => {}) {
  const G = useGame
  const s = () => G.getState()
  const have = (id: string) => s().inventory[id] ?? 0
  const cells = () => [...s().world.values()]
  const ents = (id: string) => cells().filter((c) => c.entity?.itemId === id)
  const count = (id: string) => ents(id).length

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
  // Un producteur payant n'est posé que si on peut le payer (le bot attend, sans acheter de case pour rien)
  const place = (id: string, near?: GridCell[]) => {
    const needCell = spots(near).length === 0 // sans case libre, il faudra aussi payer une case : on vérifie le total avant de dépenser
    if (s().placeCost(id) + (needCell ? s().cellPrice() : 0) > s().shells) return false
    const c = spot(near)
    if (!c) return false
    return s().place(c.x, c.z, id)
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
      if (s().placeCost('cro_magnon') > s().shells) return false
      const c = spot(ents('campfire'))
      if (!c || !s().place(c.x, c.z, 'cro_magnon')) return false
      at = s().world.get(`${c.x},${c.z}`)!
    }
    s().use(at.x, at.z, item)
    if (s().world.get(`${at.x},${at.z}`)?.entity?.itemId === 'cro_magnon') return false
    assigned++
    say(`${role} (n°${assigned})`)
    return true
  }
  const placeProducers = () => {
    // Les moins chers d'abord : on ne bloque pas tout en attendant le plus cher
    const owned = Object.entries(s().inventory)
      .filter(([id, n]) => n > 0 && s().rules.items[id].kind === 'producer' && id !== 'cro_magnon' && id !== 'campfire' && (id !== 'field' || field))
      .sort((a, b) => s().placeCost(a[0]) - s().placeCost(b[0]))
    for (const [id] of owned) if (place(id, s().rules.items[id].tags?.includes('worker') ? ents('campfire') : undefined)) return true
    return false
  }
  const mergeOnBoard = (id: string) => {
    const [a, b] = ents(id)
    if (!b) return false
    const result = findRecipe(s().rules, id, id)
    if (result && s().placeCost(result) > s().shells) return false // la fusion se paie (Mammouth)
    return s().moveOnBoard({ x: a.x, z: a.z }, { x: b.x, z: b.z })
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
    if (!field && (have('field') || (have('seed') >= 2 && have('water') >= 1))) {
      if (!have('field')) return craft('seed', 'water') // le Champ est payant : on le fabrique d'abord, on le pose quand on peut le payer
      if (s().placeCost('field') > s().shells) return false
      const water = cells().filter((c) => c.terrain === 'WATER')
      const c = spots().find((f) => adjacentTo(f, water)) ?? spot()
      if (!c || !s().place(c.x, c.z, 'field')) return false
      field = true
      return true
    }
    if (field && !have('flour') && !have('dough') && !have('bread') && !s().seen.bread && have('wheat') >= 1 && have('stone') >= 1) return craft('wheat', 'stone')
    if (have('flour') && have('water') >= 1) return craft('flour', 'water')
    if (have('dough') && have('heat') >= 1) return craft('dough', 'heat')
    return false
  }
  let lastSale = -1e9
  const sellSurplus = () => {
    if (now() - lastSale < 20) return false
    lastSale = now()
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

  return {
    step,
    get cellsBought() {
      return bought
    },
  }
}

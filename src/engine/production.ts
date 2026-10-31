// Production idle. Le temps est basé sur le temps écoulé (dt), jamais sur les frames :
// la même fonction sert au jeu en direct (dt ≈ 0,1 s) et au gain hors-ligne (dt = des heures).
import { statMultiplier } from './modifiers'
import { nightFraction } from './clock'
import { SHELL, type Production, type Ruleset } from './items'
import type { GridCell, Inventory, World } from './types'

export const FRENZY_MULTIPLIER = 3

export interface ProducedEvent {
  x: number
  z: number
  entityId: string
  output: string
  amount: number
}

export interface ProductionResult {
  shells: number
  items: Inventory
  produced: ProducedEvent[]
  blocked: string[] // items dont la production est en pause faute de place dans le dock
}

// Ce qui porte les compteurs d'une production : une entité posée, ou une case de terrain producteur (ex : un bloc d'eau)
interface ProductionState {
  progress: number[]
  produced?: number[]
}

// Fait avancer une liste de productions de `effective` secondes "effectives" (vitesse déjà appliquée) et range les gains dans `result`.
// Quand le dock est plein (`space`), une production d'item se met en pause (elle garde sa production prête) au lieu de la perdre.
function runProductions(productions: Production[], state: ProductionState, effective: number, value: number, space: { free: number } | undefined, result: ProductionResult, at: { x: number; z: number; id: string }) {
  state.produced ??= [] // anciennes sauvegardes
  productions.forEach((p, i) => {
    const done = state.produced![i] ?? 0
    if (p.limit !== undefined && done >= p.limit) {
      state.progress[i] = 0 // épuisé : ne produit plus
      return
    }
    const progress = (state.progress[i] ?? 0) + effective
    // petite tolérance : sans elle, 100 × 0,1 s = 9,99999… s rate la production de justesse (elle viendrait un tick plus tard)
    const due = Math.floor(progress / p.every + 1e-9)
    let count = p.limit === undefined ? due : Math.min(due, p.limit - done)
    let full = false
    if (space && p.output !== SHELL) {
      const fit = Math.floor(space.free / (p.amount ?? 1))
      if (count > fit) {
        count = fit
        full = true
        if (!result.blocked.includes(p.output)) result.blocked.push(p.output)
      }
      space.free -= count * (p.amount ?? 1)
    }
    state.produced![i] = done + count
    const left = p.limit !== undefined && done + count >= p.limit ? 0 : Math.max(0, progress - count * p.every)
    state.progress[i] = full ? Math.min(left, p.every) : left // en pause : une production prête, pas d'arriéré
    if (count === 0) return

    const amount = count * (p.amount ?? 1)
    if (p.output === SHELL) result.shells += amount * value
    else result.items[p.output] = (result.items[p.output] ?? 0) + amount
    result.produced.push({ x: at.x, z: at.z, entityId: at.id, output: p.output, amount })
  })
}

// Avance la simulation de dt secondes.
// NB : met à jour EN PLACE les compteurs des entités (progress, frenzyTimer) et des cases de terrain producteur. C'est voulu : ces valeurs changent
// à chaque tick et ne doivent pas provoquer de re-rendu React (la scène les lit via useFrame si besoin).
// `space` : places libres dans le dock (décrémentées au fil de la production). Quand il est plein, un producteur d'items se met en pause
// (il garde sa production prête) au lieu de la perdre ; les coquillages ne passent pas par le dock.
export function advanceTime(
  rules: Ruleset,
  world: World,
  dt: number,
  time?: { hour: number; hoursPerSecond: number },
  space?: { free: number },
): ProductionResult {
  const result: ProductionResult = { shells: 0, items: {}, produced: [], blocked: [] }
  if (dt <= 0) return result
  // Part de ce laps de temps passée de nuit : les personnages (nightMultiplier) produisent plus la nuit
  const night = time ? nightFraction(time.hour, dt, time.hoursPerSecond) : 0

  for (const cell of world.values()) {
    const entity = cell.entity
    const productions = entity && rules.items[entity.itemId]?.production
    if (entity && productions) {
      const nightBoost = 1 + ((rules.items[entity.itemId].nightMultiplier ?? 1) - 1) * night
      const speed = statMultiplier(cell.modifiers, 'speed') * nightBoost
      const value = statMultiplier(cell.modifiers, 'value')

      // Frénésie : vitesse ×3 pendant frenzyTimer secondes, puis vitesse normale pour le reste de dt
      const frenzied = Math.min(dt, entity.frenzyTimer)
      entity.frenzyTimer -= frenzied
      const effective = (frenzied * FRENZY_MULTIPLIER + (dt - frenzied)) * speed
      runProductions(productions, entity, effective, value, space, result, { x: cell.x, z: cell.z, id: entity.id })
    }

    // Le terrain lui-même produit (ex : un bloc d'eau produit de l'eau), indépendamment de ce qui est posé dessus
    const terrainProductions = rules.terrainProduction[cell.terrain]
    if (terrainProductions) {
      cell.progress ??= []
      const speed = statMultiplier(cell.modifiers, 'speed')
      runProductions(terrainProductions, cell as GridCell & ProductionState, dt * speed, statMultiplier(cell.modifiers, 'value'), space, result, { x: cell.x, z: cell.z, id: `${cell.terrain}:${cell.x},${cell.z}` })
    }
  }
  return result
}

// Coquillages gagnés par seconde par tout le plateau (modifiers inclus). Sert au HUD.
export function shellRate(rules: Ruleset, world: World, night = false): number {
  let rate = 0
  for (const cell of world.values()) {
    const productions = cell.entity && rules.items[cell.entity.itemId]?.production
    if (!productions) continue
    const nightBoost = night ? (rules.items[cell.entity!.itemId].nightMultiplier ?? 1) : 1
    const factor = statMultiplier(cell.modifiers, 'speed') * statMultiplier(cell.modifiers, 'value') * nightBoost
    for (const p of productions) if (p.output === SHELL) rate += ((p.amount ?? 1) / p.every) * factor
  }
  return rate
}

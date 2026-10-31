// Lecture seule : ce qu'une case produit, combien elle a déjà produit et dans combien de temps tombe la prochaine production.
// Reprend exactement les règles de production.ts (vitesse = modifiers × nuit, frénésie ×3) pour que l'affichage ne mente pas.
import { isNight } from './clock'
import { statMultiplier } from './modifiers'
import { FRENZY_MULTIPLIER } from './production'
import { SHELL, type Production, type Ruleset } from './items'
import type { GridCell } from './types'

export interface ProductionInfo {
  output: string // id de l'item, ou SHELL
  amount: number // quantité par production (valeur des coquillages incluse)
  interval: number // secondes réelles entre deux productions, vitesse actuelle comprise (hors fin de frénésie)
  remaining: number // secondes avant la prochaine production
  total: number // quantité produite depuis le début
  paused: boolean // dock plein : la production est prête mais attend de la place
  exhausted: boolean // production à `limit` épuisée
}

export interface CellInfo {
  name: string
  itemId?: string
  productions: ProductionInfo[]
  speed: number // multiplicateur de vitesse total (1 = normal)
  boosts: { kind: 'aura' | 'night' | 'frenzy'; label: string }[]
}

// Secondes réelles pour accumuler `need` secondes effectives, à la vitesse `base`, dont les `frenzy` premières secondes sont ×3
function timeFor(need: number, base: number, frenzy: number): number {
  if (need <= 0) return 0
  const boosted = frenzy * FRENZY_MULTIPLIER * base
  if (need <= boosted) return need / (FRENZY_MULTIPLIER * base)
  return frenzy + (need - boosted) / base
}

const percent = (n: number) => `${n >= 0 ? '+' : ''}${Math.round(n * 100)} %`

export function inspectCell(rules: Ruleset, cell: GridCell, hour: number): CellInfo | null {
  const entity = cell.entity
  const def = entity && rules.items[entity.itemId]
  const productions: Production[] | undefined = (def && def.production) || rules.terrainProduction[cell.terrain]
  if (!productions) return null

  const state = entity ?? (cell as { progress?: number[]; produced?: number[] })
  const night = isNight(hour)
  const nightBoost = def && night ? (def.nightMultiplier ?? 1) : 1
  const auraSpeed = statMultiplier(cell.modifiers, 'speed')
  const value = statMultiplier(cell.modifiers, 'value')
  const base = auraSpeed * nightBoost
  const frenzy = entity?.frenzyTimer ?? 0

  const boosts: CellInfo['boosts'] = []
  if (auraSpeed !== 1) boosts.push({ kind: 'aura', label: `Vitesse ${percent(auraSpeed - 1)}` })
  if (value !== 1) boosts.push({ kind: 'aura', label: `Valeur ${percent(value - 1)}` })
  if (nightBoost !== 1) boosts.push({ kind: 'night', label: `Nuit ×${+nightBoost.toFixed(2)}` })
  if (frenzy > 0) boosts.push({ kind: 'frenzy', label: `Frénésie ×${FRENZY_MULTIPLIER} · ${Math.ceil(frenzy)} s` })

  return {
    name: def ? def.name : cell.terrain === 'WATER' ? "Bloc d'eau" : cell.terrain,
    itemId: entity?.itemId,
    speed: base * (frenzy > 0 ? FRENZY_MULTIPLIER : 1),
    boosts,
    productions: productions.map((p, i) => {
      const done = state.produced?.[i] ?? 0
      const progress = state.progress?.[i] ?? 0
      const per = (p.amount ?? 1) * (p.output === SHELL ? value : 1)
      const exhausted = p.limit !== undefined && done >= p.limit
      const paused = !exhausted && p.output !== SHELL && progress >= p.every
      return {
        output: p.output,
        amount: per,
        interval: p.every / base,
        remaining: exhausted || paused ? 0 : timeFor(p.every - progress, base, frenzy),
        total: done * (p.amount ?? 1),
        paused,
        exhausted,
      }
    }),
  }
}

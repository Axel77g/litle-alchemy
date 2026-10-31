import type { Modifier, Stat } from './types'

// Multiplicateur final d'une stat à partir de la liste de modifiers : (1 + Σ add) × Π mul
export function statMultiplier(modifiers: readonly Modifier[], stat: Stat): number {
  let add = 0
  let mul = 1
  for (const m of modifiers) {
    if (m.stat !== stat) continue
    if (m.op === 'add') add += m.value
    else mul *= m.value
  }
  return (1 + add) * mul
}

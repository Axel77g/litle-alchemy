import { useMemo } from 'react'
import type { Recipe } from '../engine/items'
import { useGame } from '../store/game'
import { formatNumber } from './format'
import ItemIcon from './ItemIcon'
import { useUi } from './uiStore'

const close = () => useUi.setState({ grimoireOpen: false })

// Grimoire : toutes les recettes du monde. Celles qu'on n'a pas encore découvertes restent des silhouettes « ? ».
export default function Grimoire() {
  const open = useUi((s) => s.grimoireOpen)
  const rules = useGame((s) => s.rules)
  const seen = useGame((s) => s.seen)

  const rows = useMemo(
    () => [...rules.recipes].sort((a, b) => rules.items[a.result].tier - rules.items[b.result].tier || rules.items[a.result].name.localeCompare(rules.items[b.result].name)),
    [rules],
  )
  if (!open) return null

  const found = rows.filter((r) => seen[r.result]).length
  const need = (r: Recipe) => {
    const m = new Map<string, number>()
    for (const id of r.inputs) m.set(id, (m.get(id) ?? 0) + 1)
    return [...m]
  }

  const Icon = ({ id, big }: { id: string; big?: boolean }) =>
    seen[id] ? (
      <ItemIcon def={rules.items[id]} size={big ? 44 : 36} />
    ) : (
      <ItemIcon def={rules.items[id]} size={big ? 44 : 36} sticker={false} className="opacity-60" style={{ filter: 'brightness(0)' }} />
    )

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-gutter pb-safe" onPointerDown={close}>
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="mb-gutter flex max-h-[82dvh] w-full max-w-md animate-pop flex-col rounded-3xl bg-surface-container-high p-space-lg shadow-chunk-xl ring-2 ring-tertiary"
      >
        <div className="mb-space-sm flex items-center justify-between">
          <div className="font-display text-headline-md text-tertiary">📖 Grimoire</div>
          <div className="rounded-full bg-surface-container-lowest px-3 py-1 font-display text-[13px] font-black text-primary">
            {found}/{rows.length} recettes
          </div>
        </div>

        <div className="no-scrollbar flex flex-col gap-space-sm overflow-y-auto pb-space-sm">
          {rows.map((r) => {
            const known = !!seen[r.result]
            return (
              <div
                key={r.inputs.join('|')}
                className={`flex items-center gap-space-sm rounded-2xl p-space-sm shadow-chunk-sm ${known ? 'bg-surface-container-highest' : 'bg-surface-container-lowest'}`}
              >
                <div className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                  {need(r).map(([id, n]) => (
                    <span key={id} className="flex items-center">
                      <Icon id={id} />
                      {n > 1 && <span className="font-display text-[12px] font-black text-on-surface">×{formatNumber(n)}</span>}
                    </span>
                  ))}
                </div>
                <span className="font-display text-xl font-black text-secondary-container">→</span>
                <div className="w-24 text-center">
                  <Icon id={r.result} big />
                  <div className="font-display text-[11px] font-black leading-tight text-on-surface">{known ? rules.items[r.result].name : '???'}</div>
                </div>
              </div>
            )
          })}
        </div>

        <button
          onClick={close}
          className="mt-space-sm rounded-2xl bg-surface-container-highest py-3 font-display text-label-chunky-lg uppercase text-on-surface shadow-chunk transition-all active:translate-y-1 active:shadow-chunk-press"
        >
          Fermer
        </button>
      </div>
    </div>
  )
}

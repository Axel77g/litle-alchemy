import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { compareNames, itemName } from '../i18n'
import type { Recipe } from '../engine/items'
import { useGame } from '../store/game'
import { formatNumber } from './format'
import { GameWindow } from './Game'
import ItemIcon from './ItemIcon'
import { useUi } from './uiStore'

const close = () => useUi.setState({ grimoireOpen: false })

// Grimoire : toutes les recettes du monde. Celles qu'on n'a pas encore découvertes restent des silhouettes « ? ».
export default function Grimoire() {
  const { t, i18n } = useTranslation()
  const open = useUi((s) => s.grimoireOpen)
  const rules = useGame((s) => s.rules)
  const seen = useGame((s) => s.seen)

  const rows = useMemo(
    () => [...rules.recipes].sort((a, b) => rules.items[a.result].tier - rules.items[b.result].tier || compareNames(rules.items[a.result], rules.items[b.result])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rules, i18n.language],
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
    <GameWindow title={t('grimoire.title')} onClose={close}>
      <div className="mb-3 flex justify-center">
        <div className="ginset stroke-sm rounded-full px-4 py-1 font-display text-[15px] [--edge:#140a04]">
          {t('grimoire.recipes', { found, total: rows.length })}
        </div>
      </div>

      <div className="no-scrollbar flex flex-col gap-2.5 overflow-y-auto px-1 pb-2">
        {rows.map((r) => {
          const known = !!seen[r.result]
          return (
            <div
              key={r.inputs.join('|')}
              className={`flex items-center gap-space-sm rounded-2xl border-[3px] p-space-sm ${known ? 'border-[#8a5a1c] bg-gradient-to-b from-[#fff7e6] to-[#ffe2b0] shadow-[0_3px_0_#140a04]' : 'ginset'}`}
            >
              <div className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                {need(r).map(([id, n]) => (
                  <span key={id} className="flex items-center">
                    <Icon id={id} />
                    {n > 1 && <span className={`font-display text-[14px] ${known ? 'text-card-ink' : 'text-[#fff3d6]/80'}`}>×{formatNumber(n)}</span>}
                  </span>
                ))}
              </div>
              <span className="stroke text-2xl [--edge:#7a2e05]">→</span>
              <div className="w-24 text-center">
                <Icon id={r.result} big />
                <div className={`font-display text-[13px] leading-tight ${known ? 'text-card-ink' : 'text-[#fff3d6]/70'}`}>{known ? itemName(rules.items[r.result]) : '???'}</div>
              </div>
            </div>
          )
        })}
      </div>
    </GameWindow>
  )
}

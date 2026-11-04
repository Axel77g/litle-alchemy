import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { clock } from '../engine/clock'
import { inspectCell, type CellInfo } from '../engine/inspect'
import type { Ruleset } from '../engine/items'
import { useGame } from '../store/game'
import { itemName, t as tr } from '../i18n'
import { FRENZY_MULTIPLIER } from '../engine/production'
import { formatDuration, formatNumber, formatPercent, formatRate } from '../shared/format'
import { effectsOf, Glyph } from './InfoSheet'
import { pickCell, useUi } from '../interaction/uiStore'

const REFRESH_MS = 200 // les compteurs du moteur changent sans re-rendu : on les relit à cette cadence
const OFFSET = 16 // px entre le pointeur et l'infobulle
const WIDTH = 224 // px, pour la garder dans l'écran

// Infobulle au survol (souris) d'un personnage ou d'un bloc producteur : production, total produit, bonus actifs, temps avant la prochaine.
export default function CellTooltip() {
  useTranslation()
  const rules = useGame((s) => s.rules)
  const busy = useUi((s) => s.drag !== null || s.editMode)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const [cell, setCell] = useState<{ x: number; z: number } | null>(null)
  const [info, setInfo] = useState<CellInfo | null>(null)

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || !(e.target instanceof HTMLCanvasElement)) {
        setPointer(null)
        setCell(null)
        return
      }
      const world = useGame.getState().world
      // D'abord le corps d'un personnage (plan à mi-hauteur), sinon le sol (bloc d'eau)
      let c = pickCell(e.clientX, e.clientY, 0.35)
      if (!c || !world.get(`${c.x},${c.z}`)?.entity) c = pickCell(e.clientX, e.clientY)
      setPointer({ x: e.clientX, y: e.clientY })
      setCell((prev) => (prev && c && prev.x === c.x && prev.z === c.z ? prev : c))
    }
    const leave = () => setCell(null)
    window.addEventListener('pointermove', move)
    document.addEventListener('pointerleave', leave)
    return () => {
      window.removeEventListener('pointermove', move)
      document.removeEventListener('pointerleave', leave)
    }
  }, [])

  const visible = cell && !busy
  useEffect(() => {
    if (!visible) return setInfo(null)
    const read = () => {
      const target = useGame.getState().world.get(`${cell.x},${cell.z}`)
      setInfo(target ? inspectCell(rules, target, clock.hour) : null)
    }
    read()
    const id = setInterval(read, REFRESH_MS)
    return () => clearInterval(id)
  }, [visible, cell?.x, cell?.z, rules])

  if (!visible || !info || !pointer) return null
  const left = Math.min(pointer.x + OFFSET, window.innerWidth - WIDTH - 8)
  const top = pointer.y + OFFSET

  return (
    <div
      role="tooltip"
      style={{ left, top, width: WIDTH }}
      className="pointer-events-none fixed z-40 flex flex-col gap-1.5 rounded-2xl bg-surface-container-high bg-[image:var(--grain)] p-2.5 font-display shadow-chunk ring-2 ring-surface-container-highest"
    >
      <span className="text-[13px] font-extrabold uppercase leading-none text-tertiary">
        {info.itemId && <Glyph rules={rules} id={info.itemId} size={20} />} {cellName(rules, info)}
      </span>

      <CellInfoBody info={info} rules={rules} />
    </div>
  )
}

// Corps partagé par l'infobulle (souris) et la fiche d'appui long (tactile) : bonus actifs, productions, prochain tick
// Nom affiché d'une case : l'item qui l'occupe, sinon son terrain (bloc d'eau...)
export const cellName = (rules: Ruleset, info: CellInfo) => (info.itemId && rules.items[info.itemId] ? itemName(rules.items[info.itemId]) : tr(`terrain.${info.terrain}`, { defaultValue: info.name }))

const boostLabel = (b: CellInfo['boosts'][number]) =>
  b.kind === 'speed' || b.kind === 'value'
    ? tr(`boost.${b.kind}`, { percent: formatPercent(b.amount) })
    : b.kind === 'night'
      ? tr('boost.night', { mult: +b.amount.toFixed(2) })
      : tr('boost.frenzy', { mult: FRENZY_MULTIPLIER, seconds: Math.ceil(b.amount) })

export function CellInfoBody({ info, rules }: { info: CellInfo; rules: Ruleset }) {
  useTranslation()
  const def = info.itemId ? rules.items[info.itemId] : undefined
  // Pouvoirs hors production (aura, bonus de dock...) : la production, elle, est affichée en direct ci-dessous
  const powers = def ? effectsOf(def, rules, false).filter((e) => e.tone === 'boost') : []
  return (
    <>
      {powers.map((e, i) => (
        <span key={i} className="flex items-center gap-1 text-[11px] font-bold leading-tight text-on-surface">
          {e.icon} <span>{e.text}</span>
        </span>
      ))}
      {info.boosts.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {info.boosts.map((b) => (
            <span key={b.kind} className="rounded-full bg-primary-container px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-on-primary">
              {b.kind === 'night' ? '🌙' : b.kind === 'frenzy' ? '🔥' : '⚡'} {boostLabel(b)}
            </span>
          ))}
        </div>
      )}

      {info.productions.map((p, i) => {
        return (
          <div key={i} className="flex flex-col gap-0.5 text-[11px] font-bold leading-tight text-on-surface">
            <span className="flex items-center gap-1">
              <Glyph rules={rules} id={p.output} size={18} /> +{formatRate(p.amount)} / {formatDuration(p.interval)}
            </span>
            <span className="text-on-surface-variant">
              {p.exhausted ? tr('tooltip.exhausted') : p.paused ? tr('tooltip.paused') : tr('tooltip.next', { seconds: p.remaining < 10 ? p.remaining.toFixed(1) : Math.ceil(p.remaining) })}
              {' · '}
              {tr('tooltip.total', { total: formatNumber(p.total) })}
            </span>
          </div>
        )
      })}
    </>
  )
}

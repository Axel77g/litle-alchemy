import { useEffect, useState } from 'react'
import { clock } from '../engine/clock'
import { inspectCell, type CellInfo } from '../engine/inspect'
import type { Ruleset } from '../engine/items'
import { useGame } from '../store/game'
import { formatDuration, formatNumber, formatRate } from './format'
import { effectsOf, Glyph } from './InfoSheet'
import { pickCell, useUi } from './uiStore'

const REFRESH_MS = 200 // les compteurs du moteur changent sans re-rendu : on les relit à cette cadence
const OFFSET = 16 // px entre le pointeur et l'infobulle
const WIDTH = 224 // px, pour la garder dans l'écran

// Infobulle au survol (souris) d'un personnage ou d'un bloc producteur : production, total produit, bonus actifs, temps avant la prochaine.
export default function CellTooltip() {
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
      className="pointer-events-none fixed z-40 flex flex-col gap-1.5 rounded-2xl bg-surface-container-high p-2.5 font-display shadow-chunk ring-2 ring-surface-container-highest"
    >
      <span className="text-[13px] font-extrabold uppercase leading-none text-tertiary">
        {info.itemId && <Glyph rules={rules} id={info.itemId} size={20} />} {info.name}
      </span>

      <CellInfoBody info={info} rules={rules} />
    </div>
  )
}

// Corps partagé par l'infobulle (souris) et la fiche d'appui long (tactile) : bonus actifs, productions, prochain tick
export function CellInfoBody({ info, rules }: { info: CellInfo; rules: Ruleset }) {
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
            <span key={b.label} className="rounded-full bg-primary-container px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-on-primary">
              {b.kind === 'night' ? '🌙' : b.kind === 'frenzy' ? '🔥' : '⚡'} {b.label}
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
              {p.exhausted ? 'Épuisé' : p.paused ? '⏸ Dock plein' : `Prochain : ${p.remaining < 10 ? p.remaining.toFixed(1) : Math.ceil(p.remaining)} s`}
              {' · '}
              Total {formatNumber(p.total)}
            </span>
          </div>
        )
      })}
    </>
  )
}

import { useState, type ReactNode } from 'react'
import { haptic } from './haptics'

interface Props {
  title: string
  max: number
  preview: (n: number) => ReactNode // ce qui va se passer avec cette quantité (recette, gain...)
  confirmLabel: (n: number) => string
  onConfirm: (n: number) => void
  onClose: () => void
}

// Fenêtre « combien ? » réutilisable (fusion, vente) : − / + / curseur / MAX, puis Annuler ou valider
export default function QuantitySheet({ title, max, preview, confirmLabel, onConfirm, onClose }: Props) {
  const [count, setCount] = useState(1)
  const n = Math.max(1, Math.min(count, max))

  const set = (v: number) => {
    const next = Math.max(1, Math.min(max, v))
    if (next !== n) haptic(6)
    setCount(next)
  }
  const round =
    'grid size-12 shrink-0 place-items-center rounded-2xl bg-surface-container-highest font-display text-2xl font-black text-on-surface shadow-chunk transition-all active:translate-y-1 active:shadow-chunk-press disabled:opacity-35'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-gutter pb-safe" onPointerDown={onClose}>
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="mb-gutter w-full max-w-md animate-pop rounded-3xl bg-surface-container-high p-space-lg shadow-chunk-xl ring-2 ring-tertiary"
      >
        <div className="mb-space-md text-center font-display text-label-chunky-lg uppercase text-tertiary">{title}</div>
        {preview(n)}

        <div className="mt-space-lg flex items-center gap-space-sm">
          <button className={round} onClick={() => set(n - 1)} disabled={n <= 1} aria-label="Moins">
            −
          </button>
          <div className="flex-1 text-center font-display tabular-nums text-on-surface" style={{ fontSize: 40, lineHeight: '44px', fontWeight: 900 }}>
            {n}
          </div>
          <button className={round} onClick={() => set(n + 1)} disabled={n >= max} aria-label="Plus">
            +
          </button>
          <button
            className="rounded-2xl bg-tertiary-container px-3 py-3 font-display text-label-chunky-sm uppercase text-on-tertiary-container shadow-[0_4px_0_#614800] transition-all active:translate-y-1 active:shadow-none"
            onClick={() => set(max)}
          >
            Max {max}
          </button>
        </div>
        <input
          type="range"
          min={1}
          max={max}
          value={n}
          onChange={(e) => set(Number(e.target.value))}
          className="mt-space-md h-3 w-full touch-pan-x accent-primary"
          aria-label="Quantité"
        />

        <div className="mt-space-lg flex gap-space-sm">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl bg-surface-container-highest py-3 font-display text-label-chunky-lg uppercase text-on-surface shadow-chunk transition-all active:translate-y-1 active:shadow-chunk-press"
          >
            Annuler
          </button>
          <button
            onClick={() => {
              onConfirm(n)
              haptic(30)
            }}
            className="flex-[1.6] rounded-2xl bg-primary-container py-3 font-display text-label-chunky-lg uppercase text-on-primary shadow-[0_5px_0_#00573f] transition-all active:translate-y-1 active:shadow-none"
          >
            {confirmLabel(n)}
          </button>
        </div>
      </div>
    </div>
  )
}

import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { GameButton, GameWindow } from './Game'
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
  const { t } = useTranslation()
  const [count, setCount] = useState(1)
  const n = Math.max(1, Math.min(count, max))

  const set = (v: number) => {
    const next = Math.max(1, Math.min(max, v))
    if (next !== n) haptic(6)
    setCount(next)
  }

  return (
    <GameWindow title={title} onClose={onClose}>
      <div className="ginset mt-3 rounded-2xl p-3">{preview(n)}</div>

      <div className="mt-5 flex items-center gap-2">
        <GameButton variant="blue" shape="icon" className="!size-12 !text-3xl" onClick={() => set(n - 1)} disabled={n <= 1} aria-label={t('quantity.less')}>
          −
        </GameButton>
        <div className="stroke flex-1 text-center tabular-nums [--edge:#2a170c]" style={{ fontSize: 44, lineHeight: '48px' }}>
          {n}
        </div>
        <GameButton variant="blue" shape="icon" className="!size-12 !text-3xl" onClick={() => set(n + 1)} disabled={n >= max} aria-label={t('quantity.more')}>
          +
        </GameButton>
        <GameButton variant="gold" className="!px-3 !py-3 !text-[14px]" onClick={() => set(max)}>
          {t('quantity.max', { max })}
        </GameButton>
      </div>
      <input
        type="range"
        min={1}
        max={max}
        value={n}
        onChange={(e) => set(Number(e.target.value))}
        className="grange mt-4 w-full touch-pan-x"
        aria-label={t('quantity.quantity')}
      />

      <div className="mt-5 flex gap-2">
        <GameButton variant="red" onClick={onClose} className="flex-1 !py-3 !text-[17px]">
          {t('common.cancel')}
        </GameButton>
        <GameButton
          variant="green"
          shine
          onClick={() => {
            onConfirm(n)
            haptic(30)
          }}
          className="flex-[1.7] !py-3 !text-[19px]"
        >
          {confirmLabel(n)}
        </GameButton>
      </div>
    </GameWindow>
  )
}

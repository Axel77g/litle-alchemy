import { useTranslation } from 'react-i18next'
import { setAutoplaySpeed } from './index'
import { useAutoplay } from './state'

const SPEEDS = [1, 10, 60, 300]

// Pastille de l'autopilote : vitesse et sortie. Quitter recharge la page sans autopilote (la vraie partie n'a pas été modifiée).
export default function AutoplayBadge() {
  const { t } = useTranslation()
  const { active, speed } = useAutoplay()
  if (!active) return null
  const leave = () => {
    const url = new URL(location.href)
    url.searchParams.delete('autoplay')
    location.href = url.toString()
  }
  return (
    <div className="fixed bottom-[265px] left-2 z-50 flex items-center gap-1 rounded-full bg-surface-container-lowest/95 px-2 py-1 font-display text-[12px] font-black text-card-ink shadow-chunk ring-2 ring-tertiary">
      <span>{t('autoplay.label')}</span>
      {SPEEDS.map((s) => (
        <button key={s} onClick={() => setAutoplaySpeed(s)} className={`rounded-full px-2 py-0.5 ${s === speed ? 'bg-tertiary text-surface-container-lowest' : 'bg-surface-container-high'}`}>
          ×{s}
        </button>
      ))}
      <button onClick={leave} className="rounded-full bg-[#ffd9d4] px-2 py-0.5 text-[#b3261e]">
        {t('autoplay.quit')}
      </button>
    </div>
  )
}

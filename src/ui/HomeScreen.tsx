import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { clearSave, disableSaving } from '../store/persist'
import { clearTelemetry } from '../telemetry'
import { GameButton, GameWindow } from './Game'
import { START_FRESH_KEY, useUi } from './uiStore'

// Écran d'accueil, par-dessus le jeu (qui est déjà chargé derrière). Le premier appui débloque aussi l'audio.
export default function HomeScreen() {
  const home = useUi((s) => s.homeOpen)
  const canResume = useUi((s) => s.hasSave)
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)

  if (!home) return null

  // Repart de zéro : efface la sauvegarde puis recharge (le drapeau évite de repasser par l'accueil)
  const startFresh = () => {
    disableSaving() // sinon la fermeture de la page réécrit la sauvegarde qu'on vient d'effacer
    clearSave()
    clearTelemetry()
    try {
      sessionStorage.setItem(START_FRESH_KEY, '1')
    } catch {
      // sans sessionStorage on repasse simplement par l'accueil
    }
    location.reload()
  }
  const play = () => useUi.setState({ homeOpen: false })

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-end gap-3 bg-[#140a04]/70 px-8 pb-safe pt-safe backdrop-blur-[3px]">
      <h1 className="stroke-sm mb-auto mt-[18dvh] animate-pop text-center font-display text-5xl leading-none [--edge:#140a04]">
        {t('home.title').split(' ').map((w, i) => (
          <span key={i} className="block">
            {w}
          </span>
        ))}
      </h1>

      <div className="mb-[10dvh] flex w-full max-w-xs flex-col gap-3">
        {canResume && (
          <GameButton variant="green" shine onClick={play} className="!text-xl">
            {t('home.resume')}
          </GameButton>
        )}
        <GameButton variant={canResume ? 'orange' : 'green'} shine={!canResume} onClick={canResume ? () => setConfirming(true) : startFresh} className="!text-xl">
          {t('home.newGame')}
        </GameButton>
        <GameButton onClick={() => useUi.setState({ settingsOpen: true })}>{t('home.settings')}</GameButton>
      </div>

      {confirming && (
        <GameWindow title={t('home.confirmTitle')} onClose={() => setConfirming(false)}>
          <p className="ginset mt-1 rounded-2xl p-3 text-center font-display text-[14px] leading-snug">{t('home.confirmText')}</p>
          <div className="mt-3 flex gap-3">
            <GameButton className="flex-1" onClick={() => setConfirming(false)}>
              {t('home.cancel')}
            </GameButton>
            <GameButton variant="red" className="flex-1" onClick={startFresh}>
              {t('home.erase')}
            </GameButton>
          </div>
        </GameWindow>
      )}
    </div>
  )
}

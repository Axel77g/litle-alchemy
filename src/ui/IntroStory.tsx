import { useTranslation } from 'react-i18next'
import { GameButton, GameWindow } from './Game'
import { endIntro, useTutorial } from '../tutorial/store'
import { useUi } from './uiStore'

// Mot d'accueil de la toute première partie : le scénario, avant le tutoriel
export default function IntroStory() {
  const intro = useTutorial((s) => s.intro)
  const home = useUi((s) => s.homeOpen)
  const { t } = useTranslation()
  if (!intro || home) return null

  return (
    <GameWindow title={t('intro.title')} onClose={endIntro} className="text-center">
      <div className="text-6xl">🧪⏳🗿</div>
      <div className="stroke-sm mt-3 flex flex-col gap-2 text-[14px] font-bold leading-snug [--edge:#2a170c]">
        <p>{t('intro.p1')}</p>
        <p>{t('intro.p2')}</p>
        <p className="opacity-80">{t('intro.p3')}</p>
      </div>
      <GameButton variant="green" shine onClick={endIntro} className="mt-5 w-full !py-3 !text-[20px]">
        {t('intro.go')}
      </GameButton>
    </GameWindow>
  )
}

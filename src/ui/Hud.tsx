import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { finaleText, goalText } from '../i18n'
import { useAdAvailable, watchRewardedAd } from '../rewarded'
import { finaleStatus } from '../engine/finale'
import { shellRate } from '../engine/production'
import { BUILD_AXE_DELAY_MS } from '../xe/manifest'
import { sfx } from '../xe/sfx'
import { useGame } from '../store/game'
import { formatDuration, formatNumber, formatRate } from './format'
import FpsCounter from './FpsCounter'
import { Badge, GameButton, Ribbon } from './Game'
import { haptic } from './haptics'
import { toggleEditMode, useUi } from './uiStore'

// Ouverture du grimoire (bandeau de quête ou bouton) : le clic joue déjà « hover », on y ajoute le bruit de fusion
const openGrimoire = () => {
  sfx('merge')
  useUi.setState({ grimoireOpen: true, newDiscoveries: 0 })
}

// HUD compact : trois blocs sur une seule ligne (compteur + bouton d'agrandissement | objectif | grimoire), pour laisser l'île respirer
export default function Hud() {
  const { t } = useTranslation()
  const shells = useGame((s) => s.shells)
  const world = useGame((s) => s.world)
  const rules = useGame((s) => s.rules)
  const night = useGame((s) => s.night)
  const seen = useGame((s) => s.seen)
  const goals = useGame((s) => s.goals)
  const victory = useGame((s) => s.victory)
  const finale = useGame((s) => s.finale)
  const report = useGame((s) => s.offlineReport)
  const dismiss = useGame((s) => s.dismissOfflineReport)
  const doubleReport = useGame((s) => s.doubleOfflineReport)
  const [adLoading, setAdLoading] = useState(false)
  const adReady = useAdAvailable()
  const editMode = useUi((s) => s.editMode)
  const newDiscoveries = useUi((s) => s.newDiscoveries)
  const rate = useMemo(() => shellRate(rules, world, night), [rules, world, night])
  const done = goals.filter((g) => seen[g.item]).length
  const goal = goals.find((g) => !seen[g.item])
  const end = finaleStatus(finale, seen, shells)

  return (
    // Le conteneur laisse passer les doigts vers la 3D : seuls les éléments visibles les captent
    <header data-hud className="pointer-events-none fixed inset-x-0 top-0 z-30 px-gutter pt-safe">
      <div data-hud-row className="mt-2 flex items-start gap-2">
        {/* Colonne gauche : pilule de coquillages, puis bandeau de quête */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="ginset pointer-events-auto relative mb-2.5 flex h-11 w-[10.5rem] items-center rounded-full pl-12 pr-3">
            <div
              data-shell-target
              className="absolute -left-3 -top-1 grid size-[3.4rem] place-items-center rounded-full border-[3px] border-[#7a2e05] bg-gradient-to-b from-[#ffc247] to-[#f4700a] text-3xl leading-none shadow-[inset_0_2px_0_rgba(255,255,255,0.6),0_3px_0_#7a2e05]"
            >
              🐚
            </div>
            <div className="flex flex-col leading-none">
              <span className="stroke text-[22px] tabular-nums [--edge:#140a04] [-webkit-text-stroke-width:4px]">{formatNumber(shells)}</span>
              <span className="mt-0.5 font-display text-[11px] tabular-nums tracking-wide text-[#8dffb0]">
                +{formatRate(rate)}/s{night ? ' 🌙' : ''}
              </span>
            </div>
          </div>

          {/* Quête en cours : toucher le bandeau ouvre le grimoire */}
          <button
            onClick={() => {
              haptic(10)
              sfx('hover')
              openGrimoire()
            }}
            className="gpanel pointer-events-auto relative flex w-full max-w-[17rem] items-center gap-2 !rounded-2xl py-1.5 pl-1.5 pr-2.5 text-left transition-transform active:translate-y-1"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl border-[3px] border-[#6b4000] bg-gradient-to-b from-[#ffe680] to-[#f2a600] text-2xl leading-none shadow-[inset_0_2px_0_rgba(255,255,255,0.7),0_3px_0_#6b4000]">
              📜
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="stroke-sm line-clamp-2 font-display text-[13px] uppercase leading-[15px] [--edge:#2a170c]">
                {victory ? t('hud.worldDone') : goal ? goalText(goal) : finaleText(finale)}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="ginset gbar flex-1">
                  <i style={{ width: `${goals.length ? (done / goals.length) * 100 : 0}%` }} />
                </span>
                <span className="stroke-sm font-display text-[11px] tabular-nums [--edge:#2a170c]">
                  {done}/{goals.length}
                </span>
              </span>
              {/* La fin du monde, toujours visible : items à découvrir, puis le million de coquillages à atteindre */}
              <span className="stroke-sm font-display text-[10px] tabular-nums leading-none [--edge:#2a170c] [-webkit-text-stroke-width:2px]">
                🗿 {end.found}/{finale.requires.length} · {formatNumber(Math.min(shells, finale.shells))}/{formatNumber(finale.shells)} 🐚
              </span>
            </span>
          </button>
        </div>

        {/* Colonne droite : boutons carrés empilés, avec leur libellé */}
        <div className="pointer-events-auto flex shrink-0 flex-col items-center gap-3 pt-0.5">
          <div className="relative">
            <GameButton variant="blue" shape="icon" shine onClick={openGrimoire} aria-label={t('hud.grimoire')}>
              📖
            </GameButton>
            {newDiscoveries > 0 && <Badge className="absolute -right-2 -top-2 z-10 animate-bump">{newDiscoveries}</Badge>}
          </div>
          <GameButton
            variant={editMode ? 'green' : 'orange'}
            shape="icon"
            aria-pressed={editMode}
            aria-label={editMode ? t('hud.finish') : t('hud.expand')}
            onClick={() => {
              if (!editMode) {
                sfx('anvil')
                setTimeout(() => sfx('axe'), BUILD_AXE_DELAY_MS)
              }
              toggleEditMode()
            }}
          >
            <span className={editMode ? 'animate-wiggle' : ''}>{editMode ? '✔️' : '🛠️'}</span>
          </GameButton>
        </div>
      </div>

      {/* Hors de la ligne ci-dessus : sinon il allonge la colonne de gauche */}
      <div className="mt-1.5 w-[8.75rem]">
        <FpsCounter />
      </div>

      {report && (
        <div className="pointer-events-auto fixed inset-0 z-40 grid place-items-center bg-[#140a04]/70 px-6">
          <div role="status" className="gwindow relative w-full max-w-sm animate-pop px-4 pb-4 pt-9 text-center">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <Ribbon>{t('hud.welcomeBack')}</Ribbon>
            </div>
            <div className="stroke-sm font-display text-[14px] uppercase [--edge:#2a170c]">
              {t('hud.whileAway', { duration: formatDuration(report.seconds) })}
              {report.capped ? t('hud.capped') : ''}
            </div>
            <div className="ginset my-3 rounded-2xl px-3 py-3">
              <div className="stroke text-[34px] [--edge:#140a04]">+{formatNumber(report.shells)} 🐚</div>
              <div className="mt-1 flex flex-wrap justify-center gap-x-3 font-display text-[18px] text-[#fff3d6]">
                {Object.entries(report.items).map(([id, n]) => (
                  <span key={id}>
                    +{formatNumber(n)} {rules.items[id]?.icon}
                  </span>
                ))}
              </div>
            </div>
            {report.doubled ? (
              <div className="stroke-sm mb-2 font-display text-[16px] uppercase text-[#fff3d6] [--edge:#2a170c]">{t('hud.doubled')}</div>
            ) : (
              adReady && (
                <GameButton
                  variant="orange"
                  disabled={adLoading}
                  onClick={async () => {
                    setAdLoading(true)
                    const result = await watchRewardedAd()
                    setAdLoading(false)
                    if (result === 'rewarded') doubleReport()
                  }}
                  className="mb-2 w-full !py-2.5 !text-[18px]"
                >
                  {adLoading ? t('hud.adLoading') : t('hud.watchAd')}
                </GameButton>
              )
            )}
            <GameButton variant="green" shine onClick={dismiss} className="w-full !py-3 !text-[22px]">
              {t('hud.collect')}
            </GameButton>
          </div>
        </div>
      )}
    </header>
  )
}

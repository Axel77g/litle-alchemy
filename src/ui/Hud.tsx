import { useMemo } from 'react'
import { shellRate } from '../engine/production'
import { useGame } from '../store/game'
import { formatDuration, formatNumber, formatRate } from './format'
import FpsCounter from './FpsCounter'
import { haptic } from './haptics'
import { toggleEditMode, useUi } from './uiStore'

// HUD compact : trois blocs sur une seule ligne (compteur + bouton d'agrandissement | objectif | grimoire), pour laisser l'île respirer
export default function Hud() {
  const shells = useGame((s) => s.shells)
  const world = useGame((s) => s.world)
  const rules = useGame((s) => s.rules)
  const night = useGame((s) => s.night)
  const seen = useGame((s) => s.seen)
  const goals = useGame((s) => s.goals)
  const victory = useGame((s) => s.victory)
  const report = useGame((s) => s.offlineReport)
  const dismiss = useGame((s) => s.dismissOfflineReport)
  const editMode = useUi((s) => s.editMode)
  const newDiscoveries = useUi((s) => s.newDiscoveries)
  const rate = useMemo(() => shellRate(rules, world, night), [rules, world, night])
  const done = goals.filter((g) => seen[g.item]).length
  const goal = goals.find((g) => !seen[g.item])

  return (
    // Le conteneur laisse passer les doigts vers la 3D : seuls les éléments visibles les captent
    <header data-hud className="pointer-events-none fixed inset-x-0 top-0 z-30 px-gutter pt-safe">
      <div data-hud-row className="mt-2 flex items-stretch gap-2">
        {/* Colonne gauche : compteur de coquillages, et juste dessous le bouton du mode agrandissement */}
        <div className="flex w-[8.75rem] shrink-0 flex-col gap-1.5">
          <div className="pointer-events-auto relative flex items-center rounded-full bg-surface-container py-1 pl-10 pr-3 shadow-chunk">
            <div
              data-shell-target
              className="absolute -left-2 grid size-10 place-items-center rounded-full bg-secondary text-xl leading-none shadow-chunk-sm ring-2 ring-surface-container-lowest"
            >
              🐚
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-display text-counter-numerical tabular-nums text-tertiary">{formatNumber(shells)}</span>
              <span className="mt-0.5 font-display text-[10px] font-extrabold tabular-nums tracking-tight text-primary">
                +{formatRate(rate)}/s{night ? ' 🌙' : ''}
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              haptic(10)
              toggleEditMode()
            }}
            aria-pressed={editMode}
            className={[
              'pointer-events-auto flex h-8 w-full items-center justify-center gap-1.5 rounded-full font-display text-label-chunky-sm uppercase transition-all active:translate-y-1 active:shadow-chunk-press',
              editMode ? 'bg-primary-container text-on-primary shadow-[0_4px_0_#00573f]' : 'bg-surface-container-high text-on-surface shadow-chunk',
            ].join(' ')}
          >
            <span className={editMode ? 'animate-wiggle' : ''}>🛠️</span>
            {editMode ? 'Terminer' : 'Agrandir'}
          </button>
        </div>

        {/* Objectif en cours et avancement du monde */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 rounded-2xl bg-surface-container-low px-2.5 py-1.5 shadow-chunk">
          <span className="line-clamp-2 font-display text-[11px] font-extrabold uppercase leading-[13px] text-tertiary">
            🎯 {victory ? 'Monde terminé !' : (goal?.text ?? '')}
          </span>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 flex-1 rounded-full bg-surface-container-lowest p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-secondary-container via-tertiary to-primary-container shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] transition-all duration-500"
                style={{ width: `${goals.length ? (done / goals.length) * 100 : 0}%` }}
              />
            </div>
            <span className="font-display text-[10px] font-black tabular-nums text-secondary-fixed-dim">
              {done}/{goals.length}
            </span>
          </div>
        </div>

        {/* Grimoire des recettes : la pastille compte les découvertes depuis la dernière ouverture */}
        <button
          onClick={() => {
            haptic(10)
            useUi.setState({ grimoireOpen: true, newDiscoveries: 0 })
          }}
          className="pointer-events-auto relative grid size-12 shrink-0 place-items-center self-start rounded-2xl bg-surface-container-high text-2xl shadow-chunk transition-all active:translate-y-1 active:shadow-chunk-press"
          aria-label="Grimoire des recettes"
        >
          📖
          {newDiscoveries > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid min-w-5 animate-bump place-items-center rounded-full bg-error px-1 font-display text-[11px] font-black text-on-error shadow-[0_2px_0_#690005]">
              {newDiscoveries}
            </span>
          )}
        </button>
      </div>

      {/* Hors de la ligne ci-dessus : sinon il allonge la colonne de gauche et étire le bloc d'objectif (items-stretch) */}
      <div className="mt-1.5 w-[8.75rem]">
        <FpsCounter />
      </div>

      {report && (
        <div
          role="status"
          className="pointer-events-auto mt-2 flex w-full max-w-md animate-slide-down flex-col gap-space-xs rounded-2xl bg-surface-container-high p-space-md shadow-chunk-lg ring-2 ring-tertiary"
        >
          <span className="font-display text-label-chunky-lg uppercase text-tertiary">
            Pendant ton absence · {formatDuration(report.seconds)}
            {report.capped ? ' (plafonné)' : ''}
          </span>
          <span className="font-display text-title-sm text-on-surface">
            +{formatNumber(report.shells)} 🐚
            {Object.entries(report.items).map(([id, n]) => (
              <span key={id}> · +{formatNumber(n)} {rules.items[id]?.icon}</span>
            ))}
          </span>
          <button
            onClick={dismiss}
            className="self-end rounded-xl bg-primary-container px-5 py-1.5 font-display text-label-chunky-lg text-on-primary shadow-[0_4px_0_#00573f] transition-all active:translate-y-1 active:shadow-none"
          >
            RÉCUPÉRER
          </button>
        </div>
      )}
    </header>
  )
}

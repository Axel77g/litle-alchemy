import type { ItemDef, Ruleset } from '../engine/items'
import { SHELL } from '../engine/items'
import { formatNumber } from './format'
import ItemIcon from './ItemIcon'

// Chaque type de carte a sa couleur : cadre épais, fond de l'icône, lueur derrière l'icône et pastille du bas
const KIND = {
  material: {
    frame: 'bg-gradient-to-b from-[#c9c3dc] to-[#8e88a8]',
    panel: 'from-[#fff7e6] via-[#fff1d6] to-[#ffe2b0]',
    glow: 'bg-[#ffd98a]/70',
    chip: 'bg-[#e9dcc2] text-card-ink',
  },
  producer: {
    frame: 'bg-gradient-to-b from-primary to-primary-container',
    panel: 'from-[#f1fff8] via-[#d9fbec] to-[#aef2d6]',
    glow: 'bg-primary/80',
    chip: 'bg-primary-container text-on-primary',
  },
  catalyst: {
    frame: 'bg-gradient-to-b from-tertiary to-secondary-container',
    panel: 'from-[#fff4e8] via-[#ffe1c4] to-[#ffc08f]',
    glow: 'bg-secondary-container/80 animate-pulse',
    chip: 'bg-secondary-container text-surface-container-lowest',
  },
} as const

// Ce que la carte rapporte (producteurs) ou le nombre de recettes où elle intervient (le reste)
function hint(def: ItemDef, rules: Ruleset): string {
  if (def.kind === 'producer' && def.production) {
    const p = def.production[0]
    const perSecond = (p.amount ?? 1) / p.every
    const what = p.output === SHELL ? '🐚' : rules.items[p.output]?.icon
    return perSecond >= 0.1 ? `+${perSecond % 1 ? perSecond.toFixed(1) : perSecond} ${what}/s` : `${what} /${p.every}s`
  }
  const n = rules.recipes.filter((r) => r.inputs.includes(def.id)).length
  return n ? `${n} recette${n > 1 ? 's' : ''}` : 'Matière'
}

interface CardProps {
  def: ItemDef
  count: number
  rules: Ruleset
  dragging: boolean // cette carte est en train d'être glissée
  mergeResult: ItemDef | undefined // résultat de la fusion si une carte glissée survole celle-ci
  cost?: number // prix de pose (producteurs payants) ; absent ou 0 = gratuit
  broke?: boolean // le joueur n'a pas assez de coquillages pour la poser
  onPointerDown: (e: React.PointerEvent) => void
}

export default function Card({ def, count, rules, dragging, mergeResult, cost, broke, onPointerDown }: CardProps) {
  const kind = KIND[def.kind]
  return (
    <div className="relative shrink-0">
      {/* Bulle de découverte : ce que donnerait la fusion */}
      {mergeResult && (
        <div className="absolute -top-[30px] left-0 z-40 animate-float whitespace-nowrap rounded-full bg-secondary-container px-3 py-1 font-display text-[13px] font-black text-surface-container-lowest shadow-chunk ring-2 ring-tertiary">
          {def.icon} → {mergeResult.icon} {mergeResult.name}
        </div>
      )}

      {/* Cadre coloré épais (3px) autour d'un panneau crème dégradé */}
      <article
        data-item={def.id}
        onPointerDown={onPointerDown}
        title={def.name}
        className={[
          'relative flex w-[112px] cursor-grab flex-col rounded-2xl p-[3px]',
          kind.frame,
          // touch-action: pan-x -> un balayage horizontal fait défiler le dock, un glissé vers le haut déplace la carte
          'touch-pan-x transition-all duration-150 ease-bouncy',
          'hover:-translate-y-1.5 hover:shadow-card-hover',
          'active:translate-y-1.5 active:scale-95 active:shadow-card-press',
          mergeResult
            ? '-translate-y-4 rotate-3 scale-110 shadow-card-lift ring-4 ring-tertiary'
            : dragging
              ? 'scale-90 opacity-40 shadow-card'
              : 'shadow-card',
          broke && !mergeResult && !dragging ? 'saturate-50' : '',
        ].join(' ')}
      >
        {/* Pastille de quantité */}
        <span
          key={count}
          className={`absolute -right-2 -top-2.5 z-10 min-w-7 animate-bump rounded-full bg-surface-container-lowest px-1.5 py-0.5 text-center font-display text-[13px] font-black text-tertiary shadow-chunk-sm ring-2 ring-surface-container-high ${mergeResult ? 'invisible' : ''}`}
        >
          ×{formatNumber(count)}
        </span>

        {/* Prix de pose : rouge tant qu'on n'a pas assez de coquillages */}
        {!!cost && !mergeResult && (
          <span
            className={`absolute -bottom-2.5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 font-display text-[12px] font-black shadow-chunk-sm ring-2 ring-surface-container-high ${broke ? 'bg-[#ffd9d4] text-[#b3261e]' : 'bg-surface-container-lowest text-card-ink'}`}
          >
            🐚 {formatNumber(cost)}
          </span>
        )}

        <div className={`flex flex-col gap-1 rounded-[13px] bg-gradient-to-b px-1.5 pb-1.5 pt-1.5 ${kind.panel}`}>
          {/* Icône (rendu 3D avec contour blanc) sur son halo flou coloré */}
          <div className="relative grid h-[62px] place-items-center">
            <div className={`absolute size-[58px] rounded-full blur-lg ${kind.glow}`} />
            <ItemIcon def={def} size={75} className="relative -top-2" />
          </div>

          {/* La hauteur fixe garde toutes les cartes alignées, même quand le nom passe sur 2 lignes */}
          <div className="flex h-8 items-center justify-center text-center font-display text-[13px] font-black leading-[14px] text-card-ink">
            {def.name}
          </div>

          <div className={`rounded-lg py-1 text-center font-display text-[12px] font-black shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)] ${kind.chip}`}>
            {hint(def, rules)}
          </div>
        </div>
      </article>
    </div>
  )
}

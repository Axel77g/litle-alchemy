import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { itemName, t } from '../i18n'
import type { ItemDef, Ruleset } from '../engine/items'
import type { ItemId } from '../engine/types'
import { SHELL } from '../engine/items'
import { formatNumber } from '../shared/format'
import ItemIcon from './ItemIcon'

// Chaque type de carte a sa couleur : cadre épais, fond de l'icône, lueur derrière l'icône et pastille du bas
const KIND = {
  material: {
    frame: 'bg-gradient-to-b from-[#e8d3a0] to-[#a8844a]',
    panel: 'from-[#fff7e6] via-[#fff1d6] to-[#ffe2b0]',
    glow: 'bg-[radial-gradient(closest-side,rgba(255,217,138,0.75),transparent)]',
    chip: 'bg-[#e9dcc2] text-card-ink',
  },
  producer: {
    frame: 'bg-gradient-to-b from-primary to-primary-container',
    panel: 'from-[#f1fff8] via-[#d9fbec] to-[#aef2d6]',
    glow: 'bg-[radial-gradient(closest-side,rgba(71,243,187,0.8),transparent)]',
    chip: 'bg-primary-container text-on-primary',
  },
  catalyst: {
    frame: 'bg-gradient-to-b from-tertiary to-secondary-container',
    panel: 'from-[#fff4e8] via-[#ffe1c4] to-[#ffc08f]',
    glow: 'bg-[radial-gradient(closest-side,rgba(254,107,0,0.8),transparent)] animate-pulse',
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
  return n ? t('card.recipe', { count: n }) : t('card.material')
}

interface CardProps {
  def: ItemDef
  count: number
  rules: Ruleset
  dragging: boolean // cette carte est en train d'être glissée
  mergeResult: ItemDef | undefined // résultat de la fusion si une carte glissée survole celle-ci
  cost?: number // prix de pose (producteurs payants) ; absent ou 0 = gratuit
  broke?: boolean // le joueur n'a pas assez de coquillages pour la poser
  onGrab: (e: React.PointerEvent, itemId: ItemId) => void // stable (voir useDrag) : garde Card mémoïsable
}

export default memo(function Card({ def, count, rules, dragging, mergeResult, cost, broke, onGrab }: CardProps) {
  useTranslation()
  const kind = KIND[def.kind]
  return (
    <div className="group relative shrink-0">
      {/* Bulle de découverte : ce que donnerait la fusion */}
      {mergeResult && (
        <div className="stroke-sm absolute -top-[34px] left-0 z-40 animate-float whitespace-nowrap rounded-full border-[3px] border-[#7a2e05] bg-gradient-to-b from-[#ffc247] to-[#f4700a] px-3 py-0.5 font-display text-[14px] shadow-[0_3px_0_#7a2e05] [--edge:#7a2e05]">
          {def.icon} → {mergeResult.icon} {itemName(mergeResult)}
        </div>
      )}

      {/* Cadre coloré épais (3px) autour d'un panneau crème dégradé */}
      <article
        data-item={def.id}
        onPointerDown={(e) => onGrab(e, def.id)}
        onContextMenu={(e) => e.preventDefault()} // l'appui long ouvre la fiche : pas le menu du navigateur
        title={itemName(def)}
        className={[
          'relative flex w-[102px] cursor-grab select-none flex-col rounded-2xl p-[3px] [-webkit-touch-callout:none]',
          kind.frame,
          // touch-action: pan-x -> un balayage horizontal fait défiler le dock, un glissé vers le haut déplace la carte
          // Aucune transition : survol, appui et aperçu de fusion changent d'état instantanément (l'ease à dépassement donnait un effet « grow » qui sautait).
          // Le survol est porté par le conteneur (group), qui ne bouge pas : sinon le lift de 6 px sort le pointeur de la carte, qui retombe, puis remonte, en boucle.
          'touch-pan-x',
          'group-hover:-translate-y-1.5 group-hover:shadow-card-hover',
          'active:translate-y-1.5 active:scale-95 active:shadow-card-press',
          mergeResult
            ? '-translate-y-4 rotate-3 scale-110 shadow-card-lift ring-4 ring-tertiary'
            : dragging
              ? 'scale-90 opacity-40 shadow-card'
              : 'shadow-card',
          broke && !mergeResult && !dragging ? 'opacity-75' : '',
        ].join(' ')}
      >
        {/* Pastille de quantité */}
        <span
          key={count}
          className={`stroke-sm absolute -right-2.5 -top-3 z-10 min-w-7 animate-bump rounded-full border-[3px] border-[#6e0e12] bg-gradient-to-b from-[#ff8a78] to-[#e0302a] px-1.5 py-0.5 text-center font-display text-[14px] shadow-[0_3px_0_#6e0e12] [--edge:#6e0e12] ${mergeResult ? 'invisible' : ''}`}
        >
          ×{formatNumber(count)}
        </span>

        {/* Prix de pose : rouge tant qu'on n'a pas assez de coquillages */}
        {!!cost && !mergeResult && (
          <span
            className={`stroke-sm absolute -bottom-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border-[3px] px-2 py-0.5 font-display text-[13px] ${broke ? 'border-[#6e0e12] bg-gradient-to-b from-[#ff8a78] to-[#e0302a] shadow-[0_3px_0_#6e0e12] [--edge:#6e0e12]' : 'border-[#6b4000] bg-gradient-to-b from-[#ffe680] to-[#f2a600] shadow-[0_3px_0_#6b4000] [--edge:#6b4000]'}`}
          >
            🐚 {formatNumber(cost)}
          </span>
        )}

        {/* Papier de la carte : dégradé de couleur, grain, liseré imprimé à l'intérieur (comme la bordure d'une vraie carte) */}
        <div className={`relative flex flex-col gap-1 rounded-[13px] bg-gradient-to-b px-1.5 pb-1.5 pt-1 shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.65),inset_0_-3px_0_rgba(0,0,0,0.12)] ${kind.panel}`}>
          <div className="card-paper pointer-events-none absolute inset-0 rounded-[13px] mix-blend-multiply" />
          <div className="pointer-events-none absolute inset-[3px] rounded-[10px] border border-[#5a3a14]/25" />

          {/* Fenêtre d'illustration : en creux, avec un liseré clair */}
          <div className="relative mx-0.5 mt-0.5 grid h-[54px] place-items-center rounded-lg bg-gradient-to-b from-black/[0.03] to-black/[0.13] shadow-[inset_0_2px_4px_rgba(0,0,0,0.25),0_1px_0_rgba(255,255,255,0.8)]">
            <div className={`absolute size-[68px] ${kind.glow}`} />
            <ItemIcon def={def} size={66} className="relative -top-2" />
          </div>

          {/* La hauteur fixe garde toutes les cartes alignées, même quand le nom passe sur 2 lignes */}
          <div className="relative flex h-7 items-center justify-center text-center font-display text-[12px] font-black leading-[13px] text-card-ink">
            {itemName(def)}
          </div>

          <div className={`relative rounded-lg py-0.5 text-center font-display text-[11px] font-black shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)] ${kind.chip}`}>
            {hint(def, rules)}
          </div>
        </div>
      </article>
    </div>
  )
})

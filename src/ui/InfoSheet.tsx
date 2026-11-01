import type { ReactNode } from 'react'
import { SHELL, type ItemDef, type Ruleset } from '../engine/items'
import { FRENZY_MULTIPLIER } from '../engine/production'
import { Trans, useTranslation } from 'react-i18next'
import { itemDesc, itemName, t } from '../i18n'
import { useGame } from '../store/game'
import { GameWindow } from './Game'
import { formatDuration, formatNumber, formatRate } from './format'
import ItemIcon from './ItemIcon'
import { useUi } from './uiStore'

const close = () => useUi.setState({ infoCard: null })

// Qui est visé par un bonus ou une frénésie : le tag de l'item (voir tag.* dans les traductions)
const target = (tag?: string) => (tag ? t(`tag.${tag}`, { defaultValue: tag }) : t('tag.all'))

const percent = (n: number) => `+${Math.round(n * 100)} %`

interface Effect {
  icon: ReactNode
  text: ReactNode
  tone?: 'loot' | 'boost' | 'info'
}

const nameOf = (rules: Ruleset, id: string) => (id === SHELL ? t('common.shells') : rules.items[id] ? itemName(rules.items[id]) : id)

// Icône d'un item : son rendu 3D (comme sur les cartes), l'emoji pour les coquillages (pas un item) ou si le rendu n'est pas prêt
const GLYPH_SCALE = 1.7 // les icônes en ligne sont agrandies pour rester lisibles sur mobile
export function Glyph({ rules, id, size: base = 22 }: { rules: Ruleset; id: string; size?: number }) {
  const size = Math.round(base * GLYPH_SCALE)
  const def = id === SHELL ? undefined : rules.items[id]
  if (!def) return <span className="leading-none" style={{ fontSize: size * 0.85 }}>{id === SHELL ? '🐚' : '?'}</span>
  return <ItemIcon def={def} size={size} sticker={false} className="inline-block shrink-0 align-middle" />
}
const iconOf = (rules: Ruleset, id: string) => <Glyph rules={rules} id={id} />

// Tout ce que la carte fait, ligne par ligne : ce qu'elle produit (loot), les bonus qu'elle donne et ses autres pouvoirs.
// Lit directement les données du monde : la fiche ne peut pas mentir quand on rééquilibre un item.
export function effectsOf(def: ItemDef, rules: Ruleset, withProduction = true): Effect[] {
  const out: Effect[] = []
  const b = { b: <b /> }

  for (const p of withProduction ? (def.production ?? []) : []) {
    const amount = p.amount ?? 1
    const what = `${amount > 1 ? `${formatNumber(amount)} ` : ''}${nameOf(rules, p.output)}`
    const rate = p.output === SHELL && amount / p.every >= 1 ? t('effects.rate', { rate: formatRate(amount / p.every) }) : ''
    const limit = p.limit ? (p.limit === 1 ? t('effects.once') : t('effects.limit', { count: p.limit })) : ''
    out.push({
      icon: iconOf(rules, p.output),
      tone: 'loot',
      text: (
        <>
          <Trans i18nKey="effects.produces" values={{ what, every: formatDuration(p.every) }} components={b} />
          {rate}
          {limit}
        </>
      ),
    })
  }

  if (def.aura) {
    const { area, speedMultiplier, valueMultiplier, affectsTag } = def.aura
    const values = { target: target(affectsTag), area: t(`area.${area}`) }
    if (speedMultiplier)
      out.push({ icon: '⚡', tone: 'boost', text: <Trans i18nKey="effects.speed" values={{ ...values, percent: percent(speedMultiplier) }} components={b} /> })
    if (valueMultiplier)
      out.push({ icon: '🐚', tone: 'boost', text: <Trans i18nKey="effects.value" values={{ ...values, percent: percent(valueMultiplier) }} components={b} /> })
  }
  if (def.nightMultiplier && def.nightMultiplier !== 1)
    out.push({ icon: '🌙', tone: 'boost', text: <Trans i18nKey="effects.night" values={{ mult: +def.nightMultiplier.toFixed(2) }} components={b} /> })
  if (def.dockBonus) out.push({ icon: '📦', tone: 'boost', text: <Trans i18nKey="effects.dock" values={{ count: def.dockBonus }} components={b} /> })
  if (def.frenzy)
    out.push({
      icon: '🔥',
      tone: 'boost',
      text: <Trans i18nKey="effects.frenzy" values={{ target: target(def.frenzy.targetTag), mult: FRENZY_MULTIPLIER, duration: formatDuration(def.frenzy.duration) }} components={b} />,
    })
  if (def.flood) out.push({ icon: '🌊', tone: 'info', text: <Trans i18nKey="effects.flood" components={b} /> })
  return out
}

// Recettes : ce qu'on obtient avec la carte, et comment l'obtenir
function recipeLines(def: ItemDef, rules: Ruleset) {
  const chip = (id: string, n = 1) => (
    <span key={id} className="inline-flex items-center gap-0.5 align-middle">
      {n > 1 && `${n}×`}
      <Glyph rules={rules} id={id} size={24} />
      {nameOf(rules, id)}
    </span>
  )
  const names = (ids: string[]): ReactNode => {
    const count = new Map<string, number>()
    for (const id of ids) count.set(id, (count.get(id) ?? 0) + 1)
    return (
      <span className="inline-flex flex-wrap items-center gap-x-1.5">
        {[...count].flatMap(([id, n], i) => (i ? [<span key={`+${id}`}>+</span>, chip(id, n)] : [chip(id, n)]))}
      </span>
    )
  }
  const uses = rules.recipes
    .filter((r) => r.inputs.includes(def.id))
    .map((r) => ({ key: `${r.inputs.join('|')}>${r.result}`, node: <>{names(r.inputs)} → {chip(r.result)}</> }))
  const made = rules.recipes.filter((r) => r.result === def.id).map((r) => ({ key: r.inputs.join('|'), node: names(r.inputs) }))
  const droppedBy = Object.values(rules.items)
    .filter((i) => i.production?.some((p) => p.output === def.id))
    .map((i) => ({ key: i.id, node: chip(i.id) }))
  if (rules.terrainProduction.WATER?.some((p) => p.output === def.id)) droppedBy.push({ key: 'water-block', node: <>{t('info.waterBlock')}</> })
  return { uses, made, droppedBy }
}

// Fiche d'infos d'une carte du dock (appui long) : description, effets / loot, valeur, recettes
export default function InfoSheet() {
  const itemId = useUi((s) => s.infoCard)
  return itemId ? <Info key={itemId} itemId={itemId} /> : null
}

function Info({ itemId }: { itemId: string }) {
  useTranslation()
  const rules = useGame((s) => s.rules)
  const count = useGame((s) => s.inventory[itemId] ?? 0)
  const def = rules.items[itemId]
  if (!def) return null

  const effects = effectsOf(def, rules)
  const { uses, made, droppedBy } = recipeLines(def, rules)

  return (
    <GameWindow title={itemName(def)} onClose={close}>
      <div className="no-scrollbar -mx-1 mt-1 flex flex-col gap-3 overflow-y-auto px-1 pb-1 pt-1">
        <div className="flex items-center gap-3">
          <div className="grid size-20 shrink-0 place-items-center rounded-2xl bg-gradient-to-b from-[#fff7e6] to-[#ffe2b0] shadow-[0_3px_0_#140a04]">
            <ItemIcon def={def} size={68} />
          </div>
          <div className="flex flex-col items-start gap-1.5">
            <span className="stroke-sm rounded-full bg-primary-container px-2.5 py-0.5 font-display text-[12px] [--edge:#0b3d24]">
              {t(`kind.${def.kind}`)} · {t('info.tier', { tier: def.tier })}
            </span>
            <span className="stroke-sm font-display text-[14px] [--edge:#140a04]">{t('info.stock', { count: formatNumber(count) })}</span>
          </div>
        </div>

        {def.desc && <p className="ginset rounded-2xl p-3 font-display text-[14px] leading-snug">{itemDesc(def)}</p>}

        {effects.length > 0 && (
          <Section title={t('info.effects')}>
            {effects.map((e, i) => (
              <Line key={i} icon={e.icon} tone={e.tone}>
                {e.text}
              </Line>
            ))}
          </Section>
        )}

        {(!!def.cost || !!def.sellValue) && (
          <Section title={t('info.value')}>
            {!!def.cost && <Line icon="🏗️"><Trans i18nKey="info.place" values={{ cost: formatNumber(def.cost) }} components={{ b: <b /> }} /></Line>}
            {!!def.sellValue && <Line icon="🐚"><Trans i18nKey="info.sell" values={{ value: formatNumber(def.sellValue) }} components={{ b: <b /> }} /></Line>}
          </Section>
        )}

        {droppedBy.length > 0 && (
          <Section title={t('info.droppedBy')}>
            {droppedBy.map((t) => (
              <Line key={t.key} icon="🎁">{t.node}</Line>
            ))}
          </Section>
        )}
        {made.length > 0 && (
          <Section title={t('info.madeWith')}>
            {made.map((t) => (
              <Line key={t.key} icon="🧪">{t.node}</Line>
            ))}
          </Section>
        )}
        {uses.length > 0 && (
          <Section title={t('info.usedFor')}>
            {uses.map((t) => (
              <Line key={t.key} icon="➡️">{t.node}</Line>
            ))}
          </Section>
        )}
      </div>
    </GameWindow>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="stroke-sm font-display text-[13px] uppercase tracking-wide [--edge:#140a04]">{title}</div>
      {children}
    </div>
  )
}

const TONE = { loot: 'bg-[#e6fbef]', boost: 'bg-[#fff0cc]', info: 'bg-[#e9dcc2]' } as const
const GRAIN = 'bg-[image:var(--grain)] bg-[length:120px_120px] bg-blend-multiply'

function Line({ icon, tone = 'info', children }: { icon: ReactNode; tone?: keyof typeof TONE; children: ReactNode }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 font-display text-[13px] font-bold leading-tight text-card-ink shadow-[0_2px_0_rgba(0,0,0,0.25)] ${TONE[tone]} ${GRAIN}`}>
      <span className="grid w-10 shrink-0 place-items-center text-3xl leading-none">{icon}</span>
      <span>{children}</span>
    </div>
  )
}

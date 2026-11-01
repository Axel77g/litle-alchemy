import { useEffect } from 'react'
import { launchShellsFrom } from '../fx/shellFlight'
import { maxMerges } from '../engine/inventory'
import { findCraft } from '../engine/items'
import { useGame } from '../store/game'
import { formatNumber } from './format'
import ItemIcon from './ItemIcon'
import QuantitySheet from './QuantitySheet'
import { useUi } from './uiStore'

const close = () => useUi.setState({ mergePrompt: null, sellPrompt: null })

// Fenêtre « combien fusionner ? » : s'ouvre quand on lâche une carte sur une autre alors que l'inventaire permet plusieurs fusions
export default function MergeSheet() {
  const prompt = useUi((s) => s.mergePrompt)
  return prompt ? <Merge key={`${prompt.a}|${prompt.b}`} a={prompt.a} b={prompt.b} /> : null
}

function Merge({ a, b }: { a: string; b: string }) {
  const rules = useGame((s) => s.rules)
  const inventory = useGame((s) => s.inventory)
  const merge = useGame((s) => s.merge)
  const recipe = findCraft(rules, inventory, a, b)
  const max = maxMerges(rules, inventory, a, b) // se met à jour si la production change l'inventaire pendant que la fenêtre est ouverte

  useEffect(() => {
    if (!recipe) close() // plus de quoi fusionner
  }, [recipe])
  if (!recipe) return null

  const result = rules.items[recipe.result]
  const need = new Map<string, number>()
  for (const id of recipe.inputs) need.set(id, (need.get(id) ?? 0) + 1)

  return (
    <QuantitySheet
      title="Combien fusionner ?"
      max={max}
      confirmLabel={(n) => `Fusionner ×${n}`}
      onClose={close}
      onConfirm={(n) => {
        merge(a, b, n)
        close()
      }}
      preview={(n) => (
        <>
          {/* La recette : ingrédients consommés → résultat obtenu, multipliés par la quantité choisie */}
          <div className="flex items-center justify-center gap-space-sm">
            <div className="flex flex-wrap items-center justify-center gap-space-xs">
              {[...need].map(([id, per]) => (
                <div key={id} className="rounded-xl bg-[#fff1d6] px-2.5 py-1.5 text-center shadow-[0_3px_0_#140a04]">
                  <ItemIcon def={rules.items[id]} size={40} />
                  <div className="font-display text-[15px] text-card-ink">×{formatNumber(per * n)}</div>
                </div>
              ))}
            </div>
            <span className="stroke text-3xl [--edge:#7a2e05]">→</span>
            <div className="rounded-xl bg-card px-3 py-1.5 text-center shadow-[0_3px_0_#140a04] ring-4 ring-[#ffcf4a]">
              <ItemIcon def={result} size={48} />
              <div className="font-display text-[15px] text-card-ink">×{formatNumber(n)}</div>
            </div>
          </div>
          <div className="stroke-sm mt-1 text-center font-display text-[15px] [--edge:#140a04]">{result.name}</div>
        </>
      )}
    />
  )
}

// Fenêtre « combien vendre ? » : s'ouvre quand on lâche une carte en plusieurs exemplaires sur la zone Vendre
export function SellSheet() {
  const itemId = useUi((s) => s.sellPrompt)
  return itemId ? <Sell key={itemId} itemId={itemId} /> : null
}

function Sell({ itemId }: { itemId: string }) {
  const rules = useGame((s) => s.rules)
  const have = useGame((s) => s.inventory[itemId] ?? 0)
  const sell = useGame((s) => s.sell)
  const def = rules.items[itemId]
  const value = def?.sellValue ?? 0

  useEffect(() => {
    if (!have || !value) close() // plus rien à vendre
  }, [have, value])
  if (!have || !value) return null

  return (
    <QuantitySheet
      title="Combien vendre ?"
      max={have}
      confirmLabel={(n) => `Vendre +${formatNumber(n * value)} 🐚`}
      onClose={close}
      onConfirm={(n) => {
        if (sell(itemId, n)) {
          const r = document.querySelector('[data-sell]')?.getBoundingClientRect()
          launchShellsFrom({ x: r ? r.left + r.width / 2 : window.innerWidth / 2, y: r ? r.top : window.innerHeight - 120 }, n * value)
        }
        close()
      }}
      preview={(n) => (
        <div className="flex items-center justify-center gap-space-sm">
          <div className="rounded-xl bg-[#fff1d6] px-3 py-1.5 text-center shadow-[0_3px_0_#140a04]">
            <ItemIcon def={def} size={48} />
            <div className="font-display text-[15px] text-card-ink">×{formatNumber(n)}</div>
          </div>
          <span className="stroke text-3xl [--edge:#7a2e05]">→</span>
          <div className="rounded-xl bg-gradient-to-b from-[#ffe680] to-[#f2a600] px-3 py-1.5 text-center shadow-[0_3px_0_#140a04] ring-4 ring-[#fff]">
            <div className="text-4xl leading-none">🐚</div>
            <div className="stroke-sm text-[15px] [--edge:#6b4000]">+{formatNumber(n * value)}</div>
          </div>
        </div>
      )}
    />
  )
}

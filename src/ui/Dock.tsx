import { useCallback } from 'react'
import { emit } from '../engine/events'
import { previewDrop } from '../engine/grid'
import { placementCost, useCost } from '../engine/pricing'
import { maxMerges } from '../engine/inventory'
import { findCraft } from '../engine/items'
import { launchShellsFrom } from '../fx/shellFlight'
import type { ItemId } from '../engine/types'
import { useGame } from '../store/game'
import Card from './Card'
import { formatNumber } from './format'
import ItemIcon from './ItemIcon'
import { haptic } from './haptics'
import { pickCell, useUi } from './uiStore'

const KIND_ORDER = { producer: 0, material: 1, catalyst: 2 } as const

export default function Dock() {
  const inventory = useGame((s) => s.inventory)
  const rules = useGame((s) => s.rules)
  const world = useGame((s) => s.world)
  const shells = useGame((s) => s.shells)
  const drag = useUi((s) => s.drag)
  const startDrag = useDrag()

  const cards = Object.entries(inventory)
    .filter(([id, n]) => n > 0 && rules.items[id])
    .map(([id, n]) => ({ def: rules.items[id], n }))
    .sort((a, b) => KIND_ORDER[a.def.kind] - KIND_ORDER[b.def.kind] || a.def.tier - b.def.tier || a.def.name.localeCompare(b.def.name))
  const total = cards.reduce((sum, c) => sum + c.n, 0)
  const capacity = useGame((s) => s.capacity())
  const full = total >= capacity
  const hover = useUi((s) => s.hover)
  // Prix de ce que ferait le dépôt en cours (poser un producteur, ou améliorer un villageois) : affiché près du doigt, rouge si trop cher
  const dropCost = drag && !drag.from && hover ? (hover.action === 'use' ? useCost(rules, world, hover.x, hover.z, drag.itemId) : hover.action === 'place' ? placementCost(rules, world, drag.itemId) : 0) : 0
  const sellable = !!drag && !drag.from && !!rules.items[drag.itemId].sellValue

  // Fusion possible entre la carte glissée et la carte survolée (il faut avoir tous les ingrédients de la recette, ex : 3 bâtons pour un mur)
  const mergeResult = (id: ItemId) => {
    if (!drag || drag.mergeTarget !== id) return undefined
    const recipe = findCraft(rules, inventory, drag.itemId, id)
    return recipe ? rules.items[recipe.result] : undefined
  }

  return (
    <>
      <section data-dock className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-gutter pb-safe">
        {/* Barre flottante au-dessus du deck (hors du panneau) : jauge de stock à gauche, zone « Vendre » à droite.
            Hauteur fixe : la zone Vendre grossit vers le haut sans décaler l'île ni le reste. */}
        <div data-dock-float className="relative mb-1.5 h-12">
          {/* Jauge de stock : se remplit, passe à l'or puis au rouge clignotant quand le deck est plein */}
          <div className="ginset absolute bottom-0 left-0 h-9 w-40 overflow-hidden rounded-full">
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
                full
                  ? 'animate-pulse bg-gradient-to-b from-[#ff8a78] to-[#e0302a]'
                  : total / capacity >= 0.8
                    ? 'bg-gradient-to-b from-[#ffe680] to-[#f2a600]'
                    : 'bg-gradient-to-b from-[#a8f25a] to-[#3fbf1f]'
              } shadow-[inset_0_2px_0_rgba(255,255,255,0.55),inset_0_-2px_0_rgba(0,0,0,0.2)]`}
              style={{ width: `${Math.min(100, (total / capacity) * 100)}%` }}
            />
            <div className="stroke-sm relative flex h-full items-center justify-center gap-1.5 font-display text-[15px] tabular-nums [--edge:#0d0924]">
              <span>🎴</span>
              {full ? <span>PLEIN</span> : <span>{total}</span>}
              <span className="opacity-80">/ {capacity}</span>
            </div>
          </div>

          {/* Zone « Vendre » : y lâcher une carte la vend. Elle grossit dès qu'on saisit une carte vendable, et encore au survol. */}
          <div
            data-sell
            aria-label="Vendre"
            className={[
              'gbtn pointer-events-auto absolute bottom-0 right-0 transition-all duration-200 ease-bouncy',
              drag?.overSell && sellable
                ? 'gbtn-gold h-[72px] w-44 text-[19px] !shadow-[inset_0_2px_0_rgba(255,255,255,0.6),0_7px_0_#6b4000,0_0_0_5px_#fff,0_0_22px_8px_rgba(255,226,128,0.8)]'
                : sellable
                  ? 'gbtn-gold gbtn-shine h-14 w-40 animate-float text-[16px]'
                  : 'h-10 w-28 !rounded-2xl text-[13px] opacity-90',
            ].join(' ')}
          >
            <span className={sellable ? 'text-3xl' : 'text-xl'}>🐚</span>
            <span>{sellable ? `Vendre +${rules.items[drag!.itemId].sellValue}` : 'Vendre'}</span>
          </div>
        </div>

        <div
          data-dock-panel
          className={[
            'gpanel pointer-events-auto relative mb-2.5 p-2 transition-all',
            drag?.from && drag.overDock ? 'brightness-125 !border-[#8dffb0]' : '', // relâcher ici reprend le producteur dans le dock
          ].join(' ')}
        >
          {/* Carrousel : défile horizontalement quand il y a trop de cartes (le haut est laissé libre pour les pastilles et bulles) */}
          {/* overflow-anchor:none : une carte qui s'insère à gauche ne doit pas décaler le défilement et se cacher hors écran */}
          <div data-scroller className="no-scrollbar relative z-10 -mx-1 -mt-1 flex gap-2 overflow-x-auto px-1 pb-4 pt-9 [overflow-anchor:none]">
            {cards.length === 0 && (
              <span className="stroke-sm self-center px-2 font-display text-[14px] [--edge:#1a1238]">Aucune carte. Tes producteurs en créent peu à peu.</span>
            )}
            {cards.map(({ def, n }) => (
              <div
                key={def.id}
                className="animate-pop"
                onPointerEnter={(e) => {
                  // souris seulement (pas de survol au doigt) ; pendant un glissé, c'est useDrag qui s'en charge
                  if (e.pointerType === 'mouse' && !useUi.getState().drag) emit({ type: 'dockHover', targetId: def.id })
                }}
              >
                <Card
                  def={def}
                  count={n}
                  rules={rules}
                  dragging={!drag?.from && drag?.itemId === def.id}
                  mergeResult={mergeResult(def.id)}
                  cost={def.kind === 'producer' ? placementCost(rules, world, def.id) : 0}
                  broke={def.kind === 'producer' && placementCost(rules, world, def.id) > shells}
                  onPointerDown={(e) => startDrag(e, def.id)}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {drag && (
        <div
          className="pointer-events-none fixed left-0 top-0 z-50 text-6xl drop-shadow-[0_10px_8px_rgba(0,0,0,0.55)]"
          style={{ transform: `translate(${drag.x}px, ${drag.y - 28}px) translate(-50%, -50%)` }}
        >
          <div className="animate-wiggle"><ItemIcon def={rules.items[drag.itemId]} size={72} /></div>
          {dropCost > 0 && (
            <div className={`stroke-sm mx-auto -mt-1 w-fit whitespace-nowrap rounded-full border-[3px] px-2.5 py-0.5 font-display text-[15px] ${dropCost > shells ? 'border-[#6e0e12] bg-gradient-to-b from-[#ff8a78] to-[#e0302a] [--edge:#6e0e12]' : 'border-[#6b4000] bg-gradient-to-b from-[#ffe680] to-[#f2a600] [--edge:#6b4000]'}`}>
              🐚 {formatNumber(dropCost)}
            </div>
          )}
        </div>
      )}
    </>
  )
}

const EDGE = 90 // px : zone au bord du carrousel qui le fait défiler pendant un glissé
const MAX_SCROLL_SPEED = 14 // px par image au tout bord

// Défilement automatique : en tenant une carte près du bord gauche / droit du dock, le carrousel défile pour atteindre les cartes lointaines
function edgeScrollSpeed(cx: number, cy: number): number {
  const scroller = document.querySelector<HTMLElement>('[data-scroller]')
  if (!scroller) return 0
  const r = scroller.getBoundingClientRect()
  if (cy < r.top - 160 || cy > r.bottom + 40) return 0 // seulement quand on est au niveau du dock
  const fromLeft = cx - r.left
  const fromRight = r.right - cx
  if (fromLeft < EDGE) return -MAX_SCROLL_SPEED * Math.min(1, (EDGE - fromLeft) / EDGE)
  if (fromRight < EDGE) return MAX_SCROLL_SPEED * Math.min(1, (EDGE - fromRight) / EDGE)
  return 0
}

const DRAG_THRESHOLD = 8 // px de mouvement avant de décider quel geste c'est

// Glisser-déposer : une carte peut être lâchée sur une autre carte (fusion) ou sur une case du plateau 3D (pose / utilisation).
// Au doigt : un balayage plutôt horizontal fait défiler le carrousel (le navigateur le gère), un glissé plutôt vertical prend la carte.
function useDrag() {
  return useCallback((e: React.PointerEvent, itemId: ItemId) => {
    if (e.button !== 0) return
    const isTouch = e.pointerType !== 'mouse'
    if (!isTouch) e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    let started = false
    let last = { x: startX, y: startY }
    let raf = 0

    const targetAt = (cx: number, cy: number) => {
      const hit = document.elementFromPoint(cx, cy)
      if (hit?.closest('[data-sell]')) return { mergeTarget: null, cell: null, sell: true }
      const card = hit?.closest<HTMLElement>('[data-item]')
      if (card) return { mergeTarget: card.dataset.item as ItemId, cell: null, sell: false }
      if (hit?.closest('[data-dock]')) return { mergeTarget: null, cell: null, sell: false }
      return { mergeTarget: null, cell: pickCell(cx, cy), sell: false }
    }

    // Pendant le glissé : défile près des bords, et recalcule la cible (une autre carte passe sous le doigt immobile)
    const loop = () => {
      const speed = edgeScrollSpeed(last.x, last.y)
      if (speed) {
        document.querySelector<HTMLElement>('[data-scroller]')?.scrollBy({ left: speed })
        update(last.x, last.y)
      }
      raf = requestAnimationFrame(loop)
    }
    // Évite que le navigateur ne vole le geste pour faire défiler une fois la carte prise
    const blockScroll = (ev: TouchEvent) => started && ev.preventDefault()

    const cleanup = () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('touchmove', blockScroll)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', cancel)
    }

    const update = (cx: number, cy: number) => {
      const { rules, world } = useGame.getState()
      const { mergeTarget, cell, sell } = targetAt(cx, cy)
      if (mergeTarget && mergeTarget !== useUi.getState().drag?.mergeTarget) emit({ type: 'dockHover', itemId, targetId: mergeTarget })
      useUi.setState({
        drag: { itemId, x: cx, y: cy, mergeTarget, overSell: sell },
        hover: cell ? { ...cell, action: previewDrop(rules, world, cell.x, cell.z, itemId) } : null,
      })
    }

    const move = (ev: PointerEvent) => {
      if (!started) {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
        if (isTouch && Math.abs(dx) > Math.abs(dy)) return cleanup() // balayage horizontal : c'est du défilement
        started = true
        haptic(10)
        emit({ type: 'itemGrabbed', itemId })
        raf = requestAnimationFrame(loop)
      }
      last = { x: ev.clientX, y: ev.clientY }
      update(ev.clientX, ev.clientY)
    }

    const end = (ev: PointerEvent) => {
      cleanup()
      if (started) {
        emit({ type: 'itemReleased', itemId })
        const { mergeTarget, cell, sell } = targetAt(ev.clientX, ev.clientY)
        const game = useGame.getState()
        let done = false
        if (sell) {
          const value = game.rules.items[itemId].sellValue
          const have = game.inventory[itemId] ?? 0
          if (!value) haptic(6)
          else if (have >= 2) {
            // plusieurs exemplaires : on demande combien
            useUi.setState({ drag: null, hover: null, sellPrompt: itemId })
            return haptic(15)
          } else if (game.sell(itemId, 1)) {
            const r = document.querySelector('[data-sell]')?.getBoundingClientRect()
            if (r) launchShellsFrom({ x: r.left + r.width / 2, y: r.top }, value)
            done = true
          }
        } else if (mergeTarget) {
          const possible = maxMerges(game.rules, game.inventory, itemId, mergeTarget)
          if (possible >= 2) {
            // de quoi en faire plusieurs : on demande combien
            useUi.setState({ drag: null, hover: null, mergePrompt: { a: itemId, b: mergeTarget } })
            return haptic(15)
          }
          const before = game.inventory
          game.merge(itemId, mergeTarget)
          done = useGame.getState().inventory !== before
        } else if (cell) done = game.drop(cell.x, cell.z, itemId)
        // Lâché sur une vraie cible (case, carte, zone Vendre) qui l'a refusé : on le note (signal de confusion). Lâché dans le vide : un simple abandon.
        // Un producteur lâché sur une case libre mais trop cher n'est pas une confusion : le prix est affiché sur la carte
        const action = cell ? previewDrop(game.rules, game.world, cell.x, cell.z, itemId) : undefined
        const broke = action === 'use' || (action === 'place' && game.rules.items[itemId].kind === 'producer')
        if (!done && !broke && (sell || mergeTarget || cell)) emit({ type: 'actionRejected', kind: sell ? 'sell' : mergeTarget ? 'dock-merge' : 'dock-drop' })
        haptic(done ? 25 : 6)
      }
      useUi.setState({ drag: null, hover: null })
    }

    // pointercancel : le navigateur a pris la main (défilement) ou le geste a été interrompu
    const cancel = () => {
      cleanup()
      useUi.setState({ drag: null, hover: null })
    }

    window.addEventListener('touchmove', blockScroll, { passive: false })
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', cancel)
  }, [])
}

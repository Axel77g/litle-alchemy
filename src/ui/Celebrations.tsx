import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { itemDesc, itemName } from '../i18n'
import { onGameEvent } from '../engine/events'
import { confetti } from '../fx/confetti'
import { CloseButton, GameButton, GameWindow, Ribbon } from './Game'
import { haptic } from './haptics'
import ItemIcon from './ItemIcon'
import { useGame } from '../store/game'
import { blocksPopups, holdsDiscovery, useBlocksPopups, useHoldsDiscovery } from '../tutorial/store'
import { useUi } from './uiStore'

// Bandeau « Nouvelle découverte ! » avec des confettis, et l'écran de fin de monde
export default function Celebrations() {
  const { t } = useTranslation()
  const rules = useGame((s) => s.rules)
  const victory = useGame((s) => s.victory)
  const dismissed = useUi((s) => s.victoryDismissed)
  // Étape du tutoriel qui explique la découverte : la bannière reste jusqu'au bouton OK
  const held = useHoldsDiscovery()
  // Pendant le guide, les découvertes s'empilent dans `queue` et s'affichent une par une quand il se retire
  const blocked = useBlocksPopups()
  const [queue, setQueue] = useState<string[]>([])
  const [toast, setToast] = useState<{ id: number; itemId: string } | null>(null)
  const [full, setFull] = useState<string | null>(null)

  useEffect(() => {
    if (!held) setToast(null)
  }, [held])

  // Le guide revient : la bannière en cours disparaît (les suivantes restent en attente)
  useEffect(() => {
    if (blocked) setToast(null)
  }, [blocked])

  // Prochaine découverte en attente, dès que plus rien n'est affiché ni ne gêne
  useEffect(() => {
    if (blocked || toast || !queue.length) return
    const [itemId, ...rest] = queue
    setQueue(rest)
    setToast({ id: Date.now(), itemId })
    confetti(window.innerWidth / 2, window.innerHeight / 2, 36)
    haptic(20)
  }, [blocked, toast, queue])

  // Disparition de la bannière : le temps de lire la description ; retenue par le guide, elle reste jusqu'à son bouton OK
  useEffect(() => {
    if (!toast) return
    const desc = rules.items[toast.itemId]?.desc
    const timer = setTimeout(() => !holdsDiscovery() && setToast(null), 2600 + Math.min(4000, (desc?.length ?? 0) * 35))
    return () => clearTimeout(timer)
  }, [toast, rules])

  useEffect(() => {
    let fullTimer: ReturnType<typeof setTimeout>
    let lastFull = -Infinity
    const off = onGameEvent((e) => {
      if (e.type === 'discovered') {
        useUi.setState((s) => ({ newDiscoveries: s.newDiscoveries + 1 }))
        setQueue((q) => [...q, e.itemId])
      }
      if (e.type === 'dockFull' && !blocksPopups() && performance.now() - lastFull > 12000) {
        // une fois toutes les 12 s au plus : on prévient que cette production est en pause
        lastFull = performance.now()
        setFull(e.itemId)
        clearTimeout(fullTimer)
        fullTimer = setTimeout(() => setFull(null), 4200)
      }
      if (e.type === 'victory') {
        useUi.setState({ victoryDismissed: false })
        for (let i = 0; i < 4; i++) setTimeout(() => confetti(window.innerWidth * (0.2 + i * 0.2), window.innerHeight * 0.55, 60, 1.4), i * 250)
      }
    })
    return () => {
      off()
      clearTimeout(fullTimer)
    }
  }, [])

  const def = toast && rules.items[toast.itemId]
  const fullItem = full ? rules.items[full] : null
  return (
    <>
      {fullItem && (
        <div className="pointer-events-none fixed inset-x-0 top-28 z-40 flex justify-center px-gutter">
          <div className="gpanel animate-pop px-4 py-2.5 text-center">
            <div className="stroke text-[18px] uppercase [--edge:#5e0b14]">{t('celebrations.dockFull')}</div>
            <div className="stroke-sm mt-0.5 text-[13px] font-bold [--edge:#2a170c]">
              {t('celebrations.paused', { icon: fullItem.icon, name: itemName(fullItem) })}
            </div>
          </div>
        </div>
      )}

      {/* Nouvelle découverte : fenêtre centrée à l'écran (horizontalement et verticalement) */}
      {def && (
        <div key={toast.id} className="pointer-events-none fixed inset-0 z-40 grid place-items-center px-gutter">
          {/* Le conteneur englobe le ruban qui dépasse en haut (et en largeur) : c'est lui que le tutoriel met en lumière */}
          <div data-tut="discovery" className="px-4 pt-9">
          <div className="gwindow animate-pop px-6 pb-3.5 pt-8 text-center">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <Ribbon>{t('celebrations.discovery')}</Ribbon>
            </div>
            {/* Pendant l'étape du tutoriel qui l'explique, la bannière reste jusqu'à son bouton OK : pas de croix, elle ferait disparaître l'élément mis en lumière */}
            {!held && <CloseButton onClick={() => setToast(null)} className="pointer-events-auto" />}
            <div className="ginset relative mx-auto grid size-20 place-items-center rounded-full">
              <div className="absolute size-24 animate-pulse bg-[radial-gradient(closest-side,rgba(255,217,138,0.6),transparent)]" />
              <div className="relative animate-float">
                <ItemIcon def={def} size={64} />
              </div>
            </div>
            <div className="stroke mt-2 text-[20px] [--edge:#2a170c]">{itemName(def)}</div>
            {def.desc && <p className="stroke-sm mx-auto mt-1.5 max-w-[16rem] text-[13px] font-bold leading-snug [--edge:#2a170c]">{itemDesc(def)}</p>}
          </div>
          </div>
        </div>
      )}

      {victory && !dismissed && (
        <GameWindow title={t('celebrations.victoryTitle')} onClose={() => useUi.setState({ victoryDismissed: true })} className="text-center">
          <div className="text-7xl">🗿</div>
          <p className="stroke-sm mt-3 text-[14px] font-bold leading-snug [--edge:#2a170c]">
            {t('celebrations.victoryText')}
          </p>
          <GameButton variant="green" shine onClick={() => useUi.setState({ victoryDismissed: true })} className="mt-5 w-full !py-3 !text-[20px]">
            {t('common.continue')}
          </GameButton>
        </GameWindow>
      )}
    </>
  )
}

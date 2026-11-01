import { useEffect, useState } from 'react'
import { onGameEvent } from '../engine/events'
import { confetti } from '../fx/confetti'
import { GameButton, GameWindow, Ribbon } from './Game'
import { haptic } from './haptics'
import ItemIcon from './ItemIcon'
import { useGame } from '../store/game'
import { useUi } from './uiStore'

// Bandeau « Nouvelle découverte ! » avec des confettis, et l'écran de fin de monde
export default function Celebrations() {
  const rules = useGame((s) => s.rules)
  const victory = useGame((s) => s.victory)
  const dismissed = useUi((s) => s.victoryDismissed)
  const [toast, setToast] = useState<{ id: number; itemId: string } | null>(null)
  const [full, setFull] = useState<string | null>(null)

  useEffect(() => {
    let n = 0
    let timer: ReturnType<typeof setTimeout>
    let fullTimer: ReturnType<typeof setTimeout>
    let lastFull = -Infinity
    const off = onGameEvent((e) => {
      if (e.type === 'discovered') {
        useUi.setState((s) => ({ newDiscoveries: s.newDiscoveries + 1 }))
        setToast({ id: ++n, itemId: e.itemId })
        confetti(window.innerWidth / 2, window.innerHeight / 2, 36)
        haptic(20)
        clearTimeout(timer)
        timer = setTimeout(() => setToast(null), 2600)
      }
      if (e.type === 'dockFull' && performance.now() - lastFull > 12000) {
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
      clearTimeout(timer)
      clearTimeout(fullTimer)
    }
  }, [])

  const def = toast && rules.items[toast.itemId]
  const blocked = full ? rules.items[full] : null
  return (
    <>
      {blocked && (
        <div className="pointer-events-none fixed inset-x-0 top-28 z-40 flex justify-center px-gutter">
          <div className="gpanel animate-pop px-4 py-2.5 text-center">
            <div className="stroke text-[18px] uppercase [--edge:#5e0b14]">Dock plein !</div>
            <div className="stroke-sm mt-0.5 text-[13px] font-bold [--edge:#2a170c]">
              {blocked.icon} {blocked.name} est en pause. Vends ou fusionne des cartes.
            </div>
          </div>
        </div>
      )}

      {/* Nouvelle découverte : fenêtre centrée à l'écran (horizontalement et verticalement) */}
      {def && (
        <div key={toast.id} className="pointer-events-none fixed inset-0 z-40 grid place-items-center px-gutter">
          <div className="gwindow animate-pop px-6 pb-3.5 pt-8 text-center">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <Ribbon>Nouvelle découverte !</Ribbon>
            </div>
            <div className="ginset relative mx-auto grid size-20 place-items-center rounded-full">
              <div className="absolute size-14 animate-pulse rounded-full bg-[#ffd98a]/60 blur-xl" />
              <div className="relative animate-float">
                <ItemIcon def={def} size={64} />
              </div>
            </div>
            <div className="stroke mt-2 text-[20px] [--edge:#2a170c]">{def.name}</div>
          </div>
        </div>
      )}

      {victory && !dismissed && (
        <GameWindow title="Monde 1 terminé !" onClose={() => useUi.setState({ victoryDismissed: true })} className="text-center">
          <div className="text-7xl">🗿</div>
          <p className="stroke-sm mt-3 text-[14px] font-bold leading-snug [--edge:#2a170c]">
            Tu as dressé le Cercle de pierres : l'Âge de Pierre s'achève. Le prochain monde arrive bientôt : ton île reste là, continue de la faire grandir !
          </p>
          <GameButton variant="green" shine onClick={() => useUi.setState({ victoryDismissed: true })} className="mt-5 w-full !py-3 !text-[20px]">
            Continuer
          </GameButton>
        </GameWindow>
      )}
    </>
  )
}

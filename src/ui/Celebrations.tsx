import { useEffect, useState } from 'react'
import { onGameEvent } from '../engine/events'
import { confetti } from '../fx/confetti'
import { haptic } from './haptics'
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
        confetti(window.innerWidth / 2, 110, 36)
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
          <div className="animate-pop rounded-2xl bg-error-container px-4 py-2 text-center shadow-chunk-lg ring-2 ring-error">
            <div className="font-display text-label-chunky-lg uppercase text-error">Dock plein !</div>
            <div className="font-body text-body-sm text-on-error-container">
              {blocked.icon} {blocked.name} est en pause. Vends ou fusionne des cartes.
            </div>
          </div>
        </div>
      )}

      {def && (
        <div key={toast.id} className="pointer-events-none fixed inset-x-0 top-28 z-40 flex justify-center px-gutter">
          <div className="animate-pop rounded-2xl bg-tertiary px-5 py-2.5 text-center shadow-[0_6px_0_#614800] ring-4 ring-surface-container-lowest">
            <div className="font-display text-label-chunky-sm uppercase text-on-tertiary">Nouvelle découverte !</div>
            <div className="font-display text-headline-md text-on-tertiary-container">
              {def.icon} {def.name}
            </div>
          </div>
        </div>
      )}

      {victory && !dismissed && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 px-gutter">
          <div className="w-full max-w-sm animate-pop rounded-3xl bg-surface-container-high p-space-xl text-center shadow-chunk-xl ring-4 ring-tertiary">
            <div className="text-7xl">🏺</div>
            <div className="mt-space-sm font-display text-headline-lg text-tertiary">Monde 1 terminé !</div>
            <p className="mt-space-sm font-body text-body-md text-on-surface-variant">
              Tu as ouvert l'Âge du Bronze. Le prochain monde arrive bientôt : ton île reste là, continue de la faire grandir !
            </p>
            <button
              onClick={() => useUi.setState({ victoryDismissed: true })}
              className="mt-space-lg w-full rounded-2xl bg-primary-container py-3 font-display text-label-chunky-lg uppercase text-on-primary shadow-[0_5px_0_#00573f] transition-all active:translate-y-1 active:shadow-none"
            >
              Continuer
            </button>
          </div>
        </div>
      )}
    </>
  )
}

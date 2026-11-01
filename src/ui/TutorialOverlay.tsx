import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { onGameEvent } from '../engine/events'
import { placementCost } from '../engine/pricing'
import { useGame } from '../store/game'
import { formatNumber } from './format'
import { GameButton } from './Game'
import { endTutorial, nextStep, STEPS, useTutorial } from './tutorialStore'
import { useUi } from './uiStore'

const PAD = 6 // px autour de l'élément mis en lumière
const HAND_MS = 2200 // durée d'un aller de la main
const LIFT_PX = 70 // hauteur dont la main soulève d'abord la carte

const ease = (t: number) => t * t * (3 - 2 * t)
const center = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 })

// Tutoriel : un voile sombre troué autour de l'élément à utiliser, une bulle d'explication et, pour un glissé, une main qui montre le geste.
// Le voile laisse passer les doigts : le joueur peut faire le geste tout de suite, l'étape se valide d'elle-même.
export default function Tutorial() {
  const step = useTutorial((s) => s.step)
  const intro = useTutorial((s) => s.intro)
  const home = useUi((s) => s.homeOpen)
  return step !== null && !home && !intro ? <Overlay key={step} index={step} /> : null
}

function Overlay({ index }: { index: number }) {
  const { t } = useTranslation()
  const def = STEPS[index]
  const hunterCost = useGame((s) => placementCost(s.rules, s.world, 'hunter'))
  const hole = useRef<HTMLDivElement>(null)
  const bubble = useRef<HTMLDivElement>(null)
  const hand = useRef<HTMLDivElement>(null)

  // Validation de l'étape
  useEffect(() => {
    if (def.done) {
      const done = def.done
      return onGameEvent((e) => done(e) && nextStep())
    }
    const check = def.doneWhen
    if (check) return useUi.subscribe((s) => check(s) && nextStep())
  }, [def])

  // Suit l'élément à chaque image (il défile, change de taille ou n'existe pas encore)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const frame = () => {
      const el = document.querySelector(def.target)
      const to = def.to ? document.querySelector(def.to) : null
      const h = hole.current
      const b = bubble.current
      if (h && b) {
        const r = el?.getBoundingClientRect()
        h.style.opacity = r ? '1' : '0'
        if (r) {
          h.style.transform = `translate(${r.left - PAD}px, ${r.top - PAD}px)`
          h.style.width = `${r.width + PAD * 2}px`
          h.style.height = `${r.height + PAD * 2}px`
        }
        // Bulle sous l'élément s'il est en haut de l'écran, au-dessus sinon ; centrée à l'écran tant qu'il est introuvable
        const bw = b.offsetWidth
        const bh = b.offsetHeight
        const x = r ? Math.min(Math.max(8, center(r).x - bw / 2), window.innerWidth - bw - 8) : (window.innerWidth - bw) / 2
        const below = r ? r.top < window.innerHeight / 2 : false
        const y = r ? (below ? r.bottom + PAD + 14 : r.top - PAD - 14 - bh) : window.innerHeight * 0.35
        b.style.transform = `translate(${x}px, ${Math.max(8, y)}px)`
      }
      const hd = hand.current
      if (hd && el && to) {
        const a = center(el.getBoundingClientRect())
        const z = center(to.getBoundingClientRect())
        const p = ((performance.now() - start) % HAND_MS) / HAND_MS
        // Comme useDrag : on monte d'abord la carte (un geste horizontal ferait défiler le carrousel), puis on l'amène sur la cible
        const lift = p < 0.15 ? 0 : p > 0.3 ? 1 : ease((p - 0.15) / 0.15)
        const m = p < 0.3 ? 0 : p > 0.8 ? 1 : ease((p - 0.3) / 0.5)
        const up = LIFT_PX * lift
        hd.style.opacity = p > 0.9 ? String((1 - p) * 10) : '1'
        hd.style.transform = `translate(${a.x + (z.x - a.x) * m}px, ${a.y - up + (z.y - a.y + up) * m}px) translate(-30%, -10%)`
      } else if (hd) hd.style.opacity = '0'
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [def])

  const needsOk = !def.done && !def.doneWhen
  return (
    <div className="pointer-events-none fixed inset-0 z-[55]">
      <div
        ref={hole}
        className="absolute left-0 top-0 rounded-2xl opacity-0 shadow-[0_0_0_9999px_rgba(20,10,4,0.72)] ring-4 ring-[#ffd24a] transition-opacity"
      />
      {def.to && (
        <div ref={hand} className="absolute left-0 top-0 text-5xl opacity-0 drop-shadow-[0_4px_4px_rgba(0,0,0,0.6)]">
          👆
        </div>
      )}
      <div ref={bubble} className="absolute left-0 top-0 w-[17rem] max-w-[calc(100vw-16px)]">
        <div className="gpanel pointer-events-auto animate-pop px-4 py-3 text-center">
          <p className="stroke-sm font-display text-[14px] leading-snug [--edge:#2a170c]">{t(`tutorial.${def.id}`, { cost: formatNumber(hunterCost) })}</p>
          {needsOk && (
            <GameButton variant="green" shine onClick={nextStep} className="mt-2 w-full !py-2 !text-[16px]">
              {t('tutorial.ok')}
            </GameButton>
          )}
        </div>
      </div>
      <button
        onClick={endTutorial}
        className="pointer-events-auto absolute right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] rounded-full bg-[#140a04]/80 px-3 py-1 font-display text-[12px] text-[#fff3d6] ring-1 ring-white/30"
      >
        {t('tutorial.skip')}
      </button>
      <span className="sr-only">
        {index + 1}/{STEPS.length}
      </span>
    </div>
  )
}

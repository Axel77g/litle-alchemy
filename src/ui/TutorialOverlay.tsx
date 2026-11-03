import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { onGameEvent } from '../engine/events'
import { placementCost } from '../engine/pricing'
import { useGame } from '../store/game'
import { timed } from '../debug/livePerf'
import { formatNumber } from './format'
import { GameButton } from './Game'
import { endTutorial, nextStep, STEPS, useTutorial } from './tutorialStore'
import { useUi } from './uiStore'

const PAD = 6 // px autour de l'élément mis en lumière
const HAND_MS = 2200 // durée d'un aller de la main
const LIFT_PX = 70 // hauteur dont la main soulève d'abord la carte

const HAND_SAMPLES = 40 // images clés par aller de la main

const ease = (t: number) => t * t * (3 - 2 * t)
const center = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 })

// Trajectoire de la main : comme useDrag, on monte d'abord la carte (un geste horizontal ferait défiler le carrousel), puis on l'amène sur la cible.
// Elle s'efface en fin de course avant de recommencer.
function handFrames(a: { x: number; y: number }, z: { x: number; y: number }): Keyframe[] {
  const frames: Keyframe[] = []
  for (let i = 0; i <= HAND_SAMPLES; i++) {
    const p = i / HAND_SAMPLES
    const lift = p < 0.15 ? 0 : p > 0.3 ? 1 : ease((p - 0.15) / 0.15)
    const m = p < 0.3 ? 0 : p > 0.8 ? 1 : ease((p - 0.3) / 0.5)
    const up = LIFT_PX * lift
    frames.push({
      offset: p,
      opacity: p > 0.9 ? (1 - p) * 10 : 1,
      transform: `translate(${a.x + (z.x - a.x) * m}px, ${a.y - up + (z.y - a.y + up) * m}px) translate(-30%, -10%)`,
    })
  }
  return frames
}

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

  // Suit l'élément visé (il défile, change de taille ou n'existe pas encore). Pensé pour le mobile :
  //  - la main est une animation Web Animations (transform + opacity) : le compositeur la fait avancer sans repasser par le thread principal à chaque image ;
  //  - la boucle ne fait que LIRE la géométrie (éléments gardés d'une image à l'autre), puis n'écrit que ce qui a changé ;
  //    lire après avoir écrit forcerait un recalcul de la mise en page à chaque image.
  useEffect(() => {
    let raf = 0
    let el: Element | null = null
    let to: Element | null = null
    let lastQuery = -Infinity
    let holeKey = ''
    let bubbleKey = ''
    let handKey = ''
    let handAnim: Animation | null = null
    let bw = 0 // taille de la bulle, mise à jour par le ResizeObserver (jamais lue image par image)
    let bh = 0
    const b = bubble.current
    const observer = new ResizeObserver(([entry]) => {
      bw = entry.target.clientWidth
      bh = entry.target.clientHeight
      bubbleKey = '' // la bulle a changé de taille : on la repositionne
    })
    if (b) {
      bw = b.offsetWidth
      bh = b.offsetHeight
      observer.observe(b)
    }

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      timed('Tutorial.frame', () => {
        // Les éléments sont gardés ; s'ils ont disparu (ou n'existent pas encore) on les cherche 10 fois par seconde
        if (!el?.isConnected || (def.to && !to?.isConnected)) {
          if (now - lastQuery < 100) return
          lastQuery = now
          el = document.querySelector(def.target)
          to = def.to ? document.querySelector(def.to) : null
        }
        // 1. lectures
        const r = el?.getBoundingClientRect()
        const zr = to?.getBoundingClientRect()
        // 2. écritures, seulement si la cible a bougé
        const h = hole.current
        if (h && b) {
          const key = r ? `${r.left}|${r.top}|${r.width}|${r.height}` : ''
          if (key !== holeKey) {
            holeKey = key
            h.style.opacity = r ? '1' : '0'
            if (r) {
              h.style.transform = `translate(${r.left - PAD}px, ${r.top - PAD}px)`
              h.style.width = `${r.width + PAD * 2}px`
              h.style.height = `${r.height + PAD * 2}px`
            }
          }
          // Bulle sous l'élément s'il est en haut de l'écran, au-dessus sinon ; centrée à l'écran tant qu'il est introuvable
          const bKey = `${key}|${bw}|${bh}|${window.innerWidth}|${window.innerHeight}`
          if (bKey !== bubbleKey) {
            bubbleKey = bKey
            const x = r ? Math.min(Math.max(8, center(r).x - bw / 2), window.innerWidth - bw - 8) : (window.innerWidth - bw) / 2
            const below = r ? r.top < window.innerHeight / 2 : false
            const y = r ? (below ? r.bottom + PAD + 14 : r.top - PAD - 14 - bh) : window.innerHeight * 0.35
            b.style.transform = `translate(${x}px, ${Math.max(8, y)}px)`
          }
        }
        const hd = hand.current
        if (hd) {
          const a = r && center(r)
          const z = zr && center(zr)
          const key = a && z ? `${Math.round(a.x)}|${Math.round(a.y)}|${Math.round(z.x)}|${Math.round(z.y)}` : ''
          if (key !== handKey) {
            handKey = key
            const phase = (handAnim?.currentTime as number | null) ?? 0 // on garde la cadence quand le dock défile
            handAnim?.cancel()
            handAnim = a && z ? hd.animate(handFrames(a, z), { duration: HAND_MS, iterations: Infinity }) : null // sans cible : retour à opacity-0
            if (handAnim) handAnim.currentTime = phase
          }
        }
      })
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      handAnim?.cancel()
    }
  }, [def])

  const needsOk = !def.done && !def.doneWhen
  return (
    <div className="pointer-events-none fixed inset-0 z-[55]">
      <div
        ref={hole}
        className="absolute left-0 top-0 rounded-2xl opacity-0 shadow-[0_0_0_9999px_rgba(20,10,4,0.72)] ring-4 ring-[#ffd24a] transition-opacity"
      />
      {def.to && (
        // Pas de filter: drop-shadow ici : la main bouge à chaque image, et le navigateur re-rasterisait son filtre (et recomposait le voile) à chaque fois.
        // L'ombre est une simple tache en dégradé radial, qui voyage avec elle sans rien recalculer.
        <div ref={hand} className="absolute left-0 top-0 text-5xl leading-none opacity-0">
          <span className="absolute left-1 top-4 size-10 rounded-full bg-[radial-gradient(closest-side,rgba(0,0,0,0.55),transparent)]" />
          <span className="relative">👆</span>
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

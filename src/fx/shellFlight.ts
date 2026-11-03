// Coquillages volants : un 🐚 part du producteur et rejoint le compteur du HUD en suivant une courbe de Bézier cubique.
// Éléments DOM animés par l'API Web Animations (calculée hors du thread React, aucun re-rendu).
import { formatNumber } from '../ui/format'
import { isOn } from '../debug/switches'
import { projectCell } from './screen'

const INTERVAL_MS = 1000 // au plus un coquillage volant par seconde : il porte le total produit entre-temps
let alive = 0
let lastLaunch = 0
let timer: ReturnType<typeof setTimeout> | undefined
const pending = new Map<string, { x: number; z: number; amount: number }>()

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const bezier = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const u = 1 - t
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
}
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

function bumpTarget(target: HTMLElement) {
  target.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.28) rotate(-6deg)' }, { transform: 'scale(1)' }],
    { duration: 220, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
  )
}

function fly(from: { x: number; y: number }, to: { x: number; y: number }, amount: number, target: HTMLElement) {
  const el = document.createElement('div')
  el.style.cssText =
    'position:fixed;left:0;top:0;z-index:60;pointer-events:none;display:flex;align-items:center;gap:4px;line-height:1;will-change:transform;opacity:0'
  const label = document.createElement('span')
  label.textContent = `+${formatNumber(amount)}`
  label.style.cssText = "font:900 20px/1 Epilogue,system-ui,sans-serif;color:#ffd36f;-webkit-text-stroke:4px #0f0c1d;paint-order:stroke fill"
  const shell = document.createElement('span')
  shell.textContent = '🐚'
  shell.style.cssText = 'font-size:28px;display:inline-block;text-shadow:0 3px 3px rgba(0,0,0,.45)'
  el.append(label, shell)
  document.body.appendChild(el)
  alive++

  // Courbe : le coquillage jaillit vers le haut et sur le côté, puis plonge dans le compteur
  const side = (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 60)
  const c1 = { x: from.x + side, y: from.y - (90 + Math.random() * 70) }
  const c2 = { x: lerp(from.x, to.x, 0.55) - side * 0.3, y: to.y + 60 + Math.random() * 60 }

  const N = 32
  const frames: Keyframe[] = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const e = easeInOut(t)
    const x = bezier(from.x, c1.x, c2.x, to.x, e)
    const y = bezier(from.y, c1.y, c2.y, to.y, e)
    const scale = t < 0.2 ? lerp(0.3, 1.2, t / 0.2) : lerp(1.2, 0.65, (t - 0.2) / 0.8) // pop au départ, rétrécit en arrivant
    frames.push({
      offset: t,
      opacity: t === 0 ? 0 : t > 0.9 ? lerp(1, 0.4, (t - 0.9) / 0.1) : 1, // le nombre s'efface juste avant le compteur
      transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${scale})`,
    })
  }
  const duration = 900
  shell.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration, easing: 'linear' })
  const anim = el.animate(frames, { duration, easing: 'linear', fill: 'both' })
  anim.onfinish = () => {
    el.remove()
    alive--
    bumpTarget(target)
  }
  anim.oncancel = () => {
    el.remove()
    alive--
  }
}

function flush() {
  timer = undefined
  const target = document.querySelector<HTMLElement>('[data-shell-target]')
  const entries = [...pending.values()]
  pending.clear()
  if (!entries.length || document.hidden || !target || !isOn('fx.shells')) return
  // Un seul coquillage pour tout ce qui a été produit : il part du plus gros producteur et porte le total
  const main = entries.reduce((best, e) => (e.amount > best.amount ? e : best))
  const total = entries.reduce((sum, e) => sum + e.amount, 0)
  const start = projectCell(main.x, main.z, 0.7)
  if (!start || alive > 10) return
  const r = target.getBoundingClientRect()
  lastLaunch = performance.now()
  fly(start, { x: r.left + r.width / 2, y: r.top + r.height / 2 }, total, target)
}

// Appelé à chaque production de coquillages : on cumule, et au plus une fois par seconde un coquillage part avec le total
export function launchShells(x: number, z: number, amount: number) {
  if (document.hidden) return
  const key = `${x},${z}`
  const entry = pending.get(key)
  if (entry) entry.amount += amount
  else pending.set(key, { x, z, amount })
  if (!timer) timer = setTimeout(flush, Math.max(0, lastLaunch + INTERVAL_MS - performance.now()))
}

// Coquillage qui part d'un point d'écran (ex : la zone Vendre) vers le compteur, sans la limite d'un par seconde
export function launchShellsFrom(from: { x: number; y: number }, amount: number) {
  const target = document.querySelector<HTMLElement>('[data-shell-target]')
  if (!target || document.hidden || !isOn('fx.shells')) return
  const r = target.getBoundingClientRect()
  fly(from, { x: r.left + r.width / 2, y: r.top + r.height / 2 }, amount, target)
}

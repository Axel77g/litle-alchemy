// Confettis : des petits morceaux de papier lancés d'un point de l'écran, qui retombent avec la gravité.
// Éléments DOM animés par l'API Web Animations (aucun re-rendu).
import { isOn } from '../debug/switches'

const COLORS = ['#47f3bb', '#ffd36f', '#fe6b00', '#ffb693', '#e04a8c', '#8ab4ff']

export function confetti(x: number, y: number, count = 40, power = 1) {
  if (document.hidden || !isOn('fx.confetti')) return
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div')
    const w = 6 + Math.random() * 6
    el.style.cssText = `position:fixed;left:0;top:0;z-index:70;pointer-events:none;width:${w}px;height:${w * 0.5}px;background:${COLORS[i % COLORS.length]};border-radius:1px;will-change:transform,opacity`
    document.body.appendChild(el)

    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.4 // surtout vers le haut, en éventail
    const speed = (180 + Math.random() * 260) * power // px/s
    const vx = Math.cos(angle) * speed
    const vy = Math.sin(angle) * speed
    const duration = 1100 + Math.random() * 700
    const spin = (Math.random() - 0.5) * 1400
    const frames: Keyframe[] = []
    const N = 18
    for (let k = 0; k <= N; k++) {
      const t = (k / N) * (duration / 1000)
      frames.push({
        offset: k / N,
        opacity: k / N > 0.8 ? 1 - (k / N - 0.8) / 0.2 : 1,
        transform: `translate(${x + vx * t}px, ${y + vy * t + 520 * t * t}px) rotate(${spin * t}deg)`,
      })
    }
    el.animate(frames, { duration, easing: 'linear', fill: 'forwards' }).onfinish = () => el.remove()
  }
}

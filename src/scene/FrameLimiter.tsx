import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { getSwitch, isOn, perfAttach, perfFrame } from '../instrument'

// Le jeu est presque statique : inutile de rendre à 60/120 fps en permanence (chauffe + batterie).
// Le Canvas est en frameloop="never" et c'est ce composant qui le fait avancer :
// IDLE_FPS au repos, ACTIVE_FPS pendant (et juste après) une interaction (doigt, souris, molette).
const IDLE_FPS = 30
const ACTIVE_FPS = 60
const ACTIVE_LINGER_MS = 1200

// Images réellement rendues (lu par le compteur de fps)
export const renderStats = { frames: 0, calls: 0, triangles: 0 }

export default function FrameLimiter() {
  const advance = useThree((s) => s.advance)
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    let raf = 0
    let last = 0
    let lastInput = 0
    let count = 0
    const touch = () => (lastInput = performance.now())
    perfAttach(gl, scene)

    // La shadow map est le plus gros poste (toute l'île re-rendue depuis le soleil) : une image sur deux suffit
    gl.shadowMap.autoUpdate = false

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      if (!isOn('3d.render')) return // diagnostic : image figée (le contexte WebGL reste en mémoire)
      const cap = getSwitch('3d.fpsCap')
      const targetFps = t - lastInput < ACTIVE_LINGER_MS ? (cap === 'auto' ? ACTIVE_FPS : Number(cap)) : IDLE_FPS
      const interval = 1000 / targetFps
      if (t - last < interval - 1) return
      last = t
      gl.shadowMap.needsUpdate = count++ % 2 === 0
      renderStats.frames++
      // Draw calls de l'image : le composer fait plusieurs rendus, donc on compte la différence avant / après plutôt que le compteur auto
      gl.info.autoReset = false
      const before = gl.info.render.calls
      const trianglesBefore = gl.info.render.triangles
      const start = performance.now()
      advance(t / 1000)
      const cpuMs = performance.now() - start
      const calls = gl.info.render.calls - before
      const triangles = gl.info.render.triangles - trianglesBefore
      if (calls >= 0) renderStats.calls = calls
      if (triangles >= 0) renderStats.triangles = triangles
      perfFrame(t, cpuMs, renderStats.calls, renderStats.triangles, targetFps)
    }

    const events = ['pointerdown', 'pointermove', 'wheel', 'touchstart', 'touchmove'] as const
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }))
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      events.forEach((e) => window.removeEventListener(e, touch))
      gl.shadowMap.autoUpdate = true
      gl.info.autoReset = true
    }
  }, [advance, gl, scene])

  return null
}

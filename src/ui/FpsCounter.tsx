import { useEffect, useRef } from 'react'
import { renderStats } from '../scene/FrameLimiter'

// Compteur de perf (debug) : fps = images 3D réellement rendues (cadence plafonnée, voir scene/FrameLimiter.tsx),
// draws = draw calls de la dernière image. Le texte est écrit directement dans le DOM, deux fois par seconde : aucun re-rendu React.
export default function FpsCounter() {
  const fpsRef = useRef<HTMLDivElement>(null)
  const drawsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let frames = renderStats.frames
    let last = performance.now()
    const id = setInterval(() => {
      const now = performance.now()
      const fps = Math.round(((renderStats.frames - frames) * 1000) / (now - last))
      frames = renderStats.frames
      last = now
      if (fpsRef.current) {
        fpsRef.current.textContent = `${fps} fps`
        fpsRef.current.style.color = fps >= 55 ? '#47f3bb' : fps >= 25 ? '#ffc864' : '#ff6b6b'
      }
      if (drawsRef.current) drawsRef.current.textContent = `${renderStats.calls} draws`
    }, 500)
    return () => clearInterval(id)
  }, [])

  const chip = 'rounded-full bg-surface-container-lowest/80 px-2 py-0.5 font-display text-[10px] font-extrabold tabular-nums leading-none'
  return (
    <div className="pointer-events-none flex flex-col items-center gap-1">
      <div ref={fpsRef} className={chip}>
        -- fps
      </div>
      <div ref={drawsRef} className={`${chip} text-on-surface-variant`}>
        -- draws
      </div>
    </div>
  )
}

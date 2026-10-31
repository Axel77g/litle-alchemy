import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'

// Recentre l'île dans l'espace réellement libre, entre le HUD du haut et le dock du bas.
// On décale l'image (setViewOffset) plutôt que la position de la caméra : le décalage est exact en pixels,
// quel que soit le zoom, et suit automatiquement la taille du HUD et du dock.
// Hauteur à l'écran de l'île de départ pour le zoom d'origine de la caméra (60), et part de l'espace libre qu'elle doit occuper au plus
const ISLAND_HEIGHT_AT_ZOOM = 330
const ISLAND_FILL = 0.9

export default function ViewOffset() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const fitted = useRef(false)

  useEffect(() => {
    const apply = () => {
      const row = document.querySelector('[data-hud-row]')
      const dock = document.querySelector('[data-dock-float]') ?? document.querySelector('[data-dock-panel]') // la barre flottante (jauge + Vendre) fait partie du bas de l'écran
      const top = row ? row.getBoundingClientRect().bottom : 0
      const bottom = dock ? dock.getBoundingClientRect().top : size.height
      const shift = size.height / 2 - (top + bottom) / 2 // > 0 : l'île monte
      // Au premier affichage : si l'île ne tient pas dans l'espace libre (petit écran), on réduit le zoom pour qu'elle respire.
      // Une seule fois : ensuite le zoom appartient au joueur (pincement / molette).
      if (!fitted.current && camera.type === 'OrthographicCamera' && bottom > top) {
        fitted.current = true
        camera.zoom = Math.min(camera.zoom, (camera.zoom * (bottom - top) * ISLAND_FILL) / ISLAND_HEIGHT_AT_ZOOM)
      }
      camera.setViewOffset(size.width, size.height, 0, shift, size.width, size.height)
      camera.updateProjectionMatrix()
    }
    apply()
    const ro = new ResizeObserver(apply)
    for (const el of document.querySelectorAll('[data-hud-row], [data-dock-panel], [data-dock-float]')) ro.observe(el)
    window.addEventListener('resize', apply)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', apply)
      camera.clearViewOffset()
      camera.updateProjectionMatrix()
    }
  }, [camera, size.width, size.height])

  return null
}

// Où se trouve, à l'écran, ce que le guide met en lumière ? Un « pisteur » relit la position de sa cible à la demande (elle défile, change de taille,
// ou n'existe pas encore) : un élément de l'interface (sélecteur CSS), une case de l'île, ou un item posé sur l'île (via la projection de la scène 3D).
import { projectCell } from '../fx/screen'
import { useGame } from '../store/game'
import type { Target } from './types'

export interface Box {
  left: number
  top: number
  width: number
  height: number
  right: number
  bottom: number
}
export interface Tracker {
  read(now: number): Box | null // null : introuvable (pas encore posé, pas encore affiché...)
}

const ENTITY_HEIGHT = 1.1 // hauteur (en unités de la scène) d'un personnage ou d'un objet posé : le cadre l'englobe en entier
const REQUERY_MS = 100 // un élément introuvable est cherché 10 fois par seconde, pas à chaque image

const boxOf = (points: { x: number; y: number }[]): Box => {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const left = Math.min(...xs)
  const top = Math.min(...ys)
  const right = Math.max(...xs)
  const bottom = Math.max(...ys)
  return { left, top, right, bottom, width: right - left, height: bottom - top }
}

// Le cadre à l'écran d'une case (et de ce qui est posé dessus si `height` > 0) : ses 4 coins au sol, plus le haut de l'objet
function cellBox(x: number, z: number, height: number): Box | null {
  const points = [
    projectCell(x - 0.5, z - 0.5, 0),
    projectCell(x + 0.5, z - 0.5, 0),
    projectCell(x + 0.5, z + 0.5, 0),
    projectCell(x - 0.5, z + 0.5, 0),
    ...(height > 0 ? [projectCell(x, z, height)] : []),
  ]
  return points.every((p) => p !== null) ? boxOf(points as { x: number; y: number }[]) : null
}

export function createTracker(target: Target): Tracker {
  if (typeof target === 'string') {
    let el: Element | null = null
    let lastQuery = -Infinity
    let last: Box | null = null
    return {
      read(now) {
        if (!el?.isConnected) {
          if (now - lastQuery < REQUERY_MS) return last
          lastQuery = now
          el = document.querySelector(target)
        }
        return (last = el ? el.getBoundingClientRect() : null)
      },
    }
  }
  if ('cell' in target) {
    const { x, z } = target.cell
    return { read: () => cellBox(x, z, 0) }
  }
  // Le premier exemplaire posé sur l'île (le monde ne change pas d'une image à l'autre : la recherche n'est refaite que s'il change)
  let world: unknown
  let found: { x: number; z: number } | null = null
  return {
    read() {
      const w = useGame.getState().world
      if (w !== world) {
        world = w
        const cell = [...w.values()].find((c) => c.entity?.itemId === target.entity)
        found = cell ? { x: cell.x, z: cell.z } : null
      }
      return found ? cellBox(found.x, found.z, ENTITY_HEIGHT) : null
    },
  }
}

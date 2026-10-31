// Bus d'événements du moteur. Le moteur ne connaît ni three ni React :
// il annonce ce qui s'est passé, et les autres couches (FX, son, UI) réagissent.
import type { PlacedEntity, TerrainType, World } from './types'

export type GameEvent =
  | { type: 'entityPlaced'; x: number; z: number; entity: PlacedEntity }
  | { type: 'entityRemoved'; x: number; z: number; entity: PlacedEntity }
  | { type: 'entityMoved'; from: { x: number; z: number }; to: { x: number; z: number }; entity: PlacedEntity }
  | { type: 'cellUnlocked'; x: number; z: number }
  | { type: 'terrainChanged'; x: number; z: number; terrain: TerrainType } // ex : une case d'herbe inondée
  | { type: 'discovered'; itemId: string } // premier exemplaire d'un item jamais obtenu
  | { type: 'dockFull'; itemId: string } // dock plein : la production de cet item est en pause
  | { type: 'victory' } // fin du monde
  // Gestes du joueur (émis par l'UI) : saisie / relâchement d'un item, d'une carte du dock comme d'un producteur de l'île
  | { type: 'itemGrabbed'; itemId: string }
  | { type: 'itemReleased'; itemId: string }
  // Une fusion vient d'avoir lieu (dock, item sur un producteur, ou deux producteurs de l'île) ; result = l'item obtenu
  | { type: 'merged'; result: string }
  | { type: 'sold'; itemId: string } // des cartes vendues contre des coquillages
  | { type: 'actionRejected'; kind: 'sell' | 'dock-merge' | 'dock-drop' | 'board' } // le joueur a lâché une carte sur une cible qui l'a refusée (signal de confusion)
  | { type: 'cellBought'; x: number; z: number } // une case payée en coquillages (cellUnlocked suit : c'est elle qui tombe)
  // Une production vient d'avoir lieu (agrégée par tick). Sert aux FX : pop, chiffre flottant, objet qui saute...
  | { type: 'produced'; x: number; z: number; entityId: string; output: string; amount: number }

type Listener = (event: GameEvent) => void
const listeners = new Set<Listener>()

export const onGameEvent = (fn: Listener) => {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

export const emit = (event: GameEvent) => listeners.forEach((fn) => fn(event))

// Déduit les événements en comparant deux états du monde : toute modification du moteur
// (pose, retrait, agrandissement...) produit ses événements sans code supplémentaire.
export function diffWorlds(before: World, after: World): GameEvent[] {
  const events: GameEvent[] = []

  // Une entité (même id) qui a changé de case n'a pas été retirée puis posée : elle a été déplacée
  const where = (world: World) => {
    const m = new Map<string, { x: number; z: number; entity: PlacedEntity }>()
    for (const c of world.values()) if (c.entity) m.set(c.entity.id, { x: c.x, z: c.z, entity: c.entity })
    return m
  }
  const was = where(before)
  const now = where(after)
  const moved = new Set<string>()
  for (const [id, n] of now) {
    const o = was.get(id)
    if (o && (o.x !== n.x || o.z !== n.z)) {
      moved.add(id)
      events.push({ type: 'entityMoved', from: { x: o.x, z: o.z }, to: { x: n.x, z: n.z }, entity: n.entity })
    }
  }

  for (const [key, cell] of after) {
    const old = before.get(key)
    if (!old || (!old.unlocked && cell.unlocked)) events.push({ type: 'cellUnlocked', x: cell.x, z: cell.z })
    else if (old.terrain !== cell.terrain) events.push({ type: 'terrainChanged', x: cell.x, z: cell.z, terrain: cell.terrain })
    if (old?.entity?.id !== cell.entity?.id) {
      if (old?.entity && !moved.has(old.entity.id)) events.push({ type: 'entityRemoved', x: cell.x, z: cell.z, entity: old.entity })
      if (cell.entity && !moved.has(cell.entity.id)) events.push({ type: 'entityPlaced', x: cell.x, z: cell.z, entity: cell.entity })
    }
  }
  for (const [key, old] of before) {
    if (!after.has(key) && old.entity && !moved.has(old.entity.id)) events.push({ type: 'entityRemoved', x: old.x, z: old.z, entity: old.entity })
  }
  return events
}

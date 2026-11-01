// État purement visuel de l'interface (glisser-déposer en cours). Rien de tout ça n'est sauvegardé.
import { create } from 'zustand'
import type { DropAction } from '../engine/grid'
import type { ItemId } from '../engine/types'

export interface DragState {
  itemId: ItemId
  x: number // position du pointeur (px)
  y: number
  mergeTarget: ItemId | null // carte du dock survolée
  from?: { x: number; z: number } // glisser d'un producteur de l'île (absent : carte du dock)
  overDock?: boolean // pointeur au-dessus du dock (relâcher reprend le producteur)
  overSell?: boolean // pointeur au-dessus de la zone Vendre
}

export interface HoverCell {
  x: number
  z: number
  action: DropAction | undefined // undefined = dépôt impossible
}

interface UiState {
  drag: DragState | null
  hover: HoverCell | null
  selectedGhost: { x: number; z: number } | null // case achetable sélectionnée (prix affiché)
  editMode: boolean // mode agrandissement : affiche les cases achetables
  mergePrompt: { a: ItemId; b: ItemId } | null // fenêtre « combien fusionner ? » ouverte pour ces deux cartes
  sellPrompt: ItemId | null // fenêtre « combien vendre ? » ouverte pour cette carte
  grimoireOpen: boolean
  newDiscoveries: number // découvertes depuis la dernière ouverture du grimoire (pastille)
  victoryDismissed: boolean
}

export const useUi = create<UiState>(() => ({ drag: null, hover: null, selectedGhost: null, editMode: false, mergePrompt: null, sellPrompt: null, grimoireOpen: false, newDiscoveries: 0, victoryDismissed: false }))

export const toggleEditMode = () => useUi.setState((s) => ({ editMode: !s.editMode, selectedGhost: null }))

// Le fantôme qui suit le doigt est déplacé directement dans le DOM (pas via React : ce serait un rendu à chaque pointermove, jusqu'à 120/s sur iPhone)
let ghost = { x: 0, y: 0 }
export const ghostTransform = () => `translate(${ghost.x}px, ${ghost.y - 28}px) translate(-50%, -50%)`
function moveGhost(x: number, y: number) {
  ghost = { x, y }
  const el = document.querySelector<HTMLElement>('[data-ghost]')
  if (el) el.style.transform = ghostTransform()
}

// Appelée à chaque mouvement du doigt pendant un glissé : déplace le fantôme, mais ne touche au store (donc à React) que si la cible a changé
// (autre case, autre carte survolée, zone Vendre / dock...). x et y du store ne sont donc pas à jour : le fantôme est la seule source de la position.
export function updateDrag(drag: DragState, hover: HoverCell | null) {
  moveGhost(drag.x, drag.y)
  const s = useUi.getState()
  const d = s.drag
  const h = s.hover
  const sameDrag =
    !!d && d.itemId === drag.itemId && d.mergeTarget === drag.mergeTarget && d.overSell === drag.overSell && d.overDock === drag.overDock && d.from?.x === drag.from?.x && d.from?.z === drag.from?.z
  const sameHover = h === hover || (!!h && !!hover && h.x === hover.x && h.z === hover.z && h.action === hover.action)
  if (!(sameDrag && sameHover)) useUi.setState({ drag, hover })
}

// La scène 3D enregistre ici sa fonction « quelle case est sous ce point de l'écran ? » (voir scene/DropPicker.tsx)
// `height` : hauteur du plan de visée (0.04 = sol ; un peu plus haut pour viser le corps d'un personnage)
type CellPicker = (clientX: number, clientY: number, height?: number) => { x: number; z: number } | null
let picker: CellPicker = () => null
export const setCellPicker = (fn: CellPicker) => void (picker = fn)
export const pickCell: CellPicker = (cx, cy, h) => picker(cx, cy, h)

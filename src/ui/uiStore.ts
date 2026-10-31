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

// La scène 3D enregistre ici sa fonction « quelle case est sous ce point de l'écran ? » (voir scene/DropPicker.tsx)
// `height` : hauteur du plan de visée (0.04 = sol ; un peu plus haut pour viser le corps d'un personnage)
type CellPicker = (clientX: number, clientY: number, height?: number) => { x: number; z: number } | null
let picker: CellPicker = () => null
export const setCellPicker = (fn: CellPicker) => void (picker = fn)
export const pickCell: CellPicker = (cx, cy, h) => picker(cx, cy, h)

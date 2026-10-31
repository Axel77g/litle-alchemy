import DungeonBoard from '../scene/DungeonBoard'
import Dock from './Dock'
import Hud from './Hud'
import BoardDrag from './BoardDrag'
import CellTooltip from './CellTooltip'
import Celebrations from './Celebrations'
import Grimoire from './Grimoire'
import IconStudio from './IconStudio'
import AutoplayBadge from '../autoplay/Badge'
import MergeSheet, { SellSheet } from './MergeSheet'

// Écran : la scène 3D en fond, le HUD en haut et le dock en bas par-dessus
export default function App() {
  return (
    <>
      <DungeonBoard />
      <Hud />
      <Dock />
      <MergeSheet />
      <SellSheet />
      <Grimoire />
      <Celebrations />
      <BoardDrag />
      <CellTooltip />
      <IconStudio />
      <AutoplayBadge />
    </>
  )
}

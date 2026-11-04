import DungeonBoard from '../scene/DungeonBoard'
import Dock from './Dock'
import Hud from './Hud'
import BoardDrag from './BoardDrag'
import CellTooltip from './CellTooltip'
import Celebrations from './Celebrations'
import Grimoire from './Grimoire'
import IconStudio from './IconStudio'
import AutoplayBadge from '../autoplay/Badge'
import CellInfoSheet from './CellInfoSheet'
import InfoSheet from './InfoSheet'
import IntroStory from './IntroStory'
import Tutorial from './TutorialOverlay'
import HomeScreen from './HomeScreen'
import SettingsSheet from './SettingsSheet'
import MergeSheet, { SellSheet } from './MergeSheet'
import { Gate, PerfProfiler as P } from '../instrument'

// Écran : la scène 3D en fond, le HUD en haut et le dock en bas par-dessus
export default function App() {
  return (
    <>
      <Gate id="3d.canvas"><P id="DungeonBoard"><DungeonBoard /></P></Gate>
      <Gate id="ui.hud"><P id="Hud"><Hud /></P></Gate>
      <Gate id="ui.dock"><P id="Dock"><Dock /></P></Gate>
      <Gate id="ui.sheets"><P id="MergeSheet"><MergeSheet /></P></Gate>
      <Gate id="ui.sheets"><P id="SellSheet"><SellSheet /></P></Gate>
      <Gate id="ui.sheets"><P id="InfoSheet"><InfoSheet /></P></Gate>
      <Gate id="ui.sheets"><P id="CellInfoSheet"><CellInfoSheet /></P></Gate>
      <Gate id="ui.sheets"><P id="Grimoire"><Grimoire /></P></Gate>
      <Gate id="ui.celebrations"><P id="Celebrations"><Celebrations /></P></Gate>
      <Gate id="ui.boardDrag"><P id="BoardDrag"><BoardDrag /></P></Gate>
      <Gate id="ui.tooltip"><P id="CellTooltip"><CellTooltip /></P></Gate>
      <Gate id="ui.icons"><P id="IconStudio"><IconStudio /></P></Gate>
      <Gate id="ui.overlays"><P id="AutoplayBadge"><AutoplayBadge /></P></Gate>
      <Gate id="ui.overlays"><P id="IntroStory"><IntroStory /></P></Gate>
      <Gate id="ui.tutorial"><P id="Tutorial"><Tutorial /></P></Gate>
      <Gate id="ui.overlays"><P id="HomeScreen"><HomeScreen /></P></Gate>
      <Gate id="ui.sheets"><P id="SettingsSheet"><SettingsSheet /></P></Gate>
    </>
  )
}

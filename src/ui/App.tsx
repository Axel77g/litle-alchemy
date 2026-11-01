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
import { PerfProfiler as P } from '../debug/livePerf'

// Écran : la scène 3D en fond, le HUD en haut et le dock en bas par-dessus
export default function App() {
  return (
    <>
      <P id="DungeonBoard"><DungeonBoard /></P>
      <P id="Hud"><Hud /></P>
      <P id="Dock"><Dock /></P>
      <P id="MergeSheet"><MergeSheet /></P>
      <P id="SellSheet"><SellSheet /></P>
      <P id="InfoSheet"><InfoSheet /></P>
      <P id="CellInfoSheet"><CellInfoSheet /></P>
      <P id="Grimoire"><Grimoire /></P>
      <P id="Celebrations"><Celebrations /></P>
      <P id="BoardDrag"><BoardDrag /></P>
      <P id="CellTooltip"><CellTooltip /></P>
      <P id="IconStudio"><IconStudio /></P>
      <P id="AutoplayBadge"><AutoplayBadge /></P>
      <P id="IntroStory"><IntroStory /></P>
      <P id="Tutorial"><Tutorial /></P>
      <P id="HomeScreen"><HomeScreen /></P>
      <P id="SettingsSheet"><SettingsSheet /></P>
    </>
  )
}

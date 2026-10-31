import { createRoot } from 'react-dom/client'
import App from './ui/App'
import { initFx } from './fx'
import { initAudio } from './audio'
import { startLoop } from './store/loop'
import './debug/island'
import './index.css'

const root = createRoot(document.getElementById('root')!)

if (new URLSearchParams(location.search).has('studio')) {
  // /?studio : studio de capture des icônes (pas de simulation ni de sauvegarde), chargé à la demande
  import('./studio/Studio').then(({ default: Studio }) => root.render(<Studio />))
} else {
  initFx() // branche les animations sur les événements du moteur
  initAudio() // et les sons
  startLoop() // simulation (production) + sauvegarde automatique
  root.render(<App />)
}

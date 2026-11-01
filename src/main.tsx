import { createRoot } from 'react-dom/client'
import App from './ui/App'
import { initFx } from './fx'
import { initAudio } from './xe'
import { initTelemetry } from './telemetry'
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
  initTelemetry() // enregistre la partie (en local seulement) ; AVANT startLoop : il lit la sauvegarde avant le premier autosave
  startLoop() // simulation (production) + sauvegarde automatique
  // /?autoplay=30 : le bot joue une partie neuve à la vitesse ×30 (session jetable : la vraie sauvegarde n'est pas touchée)
  const autoplay = new URLSearchParams(location.search).get('autoplay')
  if (autoplay !== null) import('./autoplay').then((m) => m.startAutoplay(Number(autoplay) || 10))
  root.render(<App />)
}

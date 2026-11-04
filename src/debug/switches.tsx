// Interrupteurs de diagnostic : couper un morceau de l'app à chaud pour voir ce qu'il coûte (dashboard /__perf, voir livePerf.tsx).
// Tout est allumé par défaut et seul le dashboard (via le WebSocket de Vite) change une valeur : sans `?perf`, l'app est strictement inchangée.
// Un interrupteur est soit on / off, soit un choix parmi `options` (la première option est la valeur normale).
import { createElement, Fragment, type ReactNode } from 'react'
import { create } from 'zustand'
import { clock } from '../engine/clock'
import { setSimPaused } from '../store/phase'

export interface SwitchDef {
  key: string
  group: string
  label: string
  hint: string // ce que ça coupe, pour que le dashboard l'explique
  options?: string[] // absent = on / off
  css?: string // règle CSS injectée quand l'interrupteur est coupé (réglages d'affichage)
}

const CSS = {
  animations: '*,*::before,*::after{animation:none!important;transition:none!important}',
  filters: '*,*::before,*::after{filter:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
  shadows: '*,*::before,*::after{box-shadow:none!important;text-shadow:none!important}',
  blend: '*,*::before,*::after{mix-blend-mode:normal!important}',
  canvas: 'canvas{visibility:hidden!important}',
}

export const SWITCHES: SwitchDef[] = [
  // --- Interface (démontée : plus de rendu React, plus de listeners, plus de boucles rAF) ---
  { key: 'ui.hud', group: 'Interface', label: 'HUD', hint: 'Compteur de coquillages, bandeau de quête, boutons. Les coquillages volants n’ont plus de cible.' },
  { key: 'ui.fps', group: 'Interface', label: 'Compteur fps', hint: 'Le petit compteur (écrit dans le DOM 2 fois par seconde).' },
  { key: 'ui.dock', group: 'Interface', label: 'Dock + zone Vendre', hint: 'Le carrousel de cartes et la jauge de stock.' },
  { key: 'ui.sheets', group: 'Interface', label: 'Feuilles (fusion, vente, infos, grimoire, réglages)', hint: 'Toutes les fenêtres modales, fermées ou non.' },
  { key: 'ui.celebrations', group: 'Interface', label: 'Célébrations', hint: 'Bandeau de découverte, alerte dock plein, écran de fin.' },
  { key: 'ui.tutorial', group: 'Interface', label: 'Tutoriel', hint: 'Le trou lumineux (ombre de 9999 px), la main, et sa boucle requestAnimationFrame.' },
  { key: 'ui.tooltip', group: 'Interface', label: 'Infobulle des cases', hint: 'Le listener pointermove sur window et ses raycasts (souris).' },
  { key: 'ui.boardDrag', group: 'Interface', label: 'Glisser les personnages', hint: 'Le listener pointerdown en capture sur window.' },
  { key: 'ui.overlays', group: 'Interface', label: 'Accueil, intro, badge autoplay', hint: 'HomeScreen (backdrop-blur), IntroStory, badge du bot.' },
  { key: 'ui.icons', group: 'Interface', label: 'Générateur d’icônes', hint: 'Le second Canvas WebGL qui rend les icônes des cartes (inutile une fois les icônes prêtes).' },

  // --- Effets DOM (animations hors React) ---
  { key: 'fx.shells', group: 'Effets', label: 'Coquillages volants', hint: 'Éléments DOM animés par l’API Web Animations (un par seconde).' },
  { key: 'fx.confetti', group: 'Effets', label: 'Confettis', hint: 'Jusqu’à 60 éléments DOM animés par découverte.' },

  // --- CSS global (isole le coût de peinture / composition du navigateur) ---
  { key: 'css.animations', group: 'CSS', label: 'Animations et transitions CSS', hint: 'animate-pulse, shine, float, wiggle, pop, transitions des cartes…', css: CSS.animations },
  { key: 'css.filters', group: 'CSS', label: 'filter / backdrop-filter', hint: 'Les 5 drop-shadow de chaque icône, le fantôme, les flous de fond. Suspect n°1 sur Safari.', css: CSS.filters },
  { key: 'css.shadows', group: 'CSS', label: 'box-shadow / text-shadow', hint: 'Ombres des cartes et des boutons, et l’ombre du tutoriel.', css: CSS.shadows },
  { key: 'css.blend', group: 'CSS', label: 'mix-blend-mode', hint: 'Le grain des cartes (multiply) force des calques de composition.', css: CSS.blend },
  { key: 'css.canvas', group: 'CSS', label: 'Afficher le canvas 3D', hint: 'Le cache sans l’arrêter : sépare le coût de rendu du coût de composition.', css: CSS.canvas },

  // --- Simulation (JS pur) ---
  { key: 'sim.loop', group: 'Simulation', label: 'Boucle de simulation', hint: 'Le tick à 10 Hz : production, coquillages, inventaire. Le temps coupé n’est pas rattrapé.' },
  { key: 'sim.clock', group: 'Simulation', label: 'Horloge jour / nuit', hint: 'L’heure du jeu n’avance plus (la nuit ne tombe plus).' },
  { key: 'sim.autosave', group: 'Simulation', label: 'Sauvegarde automatique', hint: 'JSON.stringify + localStorage toutes les 5 s.' },
  { key: 'audio.sfx', group: 'Simulation', label: 'Sons ponctuels', hint: 'Tous les sfx (survol, saisie, fusion, production…).' },
  { key: 'audio.ambience', group: 'Simulation', label: 'Ambiances audio', hint: 'La boucle à 4 Hz qui compte les items du monde et gère feux et pioches.' },

  // --- 3D : rendu ---
  { key: '3d.canvas', group: '3D rendu', label: 'Canvas 3D (démontage)', hint: 'Détruit le contexte WebGL : libère tout le GPU. Le rallumer recompile les shaders.' },
  { key: '3d.render', group: '3D rendu', label: 'Rendu des images', hint: 'Fige l’image : plus de rendu ni de useFrame, mais le contexte reste en mémoire.' },
  { key: '3d.fpsCap', group: '3D rendu', label: 'Plafond de fps (actif)', hint: 'Remplace les 60 fps du mode actif (au repos, c’est toujours 30).', options: ['auto', '45', '30', '20', '15', '10'] },
  { key: '3d.resolution', group: '3D rendu', label: 'Échelle de résolution', hint: 'Multiplie le dpr : 0.5 = 4× moins de pixels.', options: ['auto', '0.75', '0.5', '0.35'] },
  { key: '3d.composer', group: '3D rendu', label: 'Post-processing (tout)', hint: 'Coupe l’EffectComposer entier : retour au rendu direct.' },
  { key: '3d.ao', group: '3D rendu', label: 'Occlusion ambiante (N8AO)', hint: 'Le plus gros effet plein écran.' },
  { key: '3d.bloom', group: '3D rendu', label: 'Bloom', hint: 'Halo mipmap blur sur feu et pièces.' },
  { key: '3d.tiltShift', group: '3D rendu', label: 'Tilt-shift', hint: 'Flou haut et bas de l’écran.' },
  { key: '3d.vignette', group: '3D rendu', label: 'Vignette + tone mapping', hint: 'Deux passes légères en fin de chaîne.' },
  { key: '3d.shadows', group: '3D rendu', label: 'Ombres du soleil', hint: 'Toute l’île re-rendue depuis le soleil (la shadow map).' },
  { key: '3d.contact', group: '3D rendu', label: 'Ombre de contact', hint: 'ContactShadows sous l’île.' },
  { key: '3d.environment', group: '3D rendu', label: 'Environnement HDR', hint: 'Reflets (Environment sunset).' },
  { key: '3d.daynight', group: '3D rendu', label: 'Éclairage jour / nuit', hint: 'Le useFrame qui recalcule soleil, ciel et fond chaque image (peint aussi une texture).' },
  { key: '3d.pointLights', group: '3D rendu', label: 'Lumières des feux de camp', hint: 'Une pointLight par feu : chaque lumière s’ajoute au coût de chaque matériau.' },

  // --- 3D : contenu de la scène ---
  { key: '3d.ground', group: '3D scène', label: 'Sol (herbe, terre, touffes)', hint: 'Les 3 InstancedMesh du sol.' },
  { key: '3d.entities', group: '3D scène', label: 'Personnages, animaux, objets', hint: 'Toutes les cases occupées : modèles, animations, useFrame de chute et de marche.' },
  { key: '3d.sparkles', group: '3D scène', label: 'Étincelles des feux', hint: 'Les particules de drei (shader + boucle propre).' },
  { key: '3d.ghosts', group: '3D scène', label: 'Cases à acheter (fantômes)', hint: 'Un useFrame et un Html par case voisine de l’île.' },
]

const DEFS = new Map(SWITCHES.map((d) => [d.key, d]))
const normal = (d: SwitchDef) => (d.options ? d.options[0] : 'on')

interface SwitchState {
  values: Record<string, string> // seulement ce qui s'écarte de la normale
}
export const useSwitches = create<SwitchState>(() => ({ values: {} }))

export const getSwitch = (key: string) => useSwitches.getState().values[key] ?? normal(DEFS.get(key)!)
export const isOn = (key: string) => getSwitch(key) === 'on'
// Dans un composant : se redessine quand cet interrupteur change
export const useSwitch = (key: string) => useSwitches((s) => s.values[key] ?? normal(DEFS.get(key)!))
export const useIsOn = (key: string) => useSwitch(key) === 'on'

export function setSwitch(key: string, value: string) {
  const def = DEFS.get(key)
  if (!def || (def.options ? !def.options.includes(value) : value !== 'on' && value !== 'off')) return
  useSwitches.setState((s) => {
    const values = { ...s.values }
    if (value === normal(def)) delete values[key]
    else values[key] = value
    return { values }
  })
}

// Remplace l'état complet (le serveur le renvoie après un rechargement de la page)
export function applySwitches(values: Record<string, string>) {
  for (const def of SWITCHES) setSwitch(def.key, values[def.key] ?? normal(def))
}

// Monte l'élément seulement si l'interrupteur est allumé : `<Gate id="ui.hud"><Hud /></Gate>`
export function Gate({ id, children }: { id: string; children: ReactNode }) {
  return useIsOn(id) ? createElement(Fragment, null, children) : null
}

// --- effets de bord : ce qui ne se lit pas dans un composant ---------------------------------------------------------------

let wired = false
export function initSwitchEffects() {
  if (wired) return
  wired = true
  const style = document.createElement('style')
  style.dataset.perfSwitches = ''
  document.head.appendChild(style)
  const cssDefs = SWITCHES.filter((d) => d.css)

  const sync = (values: Record<string, string>, prev?: Record<string, string>) => {
    const was = (k: string) => (prev ? prev[k] : undefined)
    style.textContent = cssDefs.filter((d) => values[d.key] === 'off').map((d) => d.css).join('\n')
    if (!prev) return // au démarrage tout est normal : on ne touche pas à ce que island.* a pu régler
    if (values['sim.loop'] !== was('sim.loop')) setSimPaused(values['sim.loop'] === 'off')
    if (values['sim.clock'] !== was('sim.clock')) clock.paused = values['sim.clock'] === 'off'
  }
  sync(useSwitches.getState().values)
  useSwitches.subscribe((s, p) => sync(s.values, p.values))
}

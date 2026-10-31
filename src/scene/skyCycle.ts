// Cycle jour / nuit : uniquement visuel (n'a aucun effet sur la production du jeu).
// L'état du ciel est calculé à partir de l'heure (0..24) en interpolant entre des « keyframes » d'éclairage.
import * as THREE from 'three'
import { clock } from '../engine/clock'

// Le tone mapping (ACES) du post-processing assombrit et ternit le fond : on le compense en multipliant son intensité.
// (un fond noir reste noir : 0 × n'importe quoi = 0)
export const BACKGROUND_BOOST = 1.8

// Heure courante et vitesse : l'horloge du jeu (engine/clock.ts), modifiable depuis la console (island.time, island.dayLength, island.freezeTime)
export const dayCycle = clock

interface Keyframe {
  hour: number
  sun: string // couleur du soleil
  sunIntensity: number
  hemiSky: string // lumière ambiante venant du ciel
  hemiGround: string // ... et du sol
  hemiIntensity: number
  background: string // centre du dégradé radial du fond (derrière l'île)
  edge: string // bords du dégradé : plus profond
  env: number // intensité des reflets de l'environnement
  night: number // 0 = plein jour, 1 = nuit (feux plus forts, fenêtres allumées)
}

// La nuit n'est jamais noire : clair de lune bleu indigo (ambiance + « soleil » lunaire rasant) pour les bords de l'île,
// et le feu de camp orange au centre -> contraste orange / bleu (teal & orange)
const NIGHT = { sun: '#637dff', sunIntensity: 0.55, hemiSky: '#4b69ff', hemiGround: '#1b1850', hemiIntensity: 0.85, background: '#2c254d', edge: '#0f0c1d', env: 0.12, night: 1 }

const KEYFRAMES: Keyframe[] = [
  { hour: 0, ...NIGHT },
  { hour: 4.5, ...NIGHT },
  { hour: 5.5, sun: '#8a5a9a', sunIntensity: 0.35, hemiSky: '#6a6ad8', hemiGround: '#2a1a40', hemiIntensity: 0.7, background: '#5a4a9a', edge: '#1c1840', env: 0.1, night: 0.85 }, // aube : le ciel commence à bleuir
  { hour: 6.5, sun: '#ff8a3a', sunIntensity: 3.2, hemiSky: '#ffa070', hemiGround: '#4a2a18', hemiIntensity: 0.55, background: '#f6bf9c', edge: '#5a3a58', env: 0.25, night: 0.1 }, // lever : ciel bleu clair orangé, lumière orangée
  { hour: 8, sun: '#ffcf9a', sunIntensity: 2.6, hemiSky: '#a8bfff', hemiGround: '#3a2818', hemiIntensity: 0.6, background: '#aed6f5', edge: '#3f6a8c', env: 0.3, night: 0 }, // matin : bleu clair
  { hour: 9.5, sun: '#ffe2b8', sunIntensity: 2.0, hemiSky: '#9fc0ff', hemiGround: '#3a2818', hemiIntensity: 0.65, background: '#8ccfe8', edge: '#2f6084', env: 0.35, night: 0 },
  { hour: 12, sun: '#fff1dd', sunIntensity: 2.4, hemiSky: '#87a8ff', hemiGround: '#3a2818', hemiIntensity: 0.75, background: '#7ec8e3', edge: '#2b5876', env: 0.45, night: 0 }, // plein jour : bleu ciel
  { hour: 16, sun: '#ffe9c8', sunIntensity: 2.2, hemiSky: '#9fc0ff', hemiGround: '#3a2818', hemiIntensity: 0.7, background: '#7ec8e3', edge: '#2b5876', env: 0.4, night: 0 },
  { hour: 18.5, sun: '#ff7030', sunIntensity: 3.2, hemiSky: '#ff9060', hemiGround: '#4a2418', hemiIntensity: 0.5, background: '#b0605a', edge: '#3a1f3a', env: 0.25, night: 0.1 }, // coucher : le ciel s'assombrit, lumière orangée
  { hour: 19.7, sun: '#8a5a9a', sunIntensity: 0.35, hemiSky: '#6a6ad8', hemiGround: '#2a1a40', hemiIntensity: 0.7, background: '#3a3080', edge: '#150f35', env: 0.1, night: 0.85 }, // crépuscule
  { hour: 21, ...NIGHT },
  { hour: 24, ...NIGHT },
]

const color = (hex: string) => new THREE.Color(hex)
const frames = KEYFRAMES.map((k) => ({ ...k, sunC: color(k.sun), skyC: color(k.hemiSky), groundC: color(k.hemiGround), bgC: color(k.background), edgeC: color(k.edge) }))

// État du ciel calculé, lu par DayNight.tsx et par les feux de camp
export const sky = {
  sunColor: new THREE.Color(),
  sunIntensity: 0,
  sunPosition: new THREE.Vector3(),
  hemiSky: new THREE.Color(),
  hemiGround: new THREE.Color(),
  hemiIntensity: 0,
  background: new THREE.Color(),
  edge: new THREE.Color(),
  env: 0,
  night: 0, // 0 = plein jour, 1 = nuit noire
}

const smooth = (t: number) => t * t * (3 - 2 * t)
const SUN_DISTANCE = 18

export function updateSky(hour: number) {
  const h = ((hour % 24) + 24) % 24
  let i = frames.findIndex((f) => f.hour > h) - 1
  if (i < 0) i = frames.length - 2
  const a = frames[i]
  const b = frames[i + 1]
  const t = smooth((h - a.hour) / (b.hour - a.hour))

  sky.sunColor.copy(a.sunC).lerp(b.sunC, t)
  sky.hemiSky.copy(a.skyC).lerp(b.skyC, t)
  sky.hemiGround.copy(a.groundC).lerp(b.groundC, t)
  sky.background.copy(a.bgC).lerp(b.bgC, t)
  sky.edge.copy(a.edgeC).lerp(b.edgeC, t)
  sky.sunIntensity = THREE.MathUtils.lerp(a.sunIntensity, b.sunIntensity, t)
  sky.hemiIntensity = THREE.MathUtils.lerp(a.hemiIntensity, b.hemiIntensity, t)
  sky.env = THREE.MathUtils.lerp(a.env, b.env, t)
  sky.night = THREE.MathUtils.lerp(a.night, b.night, t)

  // Le soleil se lève à l'est (6 h), culmine à midi, se couche à l'ouest (18 h). Son altitude est plafonnée par le bas :
  // une lumière rasante n'éclairerait presque pas le dessus des cases, et sous l'horizon elle casserait la caméra d'ombre (de toute façon éteinte la nuit).
  const angle = ((h - 6) / 12) * Math.PI
  const elevation = Math.max(Math.sin(angle), 0.32)
  sky.sunPosition.set(Math.cos(angle) * 0.85, elevation, 0.45).normalize().multiplyScalar(SUN_DISTANCE)
}

export const formatHour = (hour: number) => {
  const h = Math.floor(hour)
  return `${String(h).padStart(2, '0')}:${String(Math.floor((hour - h) * 60)).padStart(2, '0')}`
}

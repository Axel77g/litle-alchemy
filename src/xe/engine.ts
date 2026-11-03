// Moteur audio (Web Audio) : contexte, volume général, mute, lecture d'un fichier décodé, limiteur de voix.
// Le contexte est créé à la demande et débloqué au premier geste de l'utilisateur (obligatoire sur iOS / Safari).

import { isOn } from '../debug/switches'

const MUTE_KEY = 'alchemy:muted'
const VOLUME_KEY = 'alchemy:volume'
const MAX_VOICES = 16 // au-delà, on ignore les nouveaux sons plutôt que de saturer
const MASTER_VOLUME = 0.3

let ctx: AudioContext | null = null
let master: GainNode | null = null
let voices = 0
let muted = readMuted()
let volume = readVolume() // réglage du joueur (0..1), multiplie MASTER_VOLUME
let ready = false
const readyCallbacks: (() => void)[] = []
const lastPlayed = new Map<string, number>()

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

function readVolume() {
  try {
    const raw = localStorage.getItem(VOLUME_KEY)
    const n = raw === null ? 1 : Number(raw)
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1
  } catch {
    return 1
  }
}

const level = () => (muted ? 0 : MASTER_VOLUME * volume)

export const isMuted = () => muted
export const getVolume = () => volume
export function setVolume(value: number) {
  volume = Math.min(1, Math.max(0, value))
  try {
    localStorage.setItem(VOLUME_KEY, String(volume))
  } catch {
    // stockage indisponible : le choix vaut pour cette session
  }
  if (master && ctx) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.02)
}
export function setMuted(value: boolean, persist = true) {
  muted = value
  try {
    if (persist) localStorage.setItem(MUTE_KEY, value ? '1' : '0')
  } catch {
    // stockage indisponible : le choix vaut pour cette session
  }
  if (master && ctx) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.02)
}

function ensureContext(): AudioContext | null {
  if (ctx) return ctx
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  ctx = new Ctor()
  master = ctx.createGain()
  master.gain.value = level()
  // un compresseur évite que 20 producteurs au même tick ne saturent
  const comp = ctx.createDynamicsCompressor()
  master.connect(comp).connect(ctx.destination)
  return ctx
}

// À appeler une fois : le premier vrai geste (tap, clic, touche) crée et réveille le contexte audio.
// iOS / Safari : un `pointerdown` TACTILE ne compte pas comme un geste autorisant le son, seuls `pointerup`, `touchend`,
// `click` et `keydown` le font. On écoute donc ces événements et on ne se désabonne qu'une fois le contexte vraiment en marche.
export function unlockAudio() {
  // iOS 17+ : joue même quand le commutateur silencieux est activé (la musique du jeu n'est pas une sonnerie)
  const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession
  if (session) session.type = 'playback'

  const events = ['pointerup', 'touchend', 'click', 'keydown'] as const
  const unlock = () => {
    const c = ensureContext()
    if (!c) return
    void c.resume() // appelé DANS le geste, obligatoire sur iOS
    if (!ready) {
      ready = true
      readyCallbacks.splice(0).forEach((fn) => fn()) // synchrone : la musique doit démarrer dans le geste
    }
    if (c.state === 'running') events.forEach((e) => window.removeEventListener(e, unlock, true))
  }
  events.forEach((e) => window.addEventListener(e, unlock, true))

  // Retour sur l'onglet / l'app (iOS suspend l'audio en arrière-plan) : on le relance
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && ctx && ctx.state !== 'running') void ctx.resume()
  })
}

export const getContext = () => ctx
export const getMaster = () => master

// Exécute fn dès que le contexte audio existe (après le premier geste de l'utilisateur)
export const whenReady = (fn: () => void) => (ready ? fn() : void readyCallbacks.push(fn))

// Joue un fichier déjà décodé. rate : vitesse de lecture (1 = normale), vol : volume (1 = tel quel)
export interface Voice {
  src: AudioBufferSourceNode
  gain: GainNode
}

// startAt : secondes du fichier à sauter au début (silence de tête qui retarde le son)
export function playBuffer(buffer: AudioBuffer, vol = 1, rate = 1, startAt = 0): Voice | undefined {
  const c = ctx
  if (!c || !master) return undefined
  const src = c.createBufferSource()
  src.buffer = buffer
  src.playbackRate.value = rate
  const g = c.createGain()
  g.gain.value = vol
  src.connect(g).connect(master)
  src.start(0, Math.min(startAt, Math.max(0, buffer.duration - 0.01)))
  voices++
  src.onended = () => void voices--
  return { src, gain: g }
}

export const jitter = (amount = 0.06) => 1 + (Math.random() * 2 - 1) * amount

// Joue un son, avec une cadence minimale par `key` (évite les rafales identiques) et un plafond de voix
export function play(key: string, minGapMs: number, sound: () => void) {
  if (muted || !isOn('audio.sfx')) return
  const c = ensureContext()
  if (!c || c.state !== 'running' || voices >= MAX_VOICES) return
  const now = performance.now()
  if (now - (lastPlayed.get(key) ?? -Infinity) < minGapMs) return
  lastPlayed.set(key, now)
  sound()
}

// Ambiances liées à la présence des producteurs : tant qu'un Mineur est sur l'île, on l'entend piocher ; un Feu de Camp crépite.
// On lit l'état du monde (pas le bus d'événements) : 1 son par TYPE d'item, pas par exemplaire.
import { useGame } from '../store/game'
import { AMBIENCE, SFX, type AmbienceDef } from './manifest'
import { bufferOf, pickLoaded, preload } from './samples'
import { getContext, getMaster, isMuted, jitter, play, playBuffer, type Voice } from './engine'

const TICK_MS = 250
const rand = ([min, max]: [number, number]) => min + Math.random() * (max - min)

// Plusieurs exemplaires : le volume et la cadence montent doucement (1 → 1, 4 → 1.6, 16 → 2.2), jamais en proportion
const crowd = (count: number) => 1 + Math.log2(count) * 0.3

interface Loop {
  src: AudioBufferSourceNode
  gain: GainNode
}

const loops = new Map<string, Loop>()
const nextStrike = new Map<string, number>()
const strikeVoices = new Map<string, Set<Voice>>() // coups en cours de lecture, pour pouvoir les couper

function countItems(): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const cell of useGame.getState().world.values()) {
    if (cell.entity) counts[cell.entity.itemId] = (counts[cell.entity.itemId] ?? 0) + 1
  }
  return counts
}

// Nombre d'exemplaires qui justifient l'ambiance : ceux de l'item, ou 1 pour une ambiance globale (always)
const presence = (id: string, def: AmbienceDef, counts: Record<string, number>) => (def.always ? 1 : (counts[id] ?? 0))

const active = (def: AmbienceDef, night: boolean) => !def.when || (def.when === 'night') === night

function stopLoop(id: string) {
  const loop = loops.get(id)
  const ctx = getContext()
  if (!loop || !ctx) return
  loops.delete(id)
  loop.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.3)
  loop.src.stop(ctx.currentTime + 1.5)
}

// Fichier en boucle : un seul exemplaire par item, dont le volume suit le nombre d'exemplaires
function runLoop(id: string, def: AmbienceDef, count: number, on: boolean) {
  const ctx = getContext()
  const master = getMaster()
  const file = def.files.find((f) => bufferOf(f))
  if (!ctx || !master || !file) return // pas (encore) de fichier : rien à jouer
  const volume = on && !isMuted() ? (def.volume ?? 1) * Math.min(crowd(count), 2) * 0.6 : 0
  let loop = loops.get(id)
  if (!loop && volume > 0) {
    const src = ctx.createBufferSource()
    src.buffer = bufferOf(file)!
    src.loop = true
    const gain = ctx.createGain()
    gain.gain.value = 0
    src.connect(gain).connect(master)
    src.start(0, Math.random() * src.buffer!.duration) // départ décalé : deux feux ne battent pas en phase
    loop = { src, gain }
    loops.set(id, loop)
  }
  loop?.gain.gain.setTargetAtTime(volume, ctx.currentTime, 0.4)
}

// L'ambiance n'est plus valable (la nuit tombe, le Mineur est repris...) : les coups en cours s'arrêtent en fondu au lieu d'aller au bout du fichier
function cutStrikes(id: string) {
  const voices = strikeVoices.get(id)
  const ctx = getContext()
  if (!voices || !ctx) return
  for (const v of voices) {
    v.gain.gain.cancelScheduledValues(ctx.currentTime)
    v.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.08)
    v.src.stop(ctx.currentTime + 0.5)
  }
  voices.clear()
  nextStrike.delete(id)
}

// Coups espacés au hasard (pioche, hache...)
function runStrikes(id: string, def: AmbienceDef, count: number, now: number) {
  if (now < (nextStrike.get(id) ?? 0)) return
  const interval = def.interval ?? [2, 5]
  nextStrike.set(id, now + (rand(interval) * 1000) / crowd(count))
  const level = (def.volume ?? 1) * Math.min(crowd(count), 1.8)
  const buffer = pickLoaded(`amb:${id}`, def.files)
  if (!buffer) return
  play(`amb:${id}`, 0, () => {
    const voice = playBuffer(buffer, level, jitter(def.pitchJitter ?? 0.06))
    if (!voice) return
    const voices = strikeVoices.get(id) ?? new Set<Voice>()
    strikeVoices.set(id, voices)
    voices.add(voice)
    voice.src.addEventListener('ended', () => voices.delete(voice))
  })
}

export function initAmbience() {
  preload(Object.values(AMBIENCE).flatMap((d) => d.files))
  preload(Object.values(SFX).flatMap((d) => d.files))

  return setInterval(() => {
    if (document.hidden) return
    const now = performance.now()
    const night = useGame.getState().night
    const counts = countItems()
    for (const [id, def] of Object.entries(AMBIENCE)) {
      const count = presence(id, def, counts)
      const on = count > 0 && active(def, night)
      if (def.mode === 'loop') {
        runLoop(id, def, count, on)
        continue
      }
      if (!on) {
        cutStrikes(id)
        continue
      }
      runStrikes(id, def, count, now)
    }
    for (const id of loops.keys()) if (!(presence(id, AMBIENCE[id], counts) > 0) || !active(AMBIENCE[id], night)) stopLoop(id)
  }, TICK_MS)
}

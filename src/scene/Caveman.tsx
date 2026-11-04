import { Fragment, createContext, useContext, useEffect, useMemo, useRef, type RefObject } from 'react'
import { createPortal } from '@react-three/fiber'
import { useFrame } from '../instrument'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import { HELD, PROPS } from './props'
import { noise1 } from './noise'

// Cro-Magnon : le modèle 3D animé (public/models/caveman.glb). Il ne décide pas de son animation : World.tsx (Alive) écrit sa pose
// à chaque image dans un ref partagé par contexte, et on joue le clip qui va avec.
export type Pose = 'loot' | 'walk' | 'sleep' | 'idle'
export interface PoseState {
  pose: Pose
  speed: number // multiplicateur de vitesse d'animation (frénésie...)
  seed: number // [0, 1[ propre à ce personnage : décale ses animations pour qu'ils ne soient pas synchrones
  hidden: boolean // rentré dans sa cabane : rien à animer
}
const DEFAULT_POSE: PoseState = { pose: 'loot', speed: 1, seed: 0, hidden: false }
export const PoseContext = createContext<RefObject<PoseState> | null>(null)

const URL = `${import.meta.env.BASE_URL}models/caveman.glb`
const CLIPS: Record<Pose, string> = {
  loot: 'Collect_Object', // il se baisse et ramasse des choses au sol
  walk: 'Walking',
  idle: '_01a19722_1877_779f_8fca_51f37f95faed', // attente, debout (clip sans nom dans le .glb)
  sleep: '_01a196fc_da7b_710e_baf6_1c9dd4974de2', // se coucher (clip sans nom dans le .glb)
}
const FADE = 0.25 // fondu entre deux animations
const SPEED_JITTER = 0.1 // la vitesse d'animation de chacun dérive doucement de ±10 %
const SCALE = 0.55 // le modèle fait 1,7 de haut ; les personnages voxel font ~0,9

// Modèles qui jouent leurs animations eux-mêmes (World.tsx ne les couche donc pas à la main)
export const ANIMATED_MODELS = new Set(['caveman', 'hunter', 'painter', 'miner', 'lumberjack', 'cow', 'mammoth'])

// Objet tenu en main. `prop` : un id de PROPS (props.tsx) ou de HELD ; `scale` : taille dans le repère du modèle ;
// `grip` : hauteur de la prise sur le prop ; `tilt` : inclinaison à annuler quand le prop est posé de biais
export interface Held {
  hand: 'Left' | 'Right'
  prop: string
  scale: number
  grip: number
  tilt?: number
  width?: number // épaisseur relative (1 = proportionnelle à la taille) : < 1 pour affiner sans raccourcir
}
export const HUNTER_HELD: Held[] = [{ hand: 'Right', prop: 'flint_tool', scale: 2.4, grip: 0.3, tilt: 0.45, width: 0.45 }] // l'Outil en Silex fait ~0,8
export const MINER_HELD: Held[] = [{ hand: 'Right', prop: 'pickaxe', scale: 1.6, grip: 0.2, width: 0.7 }]
export const LUMBERJACK_HELD: Held[] = [{ hand: 'Right', prop: 'axe', scale: 1.6, grip: 0.2, width: 0.7 }]
export const PAINTER_TOOLS: Held[] = [
  { hand: 'Right', prop: 'brush', scale: 1.4, grip: 0.1 },
  { hand: 'Left', prop: 'palette', scale: 1.3, grip: 0 },
]
// (GLTFLoader retire les « : » des noms de nœuds)
const boneName = (hand: Held['hand']) => `mixamorig${hand}Hand`

// `freeze` : au travail il reste en attente (idle) au lieu de ramasser des coquillages
export default function Caveman({ held = [], freeze = false }: { held?: Held[]; freeze?: boolean }) {
  const { scene, animations } = useGLTF(URL)
  const model = useMemo(() => {
    const clone = SkeletonUtils.clone(scene)
    clone.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true
        o.receiveShadow = true
        o.frustumCulled = false // la boîte englobante d'un mesh skinné ne suit pas l'animation
      }
    })
    return clone
  }, [scene])
  // Place les objets dans les mains. Calculé dans la pose de repos : ils restent verticaux dans le monde, quelle que soit l'orientation des axes de l'os
  const grips = useMemo(() => {
    model.updateMatrixWorld(true)
    return held.flatMap((item) => {
      const hand = model.getObjectByName(boneName(item.hand))
      const Prop = PROPS[item.prop] ?? HELD[item.prop]
      if (!hand || !Prop) return []
      const palm = hand.getObjectByName(`${boneName(item.hand)}Middle1`)?.position ?? new THREE.Vector3()
      return [{ item, hand, Prop, position: palm.clone().multiplyScalar(0.6), quaternion: hand.getWorldQuaternion(new THREE.Quaternion()).invert(), scale: item.scale / hand.getWorldScale(new THREE.Vector3()).x }]
    })
  }, [model, held])
  // Mixer à nous (et non useAnimations) : on ne le fait avancer que si le personnage est visible
  const { mixer, actions } = useMemo(() => {
    const mixer = new THREE.AnimationMixer(model)
    const actions: Record<string, THREE.AnimationAction> = {}
    for (const clip of animations) actions[clip.name] = mixer.clipAction(clip)
    return { mixer, actions }
  }, [model, animations])
  const state = useContext(PoseContext)
  const current = useRef<Pose | null>(null)

  useEffect(() => () => {
    mixer.stopAllAction()
    mixer.uncacheRoot(model)
  }, [mixer, model])

  useFrame('Caveman.anim', ({ clock }, delta) => {
    const { pose: wanted, speed, seed, hidden } = state?.current ?? DEFAULT_POSE
    if (hidden) return // dans la cabane : ni changement de pose, ni mise à jour des os
    const pose = freeze && wanted === 'loot' ? 'idle' : wanted // les métiers ne ramassent rien : au travail, ils sont en attente
    const action = actions[CLIPS[pose]]
    if (pose !== current.current) {
      if (!action) return
      const prev = current.current && actions[CLIPS[current.current]]
      action.reset()
      if (pose === 'sleep') {
        // se couche une fois, puis reste couché
        action.setLoop(THREE.LoopOnce, 1)
        action.clampWhenFinished = true
      } else {
        action.setLoop(THREE.LoopRepeat, Infinity)
        action.time = seed * action.getClip().duration // départ à un endroit différent du cycle
      }
      action.play()
      if (prev) prev.crossFadeTo(action, FADE, false)
      else action.fadeIn(FADE)
      current.current = pose
    }
    // vitesse : celle demandée, avec une dérive lente propre à chaque personnage (bruit)
    action?.setEffectiveTimeScale(speed * (1 + noise1(clock.elapsedTime * 0.15 + seed * 50, seed) * SPEED_JITTER))
    if (pose === 'sleep' && action?.paused) return // couché pour de bon : la pose ne change plus
    mixer.update(delta)
  })

  return (
    <group scale={SCALE}>
      <primitive object={model} />
      {grips.map(({ item, hand, Prop, position, quaternion, scale }) => (
        <Fragment key={item.hand}>
          {createPortal(
            <group position={position} quaternion={quaternion} scale={scale}>
              <group position-y={-item.grip} rotation-z={item.tilt ?? 0} scale={[item.width ?? 1, 1, item.width ?? 1]}>
                <Prop />
              </group>
            </group>,
            hand,
          )}
        </Fragment>
      ))}
    </group>
  )
}

useGLTF.preload(URL)

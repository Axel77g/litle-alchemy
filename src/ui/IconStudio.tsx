import { useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrthographicCamera } from '@react-three/drei'
import * as THREE from 'three'
import { create } from 'zustand'
import { OBJECTS } from '../scene/objects'
import { useGame } from '../store/game'

// « Studio photo » : les icônes des cartes sont des rendus PNG transparents des vrais modèles 3D voxel de l'île (cohérence visuelle
// parfaite, plus d'emojis système). Un petit Canvas caché les photographie une fois au démarrage, puis disparaît.
// Tant qu'une icône n'est pas prête (ou si l'item n'a pas de modèle), ItemIcon retombe sur l'emoji.
// `stickers` : la même icône avec son contour blanc et son ombre dures déjà dessinés dedans ; `silhouettes` : sa silhouette noire (grimoire, items inconnus).
// Les deux sont cuits ici, une fois : en CSS ils étaient des `filter` (5 drop-shadow par icône) que le navigateur recalcule dès que l'icône bouge.
export const useIcons = create<{ urls: Record<string, string>; stickers: Record<string, string>; silhouettes: Record<string, string> }>(() => ({ urls: {}, stickers: {}, silhouettes: {} }))

const SIZE = 256
const OUTLINE = 7 // px (de 256) : l'épaisseur du contour, ≈ 2 px CSS pour une icône de 66 px
const SHADOW = 11 // px : décalage de l'ombre dure vers le bas, ≈ 3 px CSS
const PAD = OUTLINE + SHADOW + 2 // marge ajoutée autour pour que le contour et l'ombre ne soient pas coupés
// L'image cuite est plus grande que l'icône : on l'affiche agrandie de ce facteur, décalée de -MARGIN (de la taille de l'icône), pour que la place prise ne change pas
export const STICKER_SCALE = (SIZE + PAD * 2) / SIZE
export const STICKER_MARGIN = PAD / SIZE
const FIT = 2 // taille (en unités) du plus grand côté du modèle, une fois normalisé

const canvasOf = (size: number) => Object.assign(document.createElement('canvas'), { width: size, height: size })

// Dessine le contour (l'icône étalée dans 16 directions, en blanc opaque), l'ombre dure (ce contour en noir à 35 %, décalé) puis l'icône par-dessus
function bake(src: string): Promise<{ sticker: string; silhouette: string } | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onerror = () => resolve(null)
    img.onload = () => {
      const W = SIZE + PAD * 2
      const solid = (source: CanvasImageSource, w: number, color: string) => {
        const c = canvasOf(w)
        const g = c.getContext('2d')!
        g.drawImage(source, 0, 0)
        g.globalCompositeOperation = 'source-in' // garde la forme (l'alpha), remplace la couleur
        g.fillStyle = color
        g.fillRect(0, 0, w, w)
        return c
      }
      const spread = canvasOf(W)
      const sg = spread.getContext('2d')!
      for (let i = 0; i < 16; i++) sg.drawImage(img, PAD + Math.cos((i / 16) * Math.PI * 2) * OUTLINE, PAD + Math.sin((i / 16) * Math.PI * 2) * OUTLINE)
      sg.drawImage(img, PAD, PAD)
      const outline = solid(spread, W, '#fff')
      const shade = solid(spread, W, 'rgba(0,0,0,0.35)')

      const sticker = canvasOf(W)
      const g = sticker.getContext('2d')!
      g.drawImage(shade, 0, SHADOW)
      g.drawImage(outline, 0, 0)
      g.drawImage(img, PAD, PAD)
      resolve({ sticker: sticker.toDataURL('image/png'), silhouette: solid(img, SIZE, '#000').toDataURL('image/png') })
    }
    img.src = src
  })
}

// Photographie le modèle courant : on le recadre à la 1ère image, on capture à la 3e (après un vrai rendu), puis on passe au suivant
function Shot({ id, onDone }: { id: string; onDone: () => void }) {
  const Model = OBJECTS[useGame.getState().rules.items[id]?.model ?? '']
  const group = useRef<THREE.Group>(null!)
  const gl = useThree((s) => s.gl)
  const frame = useRef(0)

  useFrame(() => {
    frame.current++
    if (frame.current === 1) {
      const box = new THREE.Box3().setFromObject(group.current)
      const size = box.getSize(new THREE.Vector3())
      const center = box.getCenter(new THREE.Vector3())
      const k = FIT / Math.max(size.x, size.y, size.z, 0.001)
      group.current.scale.setScalar(k)
      group.current.position.copy(center.multiplyScalar(-k))
    } else if (frame.current === 3) {
      const url = gl.domElement.toDataURL('image/png')
      useIcons.setState((s) => ({ urls: { ...s.urls, [id]: url } }))
      void bake(url).then((baked) => baked && useIcons.setState((s) => ({ stickers: { ...s.stickers, [id]: baked.sticker }, silhouettes: { ...s.silhouettes, [id]: baked.silhouette } })))
      onDone()
    }
  })

  return Model ? (
    <group ref={group}>
      <Model />
    </group>
  ) : null
}

export default function IconStudio() {
  const rules = useGame((s) => s.rules)
  const [ids] = useState(() => Object.values(rules.items).filter((d) => d.model && OBJECTS[d.model]).map((d) => d.id))
  const [index, setIndex] = useState(0)
  const done = index >= ids.length
  const next = useRef(() => setIndex((i) => i + 1))

  // Une fois la série terminée, le Canvas est démonté : plus de contexte WebGL pour les icônes
  if (done) return null

  return (
    <div aria-hidden className="pointer-events-none fixed left-[-9999px] top-0" style={{ width: SIZE, height: SIZE }}>
      <Canvas dpr={1} gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }} style={{ width: SIZE, height: SIZE }}>
        <OrthographicCamera makeDefault position={[5, 5, 5]} zoom={SIZE / 3.4} near={-50} far={50} onUpdate={(c) => c.lookAt(0, 0, 0)} />
        {/* Lumière forte et plate : les couleurs restent pop, quel que soit le modèle */}
        <ambientLight intensity={1.3} />
        <hemisphereLight args={['#ffffff', '#c8b8a0', 1]} />
        <directionalLight position={[3, 6, 4]} intensity={2.4} />
        <directionalLight position={[-4, 2, -3]} intensity={0.6} color="#9fc0ff" />
        <Shot key={ids[index]} id={ids[index]} onDone={next.current} />
      </Canvas>
    </div>
  )
}

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
export const useIcons = create<{ urls: Record<string, string> }>(() => ({ urls: {} }))

const SIZE = 256
const FIT = 2 // taille (en unités) du plus grand côté du modèle, une fois normalisé

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
      useIcons.setState((s) => ({ urls: { ...s.urls, [id]: gl.domElement.toDataURL('image/png') } }))
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

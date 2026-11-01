import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'

// Animal (ou autre objet immobile, comme les huttes) en modèle 3D (public/models/*.glb) : vache, mammouth. S'il a une animation, il reste figé sur sa première image (on ne veut pas de marche).
// Les .glb ont chacun leur échelle et leur orientation : on mesure le modèle une fois et on le met à la taille voulue, les pieds au sol, centré sur la case.
export interface AnimalModel {
  file: string
  length: number // longueur voulue (la plus grande dimension horizontale)
  width?: number // affine la largeur (x, z) sans toucher à la hauteur : 0,85 = 15 % plus étroit
  facing: number // rotation autour de y : les modèles voxel regardent +x, à changer si l'animal est de travers ou à l'envers
}

const urlOf = (file: string) => `${import.meta.env.BASE_URL}models/${file}`

export const COW: AnimalModel = { file: 'cow.glb', length: 1.4, facing: Math.PI / 2 }
export const HUT: AnimalModel = { file: 'hut.glb', length: 1.0, width: 0.85, facing: 0 }
export const HUT_LV2: AnimalModel = { file: 'hut_lv2.glb', length: 1.3, width: 0.85, facing: 0 }
export const MAMMOTH: AnimalModel = { file: 'mamouth.glb', length: 1.7, facing: Math.PI / 2 }

function Animal({ file, length, facing, width = 1 }: AnimalModel) {

  const { scene, animations } = useGLTF(urlOf(file))
  const { model, scale, offset } = useMemo(() => {
    const clone = SkeletonUtils.clone(scene)
    clone.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true
        o.receiveShadow = true
        o.frustumCulled = false
      }
    })
    clone.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(clone, true)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const scale = length / Math.max(size.x, size.z) // la plus grande dimension à l'horizontale = la longueur
    return { model: clone, scale, offset: new THREE.Vector3(-center.x, -box.min.y, -center.z) }
  }, [scene, length])
  // Figé sur sa première image : on pose l'animation une fois et le mixer n'avance plus jamais (pas de coût par image)
  useEffect(() => {
    if (!animations[0]) return
    const mixer = new THREE.AnimationMixer(model)
    mixer.clipAction(animations[0]).play()
    mixer.update(0)
    return () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(model)
    }
  }, [animations, model])

  return (
    <group rotation-y={facing} scale={[scale * width, scale, scale * width]}>
      <group position={offset}>
        <primitive object={model} />
      </group>
    </group>
  )
}

export const makeAnimal = (model: AnimalModel) => {
  useGLTF.preload(urlOf(model.file))
  return () => <Animal {...model} />
}

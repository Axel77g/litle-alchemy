import { useMemo } from 'react'
import { useFrame } from '../instrument'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

// Feu de camp en modèle 3D (public/models/campfire.glb). Le .glb n'a qu'un seul mesh et une seule texture (atlas) : la flamme n'est pas un mesh à part.
// On la retrouve à l'exécution : un triangle dont le texel (au centre de ses UV) est orange / jaune vif est de la flamme, le reste (bois brun, pierres grises) est le décor.
// Deux géométries qui partagent les mêmes buffers (seul l'index change) : le décor garde son matériau d'origine (éclairé, avec ombres),
// la flamme reçoit un matériau émissif (donc le Bloom) dont le vertex shader la fait onduler. Le maillage low poly reste visible : chaque facette suit son sommet.

const URL = `${import.meta.env.BASE_URL}models/campfire.glb`
const LENGTH = 0.85 // plus grande dimension horizontale voulue, en cases
const SPEED = 1 // vitesse de l'animation (1 = normale)
const GROW = 0.07 // amplitude de la hauteur au sommet de la flamme (unités du modèle)
const GROW_FROM = 0.35 // fraction de la hauteur en dessous de laquelle la flamme ne change pas de hauteur (les sommets bas ne bougent pas en y)
const WAVE = 0.03 // amplitude de l'ondulation latérale au sommet
const GLOW = 3.5 // éclat de la flamme (> seuil du Bloom, voir DungeonBoard.tsx)

// Temps partagé par tous les feux, mis à jour une fois par image
const fireTime = { value: 0 }

// Orange / jaune vif = flamme. Le gris (peu saturé) est de la pierre, le brun (sombre) du bois.
function isFlameTexel(r: number, g: number, b: number) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const saturation = max ? (max - min) / max : 0
  return saturation >= 0.3 && max > 200 && g > 90
}

// Sépare l'index du mesh en deux : triangles de flamme / autres. Lit la texture une seule fois.
function splitFlame(mesh: THREE.Mesh) {
  const src = mesh.geometry as THREE.BufferGeometry
  const map = (mesh.material as THREE.MeshStandardMaterial).map!
  const image = map.image as CanvasImageSource & { width: number; height: number }
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(image, 0, 0)
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data

  const uv = src.attributes.uv
  const index = src.index!
  const flame: number[] = []
  const rest: number[] = []
  for (let t = 0; t < index.count; t += 3) {
    const a = index.getX(t)
    const b = index.getX(t + 1)
    const c = index.getX(t + 2)
    const u = (uv.getX(a) + uv.getX(b) + uv.getX(c)) / 3
    const v = (uv.getY(a) + uv.getY(b) + uv.getY(c)) / 3
    // glTF : l'origine des UV est en haut à gauche de l'image (flipY faux)
    const x = Math.min(canvas.width - 1, Math.max(0, Math.floor(u * canvas.width)))
    const y = Math.min(canvas.height - 1, Math.max(0, Math.floor(v * canvas.height)))
    const k = (y * canvas.width + x) * 4
    ;(isFlameTexel(pixels[k], pixels[k + 1], pixels[k + 2]) ? flame : rest).push(a, b, c)
  }
  const part = (indices: number[]) => {
    const g = new THREE.BufferGeometry()
    for (const name of Object.keys(src.attributes)) g.setAttribute(name, src.attributes[name])
    g.setIndex(indices)
    return g
  }
  return { flame: part(flame), rest: part(rest), map }
}

// Matériau de la flamme : texture d'origine surexposée (émissif, non touché par l'éclairage ni le tone mapping), sommets qui ondulent (le bas reste fixe).
function makeFlameMaterial(map: THREE.Texture, base: number, height: number) {
  const material = new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide, toneMapped: false, color: new THREE.Color().setScalar(GLOW) })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFireTime = fireTime
    shader.uniforms.uBase = { value: base }
    shader.uniforms.uHeight = { value: height }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uFireTime;
        uniform float uBase;
        uniform float uHeight;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        // 0 au pied, 1 à la pointe
        float fh = clamp((position.y - uBase) / uHeight, 0.0, 1.0);
        float fw = fh * fh; // balancement : de plus en plus fort vers le haut
        float ftop = smoothstep(${GROW_FROM.toFixed(2)}, 1.0, fh); // hauteur : seul le haut grossit / diminue, le bas ne bouge pas en y
        // déphasage selon la position du feu : deux feux ne dansent pas en même temps
        float fphase = modelMatrix[3].x * 3.1 + modelMatrix[3].z * 1.7;
        float t = uFireTime * ${SPEED.toFixed(2)} + fphase;
        // chaque sommet a sa phase (selon sa position) : la flamme ondule au lieu de pulser d'un bloc
        float vphase = position.x * 9.0 + position.z * 7.0;
        float grow = sin(t * 2.2 + vphase) * 0.6 + sin(t * 3.7 + vphase * 1.6 + 1.3) * 0.4;
        transformed.y += ftop * grow * ${GROW.toFixed(3)};
        // ondulation latérale : une vague qui monte le long de la flamme
        float wave = sin(t * 2.6 - fh * 5.0 + vphase * 0.5);
        float wave2 = sin(t * 1.7 - fh * 4.0 + 2.0 + vphase * 0.3);
        transformed.x += (wave * ${WAVE.toFixed(3)} + wave2 * 0.012) * fw;
        transformed.z += (wave2 * ${WAVE.toFixed(3)} + wave * 0.012) * fw;`,
      )
  }
  material.customProgramCacheKey = () => 'campfire-flame'
  return material
}

useGLTF.preload(URL)

let shared: ReturnType<typeof build> | undefined
function build(scene: THREE.Group) {
  let mesh: THREE.Mesh | undefined
  scene.traverse((o) => {
    if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh
  })
  const { flame, rest, map } = splitFlame(mesh!)
  const material = mesh!.material as THREE.Material
  const box = new THREE.Box3().setFromBufferAttribute(mesh!.geometry.attributes.position as THREE.BufferAttribute)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  return {
    flame,
    rest,
    material,
    flameMaterial: makeFlameMaterial(map, box.min.y, size.y),
    scale: LENGTH / Math.max(size.x, size.z),
    offset: new THREE.Vector3(-center.x, -box.min.y, -center.z), // centré sur la case, pierres au sol
  }
}

export default function CampfireModel() {
  const { scene } = useGLTF(URL)
  const model = useMemo(() => (shared ??= build(scene)), [scene])
  useFrame('Campfire.fire', ({ clock }) => {
    fireTime.value = clock.elapsedTime
  })
  return (
    <group scale={model.scale}>
      <group position={model.offset}>
        <mesh geometry={model.rest} material={model.material} castShadow receiveShadow frustumCulled={false} />
        {/* La flamme est une source de lumière : ni ombre portée, ni ombre reçue */}
        <mesh geometry={model.flame} material={model.flameMaterial} frustumCulled={false} />
      </group>
    </group>
  )
}

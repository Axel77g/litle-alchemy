// Vent dans le feuillage : le balancement est calculé dans le vertex shader (GPU), aucun coût JavaScript par arbre.
// On injecte le déplacement dans les matériaux standard de three.js (onBeforeCompile) : éclairage, ombres et bloom restent inchangés.
import * as THREE from 'three'

// Temps partagé par tous les arbres, mis à jour une fois par image (voir World.tsx)
export const windTime = { value: 0 }

const SWAY = 0.055 // amplitude du balancement (en cases) au sommet de l'arbre
const FLUTTER = 0.008 // petit frémissement rapide des feuilles

// Insère le déplacement juste après le calcul de la position locale du sommet.
// Le déplacement est calculé en cases puis divisé par l'échelle horizontale du modèle (le shader travaille dans le repère du modèle, avant la mise à l'échelle).
function addWind(base: number, height: number, scale: number) {
  return (shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uWindTime = windTime
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWindTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        // plus c'est haut, plus ça bouge (le pied du tronc reste fixe)
        float windH = clamp((position.y - ${base.toFixed(4)}) / ${height.toFixed(4)}, 0.0, 1.0) * 1.2;
        // déphasage selon la position de l'arbre : tous ne se balancent pas en même temps
        float windPhase = modelMatrix[3].x * 1.7 + modelMatrix[3].z * 2.3;
        float sway = sin(uWindTime * 1.8 + windPhase) * 0.6 + sin(uWindTime * 3.1 + windPhase * 1.7) * 0.4;
        vec3 wp = position * ${scale.toFixed(4)};
        float flutter = sin(uWindTime * 7.0 + wp.x * 9.0 + wp.y * 11.0 + wp.z * 9.0 + windPhase);
        transformed.x += (sway * ${SWAY.toFixed(3)} + flutter * ${FLUTTER.toFixed(3)}) * windH / ${scale.toFixed(4)};
        transformed.z += (sway * ${(SWAY * 0.6).toFixed(3)} + flutter * ${FLUTTER.toFixed(3)}) * windH / ${scale.toFixed(4)};`,
      )
  }
}

// Matériau d'un modèle d'arbre (copie du matériau du .glb : texture, double face) qui bouge dans le vent, et le matériau de profondeur correspondant :
// l'ombre doit se balancer avec le feuillage, la shadow map l'utilise à la place du standard.
// `base` / `height` : bas et hauteur du modèle (repère du modèle), `scale` : échelle horizontale (x, z) appliquée ensuite au modèle.
export function makeWindMaterials(source: THREE.Material, base: number, height: number, scale: number) {
  const key = `wind:${base}:${height}:${scale}`
  const material = source.clone()
  material.onBeforeCompile = addWind(base, height, scale)
  material.customProgramCacheKey = () => key
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })
  depth.onBeforeCompile = addWind(base, height, scale)
  depth.customProgramCacheKey = () => `${key}:depth`
  return { material, depth }
}

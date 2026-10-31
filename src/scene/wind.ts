// Vent dans le feuillage : le balancement est calculé dans le vertex shader (GPU), aucun coût JavaScript par arbre.
// On injecte le déplacement dans les matériaux standard de three.js (onBeforeCompile) : éclairage, ombres et bloom restent inchangés.
import * as THREE from 'three'

// Temps partagé par tous les arbres, mis à jour une fois par image (voir World.tsx)
export const windTime = { value: 0 }

const SWAY = 0.055 // amplitude du balancement (en cases) au sommet de l'arbre
const FLUTTER = 0.008 // petit frémissement rapide des feuilles

// Insère le déplacement juste après le calcul de la position locale du sommet
function addWind(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.uniforms.uWindTime = windTime
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nuniform float uWindTime;')
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      // plus c'est haut, plus ça bouge (le pied de l'arbre reste fixe)
      float windH = clamp((modelMatrix[3].y + position.y) * 0.8, 0.0, 1.2);
      // déphasage selon la position de l'arbre : tous ne se balancent pas en même temps
      float windPhase = modelMatrix[3].x * 1.7 + modelMatrix[3].z * 2.3;
      float sway = sin(uWindTime * 1.8 + windPhase) * 0.6 + sin(uWindTime * 3.1 + windPhase * 1.7) * 0.4;
      float flutter = sin(uWindTime * 7.0 + position.x * 9.0 + position.y * 11.0 + position.z * 9.0 + windPhase);
      transformed.x += (sway * ${SWAY.toFixed(3)} + flutter * ${FLUTTER.toFixed(3)}) * windH;
      transformed.z += (sway * ${(SWAY * 0.6).toFixed(3)} + flutter * ${FLUTTER.toFixed(3)}) * windH;`,
    )
}

// Arbre entier (tronc + feuillage, fusionnés : voir merged.ts) : un seul matériau partagé par tous les arbres, couleurs dans les sommets.
// Le balancement dépend de la hauteur : le pied du tronc reste fixe et le haut suit le feuillage.
export const foliageMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, shadowSide: THREE.DoubleSide })
foliageMaterial.onBeforeCompile = addWind
foliageMaterial.customProgramCacheKey = () => 'foliage-wind'

// L'ombre doit se balancer avec le feuillage : la shadow map utilise ce matériau de profondeur à la place du standard
export const foliageDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })
foliageDepthMaterial.onBeforeCompile = addWind
foliageDepthMaterial.customProgramCacheKey = () => 'foliage-wind-depth'

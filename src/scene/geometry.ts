// Géométries partagées par toutes les cases : une seule géométrie en mémoire au lieu d'une par case.
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { TILE } from './constants'

const SEGMENTS = 2 // finesse des arrondis : 2 suffit à cette échelle (4 coûtait ~3× plus de triangles)
const RADIUS = 0.02 // petit : un grand arrondi creuse une rainure visible à chaque joint entre deux cases

export const DIRT_HEIGHT = 0.65
export const GRASS_HEIGHT = 0.2

export const dirtGeometry = new RoundedBoxGeometry(TILE, DIRT_HEIGHT, TILE, SEGMENTS, RADIUS)
export const grassGeometry = new RoundedBoxGeometry(TILE, GRASS_HEIGHT, TILE, SEGMENTS, RADIUS)

// Pont scène 3D -> écran : la scène enregistre ici sa fonction de projection, les FX en DOM (coquillages volants) s'en servent
// pour partir de la position à l'écran d'un producteur.
type Projector = (x: number, z: number, height: number) => { x: number; y: number } | null
let projector: Projector = () => null
export const setProjector = (fn: Projector) => void (projector = fn)
export const projectCell: Projector = (x, z, h) => projector(x, z, h)

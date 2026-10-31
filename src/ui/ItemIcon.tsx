import type { ItemDef } from '../engine/items'
import { useIcons } from './IconStudio'

// Contour blanc « sticker » (4 ombres décalées) + ombre portée dure : le look des cartes Clash Royale
const STICKER =
  'drop-shadow(2px 0 0 #fff) drop-shadow(-2px 0 0 #fff) drop-shadow(0 2px 0 #fff) drop-shadow(0 -2px 0 #fff) drop-shadow(0 3px 0 rgba(0,0,0,0.35))'

// Icône d'un item : rendu 3D de son modèle voxel (voir IconStudio), sinon l'emoji de secours.
// `sticker` ajoute le contour blanc ; `size` est la taille en px ; `className` s'applique à l'emoji de secours ET à l'image.
export default function ItemIcon({ def, size, sticker = true, className = '', style }: { def: ItemDef; size: number; sticker?: boolean; className?: string; style?: React.CSSProperties }) {
  const url = useIcons((s) => s.urls[def.id])
  if (!url) return <span className={`leading-none ${className}`} style={{ fontSize: size * 0.85, ...style }}>{def.icon}</span>
  return <img src={url} alt="" draggable={false} width={size} height={size} className={`pointer-events-none select-none ${className}`} style={{ filter: sticker ? STICKER : undefined, ...style }} />
}

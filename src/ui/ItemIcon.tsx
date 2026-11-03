import type { ItemDef } from '../engine/items'
import { STICKER_MARGIN, STICKER_SCALE, useIcons } from './IconStudio'

// Contour blanc « sticker » (4 ombres décalées) + ombre portée dure : le look des cartes Clash Royale.
// En secours seulement, le temps que l'icône cuite soit prête (voir IconStudio) : un `filter` est recalculé par le navigateur dès que l'image bouge.
const STICKER =
  'drop-shadow(2px 0 0 #fff) drop-shadow(-2px 0 0 #fff) drop-shadow(0 2px 0 #fff) drop-shadow(0 -2px 0 #fff) drop-shadow(0 3px 0 rgba(0,0,0,0.35))'

// Icône d'un item : rendu 3D de son modèle voxel (voir IconStudio), sinon l'emoji de secours.
// `sticker` ajoute le contour blanc ; `silhouette` la remplace par une forme noire ; `size` est la taille en px ; `className` s'applique à l'emoji de secours ET à l'image.
export default function ItemIcon({ def, size, sticker = true, silhouette = false, className = '', style }: { def: ItemDef; size: number; sticker?: boolean; silhouette?: boolean; className?: string; style?: React.CSSProperties }) {
  const url = useIcons((s) => s.urls[def.id])
  const baked = useIcons((s) => (silhouette ? s.silhouettes[def.id] : sticker ? s.stickers[def.id] : undefined))
  if (!url) return <span className={`leading-none ${className}`} style={{ fontSize: size * 0.85, ...style }}>{def.icon}</span>
  const cls = `pointer-events-none select-none ${className}`
  // Image cuite pour le contour : plus grande que l'icône, ramenée à la même place par une marge négative (silhouette : même taille que l'icône)
  if (baked && sticker && !silhouette) {
    const px = Math.round(size * STICKER_SCALE * 100) / 100
    return <img src={baked} alt="" draggable={false} width={px} height={px} className={cls} style={{ margin: -size * STICKER_MARGIN, ...style }} />
  }
  if (baked) return <img src={baked} alt="" draggable={false} width={size} height={size} className={cls} style={style} />
  return <img src={url} alt="" draggable={false} width={size} height={size} className={cls} style={{ filter: silhouette ? 'brightness(0)' : sticker ? STICKER : undefined, ...style }} />
}

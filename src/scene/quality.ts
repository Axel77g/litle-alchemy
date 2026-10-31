// Niveaux de qualité graphique. Le coût d'une image dépend surtout du NOMBRE DE PIXELS rendus × le nombre d'effets plein écran
// (occlusion ambiante, MSAA, flou, bloom). Un Mac Retina rend ~4× plus de pixels qu'un iPhone : on plafonne donc
// la résolution par un budget de pixels, et on baisse automatiquement de niveau si les fps chutent (PerformanceMonitor).
import { useEffect, useState } from 'react'
import { create } from 'zustand'

export type Tier = 'low' | 'medium' | 'high'
export const TIER_ORDER: Tier[] = ['low', 'medium', 'high']

export interface QualitySettings {
  pixelBudget: number // nombre max de pixels rendus
  msaa: number // anti-aliasing du post-processing (0 = aucun)
  ao: { quality: 'performance' | 'low' | 'medium'; halfRes: boolean } | null // occlusion ambiante N8AO
  tiltShift: boolean
  shadowMap: number // taille de la shadow map
  contactShadows: boolean
}

export const TIERS: Record<Tier, QualitySettings> = {
  low: { pixelBudget: 1.0e6, msaa: 0, ao: { quality: 'performance', halfRes: true }, tiltShift: false, shadowMap: 1024, contactShadows: false },
  medium: { pixelBudget: 2.2e6, msaa: 0, ao: { quality: 'low', halfRes: true }, tiltShift: true, shadowMap: 1024, contactShadows: true },
  high: { pixelBudget: 5.0e6, msaa: 4, ao: { quality: 'medium', halfRes: false }, tiltShift: true, shadowMap: 2048, contactShadows: true },
}

// ?auto=0 désactive la baisse automatique de qualité (utile pour comparer les niveaux entre eux)
export const AUTO_QUALITY = new URLSearchParams(location.search).get('auto') !== '0'

const fromUrl = (): Tier => {
  const q = new URLSearchParams(location.search).get('quality')
  if (TIER_ORDER.includes(q as Tier)) return q as Tier
  // Écran tactile (téléphone / tablette) : GPU plus faible et batterie en jeu -> niveau bas par défaut
  return window.matchMedia('(pointer: coarse)').matches ? 'low' : 'medium'
}

interface QualityState {
  tier: Tier
  setTier(tier: Tier): void
  step(delta: -1 | 1): void
}

export const useQuality = create<QualityState>((set, get) => ({
  tier: fromUrl(),
  setTier: (tier) => set({ tier }),
  step: (delta) => {
    const i = TIER_ORDER.indexOf(get().tier) + delta
    set({ tier: TIER_ORDER[Math.max(0, Math.min(TIER_ORDER.length - 1, i))] })
  },
}))

// Résolution de rendu : on prend le ratio natif de l'écran, mais jamais plus que ce que le budget de pixels permet
export function useDpr(pixelBudget: number): number {
  const compute = () => {
    const cssPixels = window.innerWidth * window.innerHeight
    return Math.max(0.75, Math.min(window.devicePixelRatio, 2, Math.sqrt(pixelBudget / cssPixels)))
  }
  const [dpr, setDpr] = useState(compute)
  useEffect(() => {
    const onResize = () => setDpr(compute())
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [pixelBudget]) // eslint-disable-line react-hooks/exhaustive-deps
  return dpr
}

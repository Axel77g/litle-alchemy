// Pubs récompensées : toujours facultatives, le joueur les lance lui-même pour obtenir un bonus.
// Le jeu n'utilise que ce fichier ; chaque plateforme est un adaptateur (types.ts) choisi ici.
// Fournisseur : VITE_AD_PROVIDER=mock|crazygames|none (défaut crazygames ; none pour les builds natifs) ; ?ads=mock dans l'URL pour tester sans SDK (ex : avec un bloqueur de pub).
import { useSyncExternalStore } from 'react'
import { setMuted, isMuted } from '../xe'
import { crazyGamesAdapter } from './crazygames'
import { mockAdapter } from './mock'
import { noneAdapter } from './none'
import type { AdAdapter, AdResult } from './types'

export type { AdAdapter, AdResult } from './types'

const ADAPTERS: Record<string, AdAdapter> = { crazygames: crazyGamesAdapter, mock: mockAdapter, none: noneAdapter }
const choice = new URLSearchParams(location.search).get('ads') ?? import.meta.env.VITE_AD_PROVIDER ?? 'crazygames'
const adapter = ADAPTERS[choice] ?? crazyGamesAdapter

let available = false
const listeners = new Set<() => void>()

// À appeler une fois au démarrage : charge le SDK sans bloquer le jeu
export function initAds() {
  void adapter.init().then((ok) => {
    available = ok
    listeners.forEach((l) => l())
  })
}

// Vrai quand une pub peut être proposée : le bouton n'apparaît que si elle marchera
export const useAdAvailable = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => void listeners.delete(l)),
    () => available,
  )

// Lance une pub récompensée (son coupé pendant sa durée) ; `rewarded` seulement si le joueur est allé au bout
export async function watchRewardedAd(): Promise<AdResult> {
  const wasMuted = isMuted()
  const restore = () => setMuted(wasMuted, false)
  try {
    return await adapter.showRewarded({ onStart: () => setMuted(true, false), onEnd: restore })
  } catch {
    return 'error'
  } finally {
    restore()
  }
}

import type { AdAdapter, AdResult } from './types'

// Aucune pub : pour les builds natifs (Electron, Capacitor) tant qu'aucun fournisseur n'y est branché.
// `init` renvoie false : le jeu ne propose alors jamais le bouton « ×2 » (voir useAdAvailable).
export const noneAdapter: AdAdapter = {
  name: 'none',
  init: async () => false,
  showRewarded: async (): Promise<AdResult> => 'unavailable',
}

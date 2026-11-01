import type { AdAdapter, AdHooks, AdResult } from './types'

// SDK v3 de CrazyGames : https://docs.crazygames.com/sdk/html5-v3/
const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js'

interface CrazySdk {
  init(): Promise<void>
  environment: 'crazygames' | 'local' | 'disabled'
  ad: {
    hasAdblock?(): Promise<boolean>
    requestAd(type: 'midgame' | 'rewarded', callbacks: { adStarted(): void; adFinished(): void; adError(error: unknown): void }): void
  }
}

const sdk = () => (window as unknown as { CrazyGames?: { SDK: CrazySdk } }).CrazyGames?.SDK

const loadScript = () =>
  new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SDK_URL
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('SDK CrazyGames bloqué ou injoignable')) // typiquement un bloqueur de pub
    document.head.append(script)
  })

export const crazyGamesAdapter: AdAdapter = {
  name: 'crazygames',
  async init() {
    try {
      await loadScript()
      const s = sdk()
      if (!s) return false
      await s.init()
      // 'disabled' : le jeu tourne hors de CrazyGames (ni domaine officiel, ni localhost) : pas de pub
      return s.environment !== 'disabled' && !(await s.ad.hasAdblock?.())
    } catch {
      return false
    }
  },
  showRewarded({ onStart, onEnd }: AdHooks) {
    const s = sdk()
    if (!s) return Promise.resolve<AdResult>('unavailable')
    return new Promise<AdResult>((resolve) => {
      const finish = (result: AdResult) => {
        onEnd()
        resolve(result)
      }
      s.ad.requestAd('rewarded', {
        adStarted: onStart,
        adFinished: () => finish('rewarded'),
        adError: () => finish('error'),
      })
    })
  },
}

import type { AdAdapter, AdHooks, AdResult } from './types'

const DURATION = 3

// Fournisseur de développement : une fausse pub plein écran avec compte à rebours, qui réussit toujours
export const mockAdapter: AdAdapter = {
  name: 'mock',
  init: async () => true,
  showRewarded({ onStart, onEnd }: AdHooks) {
    return new Promise<AdResult>((resolve) => {
      const overlay = document.createElement('div')
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:#000;color:#fff;font:600 20px system-ui;text-align:center'
      document.body.append(overlay)
      onStart()
      let left = DURATION
      const render = () => (overlay.textContent = `Fausse pub (dev) · ${left}s`)
      render()
      const timer = setInterval(() => {
        if (--left > 0) return render()
        clearInterval(timer)
        overlay.remove()
        onEnd()
        resolve('rewarded')
      }, 1000)
    })
  },
}

import type { CapacitorConfig } from '@capacitor/cli'

// Coque Capacitor : embarque le build du jeu (npm run build:capacitor, à la racine) dans une WebView Android / iOS.
const config: CapacitorConfig = {
  appId: 'fr.realityacademy.litlealchmimy',
  appName: 'Little Alchemy',
  webDir: '../../dist-capacitor',
  backgroundColor: '#140a04', // évite le flash blanc avant le premier rendu
  server: {
    androidScheme: 'https', // origine stable (https://localhost) : le localStorage (la sauvegarde) survit aux mises à jour
  },
}

export default config

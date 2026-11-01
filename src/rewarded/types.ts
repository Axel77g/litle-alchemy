// Contrat commun des fournisseurs de pub récompensée (CrazyGames, Poki, AdMob, mock…) : le jeu ne parle qu'à cette interface.
export type AdResult =
  | 'rewarded' // le joueur est allé au bout : récompense due
  | 'unavailable' // pas de pub possible (bloqueur, SDK absent, plateforme hors ligne) : aucune récompense
  | 'error' // la pub a échoué en cours de route (pas de fill, erreur réseau) : aucune récompense

export interface AdHooks {
  onStart(): void // la pub prend l'écran : couper le son
  onEnd(): void // elle rend la main : le remettre
}

export interface AdAdapter {
  readonly name: string
  init(): Promise<boolean> // charge le SDK ; true si des pubs peuvent être montrées
  showRewarded(hooks: AdHooks): Promise<AdResult>
}

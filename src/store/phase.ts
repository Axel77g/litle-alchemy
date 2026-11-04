// Phase de la session : une seule source de vérité pour « le temps passe-t-il ? » et « a-t-on le droit de sauvegarder ? ».
//  - home     : écran d'accueil (jeu figé, autosave coupée)
//  - intro    : mot d'introduction avant « C'est parti ! » (jeu figé, autosave coupée : une partie neuve écrite trop tôt ferait sauter l'introduction au prochain chargement)
//  - guided   : étape du tutoriel qui demande au joueur d'agir (jeu figé, sauvegarde permise)
//  - playing  : la simulation tourne
// La phase est calculée par session/gate.ts à partir de l'interface et du tutoriel ; ce module ne connaît ni l'un ni l'autre.
export type Phase = 'home' | 'intro' | 'guided' | 'playing'

// `guidedStep` : une étape du tutoriel est en cours ET demande au joueur d'agir (les étapes où la production doit tourner ne comptent pas)
export function computePhase(homeOpen: boolean, intro: boolean, guidedStep: boolean): Phase {
  if (homeOpen) return 'home'
  if (intro) return 'intro'
  return guidedStep ? 'guided' : 'playing'
}

let phase: Phase = 'playing'
export const getPhase = () => phase
export const setPhase = (next: Phase) => void (phase = next)

// Pause de diagnostic (dashboard /__perf) : indépendante de la phase, pour ne pas être levée par erreur par le tutoriel
let simPaused = false
export const setSimPaused = (value: boolean) => void (simPaused = value)

export const isFrozen = () => phase !== 'playing' || simPaused
export const isSaveBlocked = () => phase === 'home' || phase === 'intro'

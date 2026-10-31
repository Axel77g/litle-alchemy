// Petite vibration (Android / navigateurs qui la supportent ; ignorée ailleurs, comme sur iOS)
export const haptic = (ms = 8) => {
  try {
    // Les navigateurs bloquent la vibration tant que l'utilisateur n'a pas touché la page
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return
    navigator.vibrate?.(ms)
  } catch {
    /* pas de vibration disponible */
  }
}

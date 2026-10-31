// Rattrapage d'une absence : l'île produit pendant que le joueur n'est pas là, mais moins vite que s'il jouait,
// sinon la meilleure stratégie serait de fermer le jeu (« ouvrir, acheter, fermer »).
export const OFFLINE_CAP = 8 * 3600 // au-delà, l'absence ne rapporte plus rien
export const OFFLINE_EFFICIENCY = 0.5 // part du revenu normal gagnée pendant l'absence
export const OFFLINE_GRACE = 60 // un trou plus court (onglet en arrière-plan, mise en veille brève) compte plein tarif

// `real` : durée prise en compte (plafonnée) ; `effective` : durée de production à simuler.
export function catchUp(elapsed: number): { real: number; effective: number } {
  const real = Math.min(Math.max(elapsed, 0), OFFLINE_CAP)
  const effective = real <= OFFLINE_GRACE ? real : OFFLINE_GRACE + (real - OFFLINE_GRACE) * OFFLINE_EFFICIENCY
  return { real, effective }
}

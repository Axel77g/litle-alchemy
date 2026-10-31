// Accès aux contrôles de la caméra depuis l'interface : le glisser d'un personnage doit couper le déplacement de la vue
// (de façon synchrone, sans attendre un re-rendu React).
export const cameraControl: { current: { enabled: boolean; target: { x: number; y: number; z: number } } | null } = { current: null }

import { create } from 'zustand'

// État de l'autopilote (lu par la pastille de l'écran). Quitter = recharger la page : la vraie sauvegarde n'a jamais été touchée.
export const useAutoplay = create<{ active: boolean; speed: number }>(() => ({ active: false, speed: 10 }))

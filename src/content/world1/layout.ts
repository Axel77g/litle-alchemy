import type { World1ItemId } from './items'

// Le monde est décrit par deux grilles de même taille, indexées [z][x] (ligne, colonne).
// Pour agrandir le monde : ajoute des lignes / colonnes. Tout le reste se place tout seul.

// Niveau 0 : le sol. 1 = bloc d'herbe, 2 = bloc d'eau (il produit de l'eau, rien ne se pose dessus), 0 = vide
export const ground: number[][] = [
  [0, 0, 1, 1, 1, 0, 0],
  [0, 1, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 2, 1, 1, 1],
  [0, 0, 1, 1, 1, 1, 0],
]

// Niveau 1 : les producteurs posés sur le sol. null = rien, sinon l'id d'un item de world1Items (items.ts).
// Ces tableaux ne servent qu'à construire le monde au départ (createWorld dans engine/grid.ts).
export const objects: (World1ItemId | null)[][] = [
  [null, null, null, 'bush', null, null, null],
  [null, 'rock_deposit', null, null, null, 'bush', null],
  [null, null, 'cro_magnon', 'campfire', null, null, null],
  [null, null, 'bush', null, null, 'rock_deposit', null],
  [null, null, null, null, 'mud_puddle', null, null],
  [null, null, null, null, 'rock_deposit', null, null],
]

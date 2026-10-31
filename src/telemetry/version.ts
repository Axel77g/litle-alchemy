// Empreinte des données d'équilibrage du monde : elle change automatiquement dès qu'un item, une recette, une durée ou un seuil change.
// Chaque partie enregistrée la porte : on compare ainsi les joueurs d'avant et d'après un réglage, sans rien à penser à incrémenter.
import { world1 } from '../content/world1'

export function balanceVersion(): string {
  const json = JSON.stringify(world1, (key, value) => (key === 'recipeIndex' ? undefined : value))
  let h = 0x811c9dc5 // FNV-1a 32 bits
  for (let i = 0; i < json.length; i++) h = Math.imul(h ^ json.charCodeAt(i), 0x01000193) >>> 0
  return h.toString(16).padStart(8, '0')
}

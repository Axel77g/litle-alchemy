// LE fichier à éditer pour brancher tes sons. Données seulement : aucune logique ici.
//
// Dépose tes fichiers dans public/audio/ (.ogg ou .mp3) et écris leur chemin RELATIF à public/audio/, ex : 'sfx/shell-1.ogg'.
// - `files` vide  -> le son reste muet (le jeu marche sans aucun fichier).
// - plusieurs `files` -> une variante au hasard à chaque lecture (jamais deux fois la même d'affilée).
// - un fichier manquant ou illisible est ignoré (avertissement dans la console).

export type SfxKey =
  | 'shell' | 'stone' | 'stick' | 'mud' | 'meat' | 'heat' | 'pop'
  | 'place' | 'tile' | 'remove' | 'discovered' | 'dockFull' | 'victory'
  | 'grab' | 'release' | 'hover' | 'merge' | 'success' | 'sell' | 'anvil' | 'axe'

export interface SoundDef {
  files: string[]
  volume?: number // 1 = tel quel (défaut). Pour égaliser un fichier trop fort ou trop faible.
  pitchJitter?: number // variation aléatoire de hauteur, 0.05 = ±5 % (défaut 0.05, 0 = aucune)
  minGapMs?: number // délai minimal entre deux lectures de ce son (évite les rafales)
  choke?: boolean // une nouvelle lecture coupe en fondu la précédente (sons courts répétés très vite : le dernier est toujours audible)
}

const POPS = ['sfx/pop1.mp3', 'sfx/pop2.mp3', 'sfx/pop3.mp3'] // une variante au hasard à chaque lecture

// --- 1. Sons ponctuels (réagissent aux événements du jeu) ------------------------------------
export const SFX: Record<SfxKey, SoundDef> = {
  shell: { files: [], minGapMs: 700 }, //          un producteur de coquillages produit
  stone: { files: [], minGapMs: 1200 }, //         sort : Caillou / Caillou bizarre
  stick: { files: [], minGapMs: 1200 }, //         sort : Bâton
  mud: { files: [], minGapMs: 1200 }, //           sort : Boue
  meat: { files: [], minGapMs: 1200 }, //          sort : Viande crue
  heat: { files: [], minGapMs: 1200 }, //          sort : Chaleur
  pop: { files: [], minGapMs: 1200 }, //           sort : tout autre item
  place: { files: ['sfx/ground.mp3'], minGapMs: 150 }, //            un objet posé ou déplacé touche le sol
  tile: { files: ['sfx/ground_heavy.mp3'], minGapMs: 80 }, //        une case achetée atterrit
  remove: { files: [], minGapMs: 80 }, //          un objet est repris
  discovered: { files: [], minGapMs: 300 }, //     premier exemplaire d'un item
  dockFull: { files: [], minGapMs: 1500 }, //      dock plein
  victory: { files: [], minGapMs: 0 }, //          fin du monde
  grab: { files: POPS, choke: true }, //                        le joueur saisit un item (carte du dock ou producteur de l'île)
  release: { files: POPS, choke: true }, //                     il le relâche, où que ce soit (fusion, pose, déplacement...)
  hover: { files: ["sfx/hover.mp3"], minGapMs: 30, choke: true ,volume: 0.5}, //         une carte glissée survole une autre carte du dock
  merge: { files: ['sfx/merge.mp3'] }, //          au relâcher d'une fusion
  sell: { files: ['sfx/sell.mp3'] }, //            vente de cartes, et achat d'une case (même bruit de caisse)
  anvil: { files: ['sfx/anvil.mp3'], minGapMs: 200, volume: 0.45 }, //          on entre en mode travaux : enclume...
  axe: { files: ['sfx/axe.mp3'], minGapMs: 200, volume: 0.45 }, //              ... puis hache, un instant après (voir BUILD_AXE_DELAY_MS)
  success: { files: ['sfx/success.mp3'] }, //      juste après : la fusion est terminée (voir MERGE_SUCCESS_DELAY_MS)
}

// Délai entre le son `anvil` et le son `axe` à l'entrée en mode travaux : décalés pour qu'on entende les deux coups
export const BUILD_AXE_DELAY_MS = 140

// Délai entre le son `merge` (au relâcher) et le son `success`
export const MERGE_SUCCESS_DELAY_MS = 150

// Quel son joue une production, selon l'item produit (absent = 'pop'). 'shell' = les coquillages.
export const PRODUCE_SOUND: Record<string, SfxKey> = {
  shell: 'shell',
  stone: 'stone',
  ochre: 'stone',
  log: 'stick',
  seed: 'stick',
  wheat: 'stick',
  water: 'mud',
  clay: 'mud',
  stick: 'stick',
  mud: 'mud',
  raw_meat: 'meat',
  heat: 'heat',
}

// --- 2. Ambiances : liées à la PRÉSENCE d'un producteur sur l'île (clé = id d'item) ------------
// strikes : un son répété à intervalle aléatoire (pioche, hache...) · loop : un fichier en boucle (feu...)
// Plusieurs exemplaires du même item ne multiplient pas les sons : le volume et la cadence montent doucement (log).
export interface AmbienceDef extends SoundDef {
  mode: 'strikes' | 'loop'
  interval?: [number, number] // strikes : secondes min/max entre deux coups
  always?: boolean // true = ambiance du monde (vent, grillons...) : la clé n'est PAS un id d'item, rien à poser sur l'île
  when?: 'day' | 'night' // absent = tout le temps (les ouvriers rentrent chez eux la nuit)
}

export const AMBIENCE: Record<string, AmbienceDef> = {
  miner: { mode: 'strikes', files: ['ambience/mining.mp3'], interval: [1.2, 3.5], volume: 0.05, when: 'day' },
  lumberjack: { mode: 'strikes', files: ["ambience/axe.mp3"], interval: [1.5, 4], volume: 0.05, when: 'day' },
  campfire: { mode: 'loop', files: ["ambience/campfire.mp3"], volume: 0.2 },
  night: { mode: 'loop', always: true, files: ['ambience/night.mp3'], volume: 0.05, when: 'night' },
  back: { mode: 'loop', always: true, files: ['ambience/back.mp3'], volume: 0.05, when: 'day' },
}

// --- 3. Musique : une ou plusieurs pistes (en boucle si une seule, sinon à la suite) ------------
export const MUSIC = {
  tracks: [
    "music/01.mp3",
  ] as string[], // ex : ['music/theme.ogg']
  volume: 1, // relatif aux effets
  nightVolume: 1, // multiplicateur de volume la nuit (1 = inchangé)
}

// Monde 1 : l'Âge de Pierre. Données seulement : aucune logique ici.
import { defineItems, type Recipe } from '../../engine/items'
import type { Finale } from '../../engine/finale'

export const world1Items = defineItems({
  // Matières premières (dock)
  stone: { name: 'Caillou', desc: "Un caillou. Il ne fait pas grand-chose, mais il le fait avec conviction. Deux cailloux qui se frottent, c'est déjà une soirée.", icon: '🪨', kind: 'material', model: 'stone', tier: 1, sellValue: 1 },
  stick: { name: 'Bâton', desc: "Le meilleur ami du Cro-Magnon. Sert à tout : taper, gratter, pointer, et se donner l'air occupé.", icon: '🪵', kind: 'material', model: 'stick', tier: 1, sellValue: 1 },
  mud: { name: 'Boue', desc: 'Marron, collante, légèrement suspecte. Les Cro-Magnons adorent. Personne ne sait pourquoi.', icon: '🟤', kind: 'material', model: 'mud', tier: 1, sellValue: 1 },
  // Produite par les blocs d'eau. Posée sur une case d'herbe vide : elle devient un bloc d'eau (qui produit de l'eau et arrose les champs voisins)
  water: { name: 'Eau', desc: "Mouillée. C'est son seul talent, mais quel talent. Posée sur de l'herbe vide, elle la transforme en mare.", icon: '💧', kind: 'material', model: 'water', tier: 1, sellValue: 1, flood: true },
  clay: { name: 'Argile', desc: "De la boue qui a fait des études. Prête à cuire pour devenir quelqu'un de bien.", icon: '🟠', kind: 'material', model: 'clay', tier: 2, sellValue: 3 },
  seed: { name: 'Graines', desc: "Minuscule, mais pleine de rêves de grandeur. Donne-lui de l'eau et un peu d'amour.", icon: '🌱', kind: 'material', model: 'seed', tier: 1, sellValue: 1 },
  log: { name: 'Tronc', desc: "Un bûcheron l'a eu. Gros, lourd, parfait pour rouler. Les idées de génie sont en route.", icon: '🌲', kind: 'material', model: 'log', tier: 2, sellValue: 3 },
  flint_tool: { name: 'Outil en Silex', desc: "Le couteau suisse de l'Âge de Pierre. Coupe, perce, impressionne les voisins. Transforme un Cro-Magnon en Chasseur.", icon: '🗡️', kind: 'material', model: 'flint_tool', tier: 1, sellValue: 3 },
  spark: { name: 'Étincelle', desc: "Un petit éclair de génie. Un peu de bois dessus et c'est la fête : bienvenue, Feu de Camp !", icon: '✨', kind: 'material', model: 'spark', tier: 3, sellValue: 2 },
  raw_meat: { name: 'Viande crue', desc: 'Ça sent fort et ça rapporte gros. Attention, un loup rôde peut-être pas loin. Ou deux.', icon: '🥩', kind: 'material', model: 'raw_meat', tier: 2, sellValue: 10 },
  // Donné à un Chasseur ou à un Mineur : frénésie (×3 vitesse) pendant 60 s
  grilled_steak: { name: 'Steak grillé', desc: 'Le plat préféré des gros bras. Un Chasseur ou un Mineur qui en croque se met en mode turbo (×3) pendant 60 s !', icon: '🍖', kind: 'material', model: 'grilled_steak', tier: 3, sellValue: 50, frenzy: { duration: 60, targetTag: 'hungry' } },
  wolf: { name: 'Loup sauvage', desc: 'Il hurle à la lune et mendie du steak. Avec un Cro-Magnon et un peu de patience, il deviendra un très bon garçon.', icon: '🐺', kind: 'material', model: 'wolf', tier: 4, sellValue: 12 },
  ochre: { name: 'Ocre', desc: 'Le pigment rouge des grands artistes. Offre-le à un Cro-Magnon : il se prend pour Picasso.', icon: '🟥', kind: 'material', model: 'ochre', tier: 4, sellValue: 15 }, // le pigment des peintures rupestres
  pot: { name: 'Poterie', desc: 'De la boue qui a connu le feu. Résultat : un pot solide, très fier de lui. Idéal pour garder le blé au frais.', icon: '🏺', kind: 'material', model: 'pot', tier: 3, sellValue: 8 }, // de la boue cuite

  // Agriculture : Graines + Eau -> Champ -> Blé -> Farine -> Pâte -> Pain
  wheat: { name: 'Blé', desc: 'Doré, croquant, plein de potentiel. Farine, vache ou grenier : le blé sait tout faire.', icon: '🌾', kind: 'material', model: 'wheat', tier: 2, sellValue: 2 },
  flour: { name: 'Farine', desc: "Du blé qui s'est pris un caillou sur la tête. Il en est sorti tout blanc, et un peu poussiéreux.", icon: '🧂', kind: 'material', model: 'flour', tier: 3, sellValue: 4 },
  dough: { name: 'Pâte', desc: "Molle, collante, de bonne humeur. Un petit tour au chaud et elle devient quelqu'un.", icon: '🫓', kind: 'material', model: 'dough', tier: 3, sellValue: 6 },
  // Donné à n'importe quel ouvrier : frénésie (×3 vitesse) pendant 30 s
  bread: { name: 'Pain', desc: "Chaud, croustillant, irrésistible. N'importe quel ouvrier qui en mange bosse ×3 plus vite pendant 30 s !", icon: '🍞', kind: 'material', model: 'bread', tier: 4, sellValue: 25, frenzy: { duration: 30, targetTag: 'worker' } },

  // Élevage : Laine -> Tissu
  wool: { name: 'Laine', desc: 'Doux, bouclé, légèrement mouton. Deux tas de laine et un peu de patience : voilà du tissu.', icon: '🧶', kind: 'material', model: 'wool', tier: 3, sellValue: 4 },
  cloth: { name: 'Tissu', desc: 'Du tissu ! Les Cro-Magnons les plus stylés se découvrent une vocation de Chaman.', icon: '🧵', kind: 'material', model: 'cloth', tier: 4, sellValue: 12 },

  // Bétail : la Vache donne du Lait et du Cuir
  // Donné à un animal : frénésie (×3 vitesse) pendant 30 s
  milk: { name: 'Lait', desc: 'Frais du jour, directement de la vache. Offre-le à un animal : il se met à courir partout (×3 pendant 30 s).', icon: '🥛', kind: 'material', model: 'milk', tier: 3, sellValue: 6, frenzy: { duration: 30, targetTag: 'animal' } },
  leather: { name: 'Cuir', desc: 'La peau de la vache, mais en mieux. Tendue sur un tronc, ça fait un tambour du tonnerre.', icon: '🟫', kind: 'material', model: 'leather', tier: 3, sellValue: 8 },

  // La roue
  wheel: { name: 'Roue', desc: 'LA grande invention. Ronde, pratique, et ça roule tout seul. Deux roues et un tronc, et on invente la Charrette.', icon: '⭕', kind: 'material', model: 'wheel', tier: 4, sellValue: 15 },

  // Catalyseurs (dock) : transforment un autre item
  heat: { name: 'Chaleur', desc: "Chaud devant ! Cuit la viande, la pâte et l'argile. Ne la serre pas dans tes bras.", icon: '🔥', kind: 'catalyst', model: 'heat', tier: 3, sellValue: 3 },

  // Producteurs (posés sur le plateau)
  rock_deposit: {
    name: 'Rocher',
    desc: 'Un gros caillou qui fait des petits cailloux. Il ne bouge pas, il ne parle pas, il rapporte.',
    icon: '⛰️',
    kind: 'producer',
    cost: 50,
    tier: 1,
    model: 'rock',
    noPop: true,
    production: [{ output: 'stone', every: 10 }],
  },
  bush: {
    name: 'Buisson',
    desc: 'Un buisson généreux : des bâtons et des baies à volonté. Attention aux épines.',
    icon: '🌿',
    kind: 'producer',
    cost: 40,
    tier: 1,
    model: 'tree',
    noPop: true,
    // Des bâtons, et des baies dont on tire les graines
    production: [
      { output: 'stick', every: 10 },
      { output: 'seed', every: 20 },
    ],
  },
  cro_magnon: {
    name: 'Cro-Magnon',
    desc: 'Notre héros ! Un peu bourru, très motivé, il rapporte des coquillages à longueur de journée. Peut apprendre un métier avec le bon outil.',
    icon: '🧍',
    kind: 'producer',
    cost: 60,
    costTag: 'worker',
    tier: 1,
    tags: ['worker'],
    nightMultiplier: 1.5,
    model: 'caveman',
    production: [{ output: 'shell', every: 1 }],
  },
  hunter: {
    name: 'Chasseur',
    desc: 'Il lance des trucs pointus sur des trucs qui courent. Rapporte des coquillages et de la viande crue. Adore le steak.',
    icon: '🏹',
    kind: 'producer',
    cost: 700,
    costTag: 'worker',
    tier: 2,
    tags: ['worker', 'hungry'],
    nightMultiplier: 1.5,
    model: 'hunter',
    production: [
      { output: 'shell', every: 1, amount: 5 },
      { output: 'raw_meat', every: 15 },
    ],
  },
  hut: {
    name: 'Cabane',
    desc: 'Un toit, quatre murs, zéro plomberie. Rapporte des coquillages et accueille un nouveau villageois de temps en temps.',
    icon: '🛖',
    kind: 'producer',
    cost: 120,
    costTag: 'home',
    tier: 3,
    tags: ['home'],
    model: 'hut',
    noPop: true,
    // Comme la Hutte tribale, en plus modeste : un peu de coquillages, et un nouveau villageois de temps en temps
    production: [
      { output: 'shell', every: 1, amount: 2 },
      { output: 'cro_magnon', every: 45 },
    ],
  },
  mud_puddle: {
    name: 'Flaque de boue',
    desc: "Une flaque, mais une flaque pro. Fournit de la boue, et parfois de l'argile pour les jours de chance.",
    icon: '🟤',
    kind: 'producer',
    cost: 50,
    tier: 1,
    model: 'puddle',
    noPop: true,
    // De la boue, et de temps en temps de l'argile. L'eau, elle, vient des blocs d'eau (voir index.ts)
    production: [
      { output: 'mud', every: 10 },
      { output: 'clay', every: 20 },
    ],
  },
  miner: {
    name: 'Mineur',
    desc: "Il tape sur des cailloux toute la journée et en redemande. Cailloux, coquillages et un peu d'ocre quand il est inspiré.",
    icon: '⛏️',
    kind: 'producer',
    cost: 1100,
    costTag: 'worker',
    tier: 2,
    tags: ['worker', 'hungry'],
    nightMultiplier: 1.5,
    model: 'miner',
    // Des cailloux en continu, et de temps en temps de l'ocre (le pigment rouge du Peintre rupestre)
    production: [
      { output: 'shell', every: 1, amount: 6 },
      { output: 'stone', every: 6 },
      { output: 'ochre', every: 60 },
    ],
  },
  lumberjack: {
    name: 'Bûcheron',
    desc: 'Il a une hache, de la barbe et une grande passion pour les arbres (surtout quand ils tombent). Bâtons, troncs, coquillages.',
    icon: '🪓',
    kind: 'producer',
    cost: 1100,
    costTag: 'worker',
    tier: 2,
    tags: ['worker'],
    nightMultiplier: 1.5,
    model: 'lumberjack',
    // Des bâtons en continu, et de temps en temps un tronc (pour la roue)
    production: [
      { output: 'shell', every: 1, amount: 6 },
      { output: 'stick', every: 6 },
      { output: 'log', every: 30 },
    ],
  },
  tribal_hut: {
    name: 'Hutte tribale',
    desc: "Le grand chic de l'Âge de Pierre. Le gros revenu en coquillages, et une nouvelle recrue chaque minute.",
    icon: '🛖',
    kind: 'producer',
    // La fusion de deux Cabanes se paie (comme une pose) : sinon le plus gros revenu du début serait gratuit
    cost: 33000,
    costTag: 'home',
    tier: 4,
    tags: ['home'],
    model: 'tribal_hut',
    noPop: true,
    // Le gros revenu de l'âge de pierre, et une nouvelle recrue toutes les minutes
    production: [
      { output: 'shell', every: 1, amount: 25 },
      { output: 'cro_magnon', every: 60 },
    ],
  },
  dog: {
    name: 'Chien préhistorique',
    desc: "Le meilleur ami de l'homme, version préhistorique. Il ramasse tout et agrandit ton dock de 15 places.",
    icon: '🐕',
    kind: 'producer',
    cost: 400,
    tier: 4,
    model: 'dog',
    dockBonus: 15, // il ramasse tout : +15 places dans le dock
  },
  mammoth: {
    name: 'Mammouth',
    desc: 'Gros. Très gros. Laineux. Il rapporte une montagne de coquillages sans rien demander, à part de la place.',
    icon: '🦣',
    kind: 'producer',
    // Le Mammouth se paie aussi quand on le crée en fusionnant deux Chasseurs (sinon la fusion contournerait le prix)
    cost: 100000,
    tier: 4,
    tags: ['animal'],
    model: 'mammoth',
    production: [{ output: 'shell', every: 1, amount: 40 }],
  },
  painter: {
    name: 'Peintre rupestre',
    desc: "Il dessine des bisons sur les murs et ça plaît beaucoup. Tout le monde gagne plus de coquillages sur l'île !",
    icon: '🎨',
    kind: 'producer',
    cost: 3000,
    costTag: 'worker',
    tier: 5,
    nightMultiplier: 1, // ×1 : aucun effet sur la production (il n'en a pas), mais c'est ce qui le fait rentrer chez lui la nuit
    model: 'painter',
    // Il dessine des bisons sur les murs : +20 % de coquillages sur toute l'île
    aura: { area: 'global', valueMultiplier: 0.2 },
  },
  field: {
    name: 'Champ',
    desc: "Un champ de blé tout beau, tout prêt. Il adore qu'on l'arrose : les blocs d'eau voisins le boostent.",
    icon: '🌾',
    kind: 'producer',
    cost: 300,
    tier: 3,
    tags: ['crop'],
    model: 'field',
    noPop: true,
    production: [{ output: 'wheat', every: 8 }],
  },
  sheep: {
    name: 'Mouton',
    desc: 'Béé ! Elle broute, elle rapporte des coquillages, et elle perd sa laine sans se plaindre. Une vraie pro.',
    icon: '🐑',
    kind: 'producer',
    cost: 3700,
    tier: 3,
    tags: ['animal'],
    model: 'sheep',
    production: [{ output: 'shell', every: 1, amount: 10 }, { output: 'wool', every: 20 }],
  },
  cow: {
    name: 'Vache',
    desc: 'Meuh. Du lait, du cuir, des coquillages : elle donne tout et ne demande que du blé. Un modèle de générosité.',
    icon: '🐄',
    kind: 'producer',
    cost: 11000,
    tier: 3,
    tags: ['animal'],
    model: 'cow',
    // Du lait en continu, et de temps en temps un peu de cuir
    production: [
      { output: 'shell', every: 1, amount: 16 },
      { output: 'milk', every: 15 },
      { output: 'leather', every: 60 },
    ],
  },
  drum: {
    name: 'Tambour',
    desc: "Boum, boum, boum ! Le rythme donne envie de travailler à tous les ouvriers voisins (même ceux qui n'avaient pas envie).",
    icon: '🥁',
    kind: 'producer',
    cost: 700,
    tier: 3,
    model: 'drum',
    noPop: true,
    // Son rythme entraîne les ouvriers des 4 cases adjacentes : +40 % de vitesse
    aura: { area: 'cross', speedMultiplier: 0.4, affectsTag: 'worker' },
  },
  granary: {
    name: 'Grenier',
    desc: 'Un gros hangar pour ranger les récoltes. Ça ne rapporte rien, mais ça fait de la place. Beaucoup de place.',
    icon: '🏚️',
    kind: 'producer',
    cost: 500,
    tier: 3,
    model: 'granary',
    noPop: true,
    dockBonus: 25, // on y range les récoltes : +25 places dans le dock
  },
  cart: {
    name: 'Charrette',
    desc: "Deux roues, un plateau, et hop : les marchandises voyagent. Un très gros revenu pour pas un gramme d'effort.",
    icon: '🛒',
    kind: 'producer',
    cost: 50000,
    tier: 4,
    model: 'cart',
    noPop: true,
    // Elle transporte les marchandises : un gros revenu
    production: [{ output: 'shell', every: 1, amount: 30 }],
  },
  shaman: {
    name: 'Chaman',
    desc: 'Il marmonne, il agite des plumes, et les ouvriers autour travaillent plus vite. On ne pose pas de questions.',
    icon: '🧙',
    kind: 'producer',
    cost: 1500,
    tier: 4,
    nightMultiplier: 1, // ×1 : aucun effet sur la production (il n'en a pas), mais c'est ce qui le fait rentrer chez lui la nuit
    model: 'shaman',
    // Ses rites inspirent les ouvriers des 8 cases autour : +30 % de vitesse
    aura: { area: 'square', speedMultiplier: 0.3, affectsTag: 'worker' },
  },
  campfire: {
    name: 'Feu de Camp',
    desc: 'Crépite, ça sent bon et ça réchauffe les petits cœurs. Les ouvriers collés au feu travaillent plus vite. Et il fabrique de la chaleur.',
    icon: '🏕️',
    kind: 'producer',
    cost: 100,
    tier: 3,
    model: 'campfire',
    noPop: true,
    production: [{ output: 'heat', every: 12 }],
    // Aura : les ouvriers sur les 4 cases adjacentes travaillent +50 % plus vite
    aura: { area: 'cross', speedMultiplier: 0.5, affectsTag: 'worker' },
  },
})

export type World1ItemId = keyof typeof world1Items

export const world1Recipes: (Recipe & { inputs: World1ItemId[]; result: World1ItemId })[] = [
  // Feu et outils
  { inputs: ['stone', 'stick'], result: 'flint_tool' },
  { inputs: ['stone', 'stone'], result: 'spark' },
  { inputs: ['spark', 'stick'], result: 'campfire' },
  { inputs: ['stick', 'stick', 'stick', 'mud', 'campfire'], result: 'hut' }, // 3 bâtons + de la boue (torchis) + un feu de camp -> cabane
  // Deux cabanes regroupées font un village : se fait aussi en glissant l'une sur l'autre sur l'île
  { inputs: ['hut', 'hut'], result: 'tribal_hut' },
  // Métiers : s'obtiennent aussi en utilisant l'item sur un Cro-Magnon posé sur l'île
  { inputs: ['cro_magnon', 'flint_tool'], result: 'hunter' },
  { inputs: ['cro_magnon', 'stone'], result: 'miner' },
  { inputs: ['cro_magnon', 'stick'], result: 'lumberjack' },
  { inputs: ['cro_magnon', 'ochre'], result: 'painter' },
  { inputs: ['cro_magnon', 'cloth'], result: 'shaman' },
  // Chasse et cuisson
  { inputs: ['raw_meat', 'heat'], result: 'grilled_steak' },
  { inputs: ['hunter', 'hunter'], result: 'mammoth' }, // se fait aussi en les glissant l'un sur l'autre sur l'île
  // Domestication : le loup est attiré par l'odeur de la viande
  { inputs: ['raw_meat', 'raw_meat'], result: 'wolf' },
  { inputs: ['wolf', 'cro_magnon'], result: 'dog' },
  // Poterie
  { inputs: ['clay', 'heat'], result: 'pot' }, // on cuit l'argile
  { inputs: ['pot', 'wheat'], result: 'granary' },
  // Agriculture
  { inputs: ['seed', 'seed', 'water'], result: 'field' },
  { inputs: ['wheat', 'stone'], result: 'flour' }, // on écrase le grain entre deux pierres
  { inputs: ['flour', 'water'], result: 'dough' },
  { inputs: ['dough', 'heat'], result: 'bread' },
  // Élevage et tissage : le chien rassemble le troupeau
  { inputs: ['dog', 'wheat'], result: 'sheep' },
  { inputs: ['wool', 'wool'], result: 'cloth' },
  { inputs: ['wheat', 'wheat', 'stick'], result: 'cow' }, // un enclos de blé et de bâtons pour garder une vache
  { inputs: ['leather', 'log'], result: 'drum' }, // une peau tendue sur un tronc
  // La roue
  { inputs: ['log', 'flint_tool'], result: 'wheel' },
  { inputs: ['wheel', 'wheel', 'log'], result: 'cart' },
]

// Objectifs : le HUD affiche le premier pas encore atteint ; l'avancement = objectifs atteints / total.
// Ils guident le joueur mais ne terminent pas le monde : voir world1Finale.
export const world1Goals: { item: World1ItemId; text: string }[] = [
  { item: 'flint_tool', text: 'Fabriquer un Outil en Silex' },
  { item: 'hunter', text: 'Créer un Chasseur' },
  { item: 'hut', text: 'Bâtir une Cabane' },
  { item: 'grilled_steak', text: 'Cuisiner un Steak grillé' },
  { item: 'pot', text: 'Cuire une Poterie' },
  { item: 'field', text: 'Cultiver un Champ' },
  { item: 'bread', text: 'Cuire du Pain' },
  { item: 'dog', text: 'Apprivoiser un Chien' },
  { item: 'sheep', text: 'Élever un Mouton' },
  { item: 'cow', text: 'Élever une Vache' },
  { item: 'painter', text: 'Recruter un Peintre rupestre' },
  { item: 'wheel', text: 'Inventer la Roue' },
  { item: 'cart', text: 'Construire une Charrette' },
  { item: 'mammoth', text: 'Capturer un Mammouth' },
]

// Fin du monde 1 : dresser le Cercle de pierres. Le joueur doit avoir découvert ce qu'il faut pour le bâtir (la charrette qui transporte
// les pierres, le pain qui nourrit les bâtisseurs, l'ocre des rites) ET posséder 10 M de coquillages : c'est un jeu idle.
// Réglé avec `npm run balance` (rythme 20 min de jeu / 7 h d'absence, hors-ligne à 50 %) : Les gros revenus (Hutte tribale, Mammouth, Charrette) se paient cher : le revenu monte de façon régulière pendant toute la partie (voir le graphique de revenu).
export const world1Finale: Finale = {
  text: 'Dresser le Cercle de pierres',
  requires: ['cart', 'bread', 'ochre'] satisfies World1ItemId[],
  shells: 10_000_000,
}

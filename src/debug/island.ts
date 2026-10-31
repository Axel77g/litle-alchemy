// Commandes de debug exposées dans la console du navigateur : window.island.*
import { getCell } from '../engine/grid'
import { findRecipe } from '../engine/items'
import { statMultiplier } from '../engine/modifiers'
import type { ItemId, World } from '../engine/types'
import { triggerImpact } from '../fx/effects'
import { useGame } from '../store/game'
import { clearSave, disableSaving } from '../store/persist'
import { clearTelemetry, downloadRuns, getRuns } from '../telemetry'
import { measurePerf } from './perf'
import { dayCycle, formatHour } from '../scene/skyCycle'
import { useQuality, type Tier } from '../scene/quality'

export interface IslandDebug {
  dump(): { cells: number; bounds: unknown; map: string; world: World }
  expand(x?: number, z?: number): void
  place(x: number, z: number, itemId: ItemId): void
  remove(x: number, z: number): void
  wave(x: number, z: number, radius?: number): void
  buy(x: number, z: number): boolean
  items(): void
  combine(a: ItemId, b: ItemId): ItemId | undefined
  recipes(): void
  state(): void
  give(itemId: ItemId, n?: number): void
  merge(a: ItemId, b: ItemId): void
  use(x: number, z: number, itemId: ItemId): void
  fast(seconds: number): void
  reset(): void
  exportRun(download?: boolean): unknown // parties enregistrées par la télémétrie ; true : télécharge le fichier JSON
  perf(): Promise<unknown>
  quality(tier?: Tier): Tier
  time(hour?: number): string
  dayLength(seconds: number): void
  freezeTime(frozen?: boolean): void
}

declare global {
  interface Window {
    island: IslandDebug
  }
}

const game = () => useGame.getState()

window.island = {
  // island.dump() : affiche la carte de l'île + le tableau des cellules, et retourne le tout
  dump() {
    const { world: w, rules } = game()
    const cells = [...w.values()]
    const xs = cells.map((c) => c.x)
    const zs = cells.map((c) => c.z)
    const bounds = { x: [Math.min(...xs), Math.max(...xs)], z: [Math.min(...zs), Math.max(...zs)] }

    // une lettre par type d'item présent sur la carte
    const letters = new Map<ItemId, string>()
    for (const c of cells) if (c.entity && !letters.has(c.entity.itemId)) letters.set(c.entity.itemId, String.fromCharCode(65 + letters.size))

    const lines: string[] = []
    for (let z = bounds.z[0]; z <= bounds.z[1]; z++) {
      let line = ''
      for (let x = bounds.x[0]; x <= bounds.x[1]; x++) {
        const c = getCell(w, x, z)
        line += !c ? '  ' : c.entity ? `${letters.get(c.entity.itemId)} ` : c.unlocked ? '. ' : 'x '
      }
      lines.push(line)
    }
    const map = lines.join('\n')
    const legend = [...letters].map(([id, l]) => `${l}=${rules.items[id].name}`).join(' ')
    console.log(`${cells.length} cases, x ${bounds.x}, z ${bounds.z}\n(${legend} .=herbe x=verrouillée)\n${map}`)
    console.table(
      cells.map((c) => ({
        x: c.x,
        z: c.z,
        terrain: c.terrain,
        unlocked: c.unlocked,
        entity: c.entity?.itemId ?? '-',
        speed: statMultiplier(c.modifiers, 'speed'),
      })),
    )
    return { cells: cells.length, bounds, map, world: w }
  },
  // island.expand() : ajoute une couche autour de l'île. island.expand(x, z) : ajoute une seule case (x, z peuvent être négatifs)
  expand: (x, z) => (x === undefined || z === undefined ? game().expand() : game().unlock(x, z)),
  // island.place(x, z, 'hunter') : pose un producteur du dock (s'il n'y en a pas, la commande en ajoute un).
  // Seuls les items 'producer' se posent sur le plateau.
  place(x, z, itemId) {
    if (!game().inventory[itemId]) game().give(itemId)
    game().place(x, z, itemId)
  },
  remove: (x, z) => game().remove(x, z),
  // island.buy(x, z) : achète une case voisine de l'île avec des coquillages (island.give ne donne pas de coquillages : utilise island.fast(secondes))
  buy: (x, z) => game().buyCell(x, z),
  // island.wave(x, z, radius) : déclenche seulement l'onde, sans poser d'objet
  wave: (x, z, radius = 3) => triggerImpact(x, z, radius),
  // island.items() : liste les items du monde courant
  items() {
    console.table(
      Object.values(game().rules.items).map((i) => ({
        id: i.id,
        nom: `${i.icon} ${i.name}`,
        kind: i.kind,
        tier: i.tier,
        production: i.production?.map((p) => `${p.amount ?? 1} ${p.output}/${p.every}s${p.limit ? ` (max ${p.limit})` : ''}`).join(', ') ?? '-',
        aura: i.aura ? `${i.aura.area} +${(i.aura.speedMultiplier ?? 0) * 100}%` : '-',
      })),
    )
  },
  // island.combine('stone', 'stick') : donne le résultat de la fusion (dans n'importe quel ordre)
  combine: (a, b) => findRecipe(game().rules, a, b),
  // island.recipes() : liste toutes les recettes
  recipes() {
    const { rules } = game()
    console.table(rules.recipes.map((r) => ({ ingrédients: r.inputs.map((i) => rules.items[i].icon).join(' '), résultat: `${rules.items[r.result].icon} ${rules.items[r.result].name}` })))
  },
  // island.state() : coquillages + inventaire du dock (+ rapport hors-ligne s'il y en a un)
  state() {
    const { shells, inventory, rules, offlineReport } = game()
    console.log(`🐚 ${shells.toFixed(1)} coquillages`)
    console.table(Object.entries(inventory).map(([id, n]) => ({ item: `${rules.items[id].icon} ${rules.items[id].name}`, id, quantité: n })))
    if (offlineReport) console.log('Gain hors-ligne :', offlineReport)
  },
  // island.give('stone', 5) : ajoute des items au dock
  give: (itemId, n = 1) => game().give(itemId, n),
  // island.merge('stone', 'stick') : fusion dans le dock
  merge: (a, b) => game().merge(a, b),
  // island.use(x, z, 'flint_tool') : item du dock sur un producteur du plateau (Silex sur Cro-Magnon -> Chasseur)
  use: (x, z, itemId) => game().use(x, z, itemId),
  // island.fast(600) : avance la production de 600 s d'un coup (pour tester sans attendre)
  fast: (seconds) => game().advance(seconds),
  // island.perf() : fps, résolution réelle du rendu, draw calls et triangles par image
  async perf() {
    const result = await measurePerf()
    console.table(result)
    return result
  },
  // island.quality('low' | 'medium' | 'high') : change la qualité graphique (sans argument : affiche le niveau actuel)
  quality(tier) {
    if (tier) useQuality.getState().setTier(tier)
    return useQuality.getState().tier
  },
  // island.time() : heure du jeu. island.time(18.5) : saute à 18h30 (6 = lever, 12 = midi, 18.5 = coucher, 0 = minuit)
  time(hour) {
    if (hour !== undefined) dayCycle.hour = ((hour % 24) + 24) % 24
    return formatHour(dayCycle.hour)
  },
  // island.dayLength(120) : un jour dure 120 s (60 par défaut)
  dayLength: (seconds) => void (dayCycle.hoursPerSecond = 24 / seconds),
  // island.freezeTime() : fige l'heure (island.freezeTime(false) pour reprendre)
  freezeTime: (frozen = true) => void (dayCycle.paused = frozen),
  // island.exportRun() : les parties enregistrées (island.exportRun(true) pour les télécharger)
  exportRun(download = false) {
    if (download) downloadRuns()
    return getRuns()
  },
  // island.reset() : efface la sauvegarde (et l'enregistrement qui allait avec) et recharge la page
  reset() {
    disableSaving() // sinon la fermeture de la page réécrit la sauvegarde qu'on vient d'effacer
    clearSave()
    clearTelemetry()
    location.reload()
  },
}

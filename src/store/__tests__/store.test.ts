import { describe, expect, it } from 'vitest'
import { world1 } from '../../content/world1'
import { totalCards } from '../../engine/inventory'
import { createGameStore } from '../game'
import { freshProgress, restoreProgress } from '../initial'
import { computePhase, getPhase, isFrozen, isSaveBlocked, setPhase, setSimPaused } from '../phase'

describe('phase', () => {
  it('accueil > introduction > tutoriel guidé > jeu', () => {
    expect(computePhase(true, true, true)).toBe('home')
    expect(computePhase(false, true, true)).toBe('intro')
    expect(computePhase(false, false, true)).toBe('guided')
    expect(computePhase(false, false, false)).toBe('playing')
  })

  it('gel et blocage de la sauvegarde découlent de la phase', () => {
    const table = { home: [true, true], intro: [true, true], guided: [true, false], playing: [false, false] } as const
    for (const [phase, [frozen, blocked]] of Object.entries(table)) {
      setPhase(phase as keyof typeof table)
      expect([phase, isFrozen(), isSaveBlocked()]).toEqual([phase, frozen, blocked])
    }
    setPhase('playing')
    setSimPaused(true)
    expect(isFrozen()).toBe(true)
    expect(isSaveBlocked()).toBe(false) // la pause de diagnostic ne touche pas à la sauvegarde
    setSimPaused(false)
  })
})

describe('initial', () => {
  it('freshProgress repart du stock de départ', () => {
    const p = freshProgress(world1)
    expect(p.shells).toBe(0)
    expect(p.inventory).toEqual(world1.startingInventory)
    expect(p.inventory).not.toBe(world1.startingInventory) // copie : le contenu n'est jamais muté
    for (const id of Object.keys(world1.startingInventory)) expect(p.seen[id]).toBe(true)
  })

  it('restoreProgress sans sauvegarde = partie neuve, sans rapport hors-ligne', () => {
    const r = restoreProgress(world1, undefined, Date.now())
    expect(r.report).toBeNull()
    expect(r.inventory).toEqual(world1.startingInventory)
  })

  it('restoreProgress rattrape l’absence', () => {
    const p = freshProgress(world1)
    const away = restoreProgress(world1, { ...p, savedAt: Date.now() - 3600_000 }, Date.now())
    expect(away.report?.seconds).toBeGreaterThan(3500)
    expect(away.shells + totalCards(away.inventory)).toBeGreaterThan(totalCards(p.inventory) + p.shells)
  })
})

describe('createGameStore', () => {
  it('démarre sur le monde passé en paramètre', () => {
    const s = createGameStore(world1).getState()
    expect(s.worldId).toBe(world1.id)
    expect(s.inventory).toEqual(world1.startingInventory)
  })

  it('tick ne produit rien tant que la partie est figée', () => {
    const store = createGameStore(world1)
    const before = store.getState().shells
    setPhase('home')
    store.getState().tick(Date.now() + 60_000)
    expect(store.getState().shells).toBe(before)
    setPhase('playing')
    expect(getPhase()).toBe('playing')
  })

  it('vendre convertit des cartes en coquillages ; reset repart de zéro', () => {
    const store = createGameStore(world1)
    const sellable = Object.keys(store.getState().inventory).find((id) => store.getState().rules.items[id]?.sellValue)
    if (sellable) {
      expect(store.getState().sell(sellable)).toBe(true)
      expect(store.getState().shells).toBeGreaterThan(0)
    }
    store.getState().reset()
    expect(store.getState().shells).toBe(0)
    expect(store.getState().inventory).toEqual(world1.startingInventory)
  })

  it('refuse de poser ce qu’on ne possède pas', () => {
    const store = createGameStore(world1)
    expect(store.getState().place(0, 0, 'does-not-exist')).toBe(false)
  })
})

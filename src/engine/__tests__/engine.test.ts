import { describe, expect, it } from 'vitest'
import { world1 } from '../../content/world1'
import { advanceClock, clock, homeProgress, isNight, nightFraction, START_HOUR } from '../clock'
import { diffWorlds } from '../events'
import { createWorld, placeEntity, removeEntity } from '../grid'
import { addItems, mergeItems, sellItems, takeItems, totalCards } from '../inventory'
import { catchUp, OFFLINE_CAP, OFFLINE_EFFICIENCY, OFFLINE_GRACE } from '../offline'
import { placementCost } from '../pricing'

const { rules } = world1
const producerId = Object.values(rules.items).find((d) => d.kind === 'producer')!.id
const fresh = () => createWorld(rules, world1.ground, world1.objects)

describe('inventory', () => {
  it('add / take sont purs et retirent les piles vides', () => {
    const a = { stone: 2 }
    const b = addItems(a, 'stone', 3)
    expect(a).toEqual({ stone: 2 })
    expect(b.stone).toBe(5)
    expect(takeItems(b, 'stone', 5)).toEqual({})
    expect(takeItems(b, 'stone', 6)).toBeUndefined()
  })

  it('totalCards somme les piles', () => expect(totalCards({ a: 2, b: 3 })).toBe(5))

  it('mergeItems refuse sans recette', () => expect(mergeItems(rules, { stone: 1, stick: 1 }, 'stone', 'nope')).toBeUndefined())

  it('sellItems refuse un stock insuffisant', () => expect(sellItems(rules, {}, 'stone', 1)).toBeUndefined())
})

describe('offline', () => {
  it('une courte absence compte plein tarif', () => expect(catchUp(OFFLINE_GRACE)).toEqual({ real: OFFLINE_GRACE, effective: OFFLINE_GRACE }))
  it('au-delà, le rendement baisse', () => {
    const { real, effective } = catchUp(OFFLINE_GRACE + 100)
    expect(real).toBe(OFFLINE_GRACE + 100)
    expect(effective).toBe(OFFLINE_GRACE + 100 * OFFLINE_EFFICIENCY)
  })
  it('est plafonnée et ignore les durées négatives', () => {
    expect(catchUp(OFFLINE_CAP * 10).real).toBe(OFFLINE_CAP)
    expect(catchUp(-5)).toEqual({ real: 0, effective: 0 })
  })
})

describe('clock', () => {
  it('nuit de 21 h à 4 h 12', () => {
    expect(isNight(22)).toBe(true)
    expect(isNight(3)).toBe(true)
    expect(isNight(12)).toBe(false)
    expect(isNight(START_HOUR)).toBe(false)
  })
  it('homeProgress : dehors le jour, chez eux la nuit', () => {
    expect(homeProgress(12)).toBe(0)
    expect(homeProgress(23)).toBe(1)
  })
  it('nightFraction vaut 30 % sur une journée complète', () => expect(nightFraction(0, 180)).toBeCloseTo(7.2 / 24, 5))
  it('advanceClock avance et boucle sur 24 h', () => {
    const saved = clock.hour
    clock.hour = 23
    advanceClock(180 / 24 * 2) // +2 h
    expect(clock.hour).toBeCloseTo(1, 5)
    clock.hour = saved
  })
})

describe('grid', () => {
  it('placer puis retirer ne mute pas le monde d’origine', () => {
    const w = fresh()
    const empty = [...w.values()].find((c) => c.unlocked && !c.entity && c.terrain === 'GRASS')
    if (!empty) throw new Error('aucune case libre dans le monde de départ')
    const placed = placeEntity(rules, w, empty.x, empty.z, producerId)
    expect(w.get(`${empty.x},${empty.z}`)!.entity).toBeNull()
    const back = removeEntity(rules, placed, empty.x, empty.z)
    expect(back.get(`${empty.x},${empty.z}`)!.entity).toBeNull()
  })

  it('diffWorlds déduit la pose et le retrait', () => {
    const w = fresh()
    const empty = [...w.values()].find((c) => c.unlocked && !c.entity && c.terrain === 'GRASS')!
    const placed = placeEntity(rules, w, empty.x, empty.z, producerId)
    expect(placed).not.toBe(w)
    expect(diffWorlds(w, placed).map((e) => e.type)).toContain('entityPlaced')
    expect(diffWorlds(placed, w).map((e) => e.type)).toContain('entityRemoved')
  })
})

describe('pricing', () => {
  it('un item sans coût est gratuit', () => expect(placementCost(rules, fresh(), 'stone')).toBe(0))
})

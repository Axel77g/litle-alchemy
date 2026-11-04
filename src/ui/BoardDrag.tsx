import { useEffect } from 'react'
import { clock } from '../engine/clock'
import { emit } from '../engine/events'
import { inspectCell } from '../engine/inspect'
import { previewBoardDrop } from '../engine/grid'
import { cameraControl } from '../scene/cameraControl'
import { useGame } from '../store/game'
import { sfx } from '../xe/sfx'
import { haptic } from '../shared/haptics'
import { cancelDrag, pickCell, showCellInfo, updateDrag, useUi } from '../interaction/uiStore'

const HOLD_MS = 220 // appui prolongé avant de saisir un personnage
const INFO_HOLD_MS = 400 // au doigt : appui long avant d'ouvrir sa fiche (comme sur les cartes du dock)
const MOVE_TOLERANCE = 8 // px : au-delà avant la fin du délai, c'est un geste de caméra (déplacement), pas une saisie

// Déplacer / fusionner un producteur déjà posé : on le saisit par un APPUI PROLONGÉ, puis on le glisse vers une case libre (déplacement),
// sur un autre producteur (fusion : Chasseur + Chasseur = Mammouth) ou jusqu'au dock (il est repris en carte).
// Un balayage ou un pincement, même en partant d'un personnage, fait bouger la caméra comme d'habitude.
export default function BoardDrag() {
  useEffect(() => {
    let active = false // un appui est en cours (saisie ou attente)
    const down = (e: PointerEvent) => {
      if (!(e.target instanceof HTMLCanvasElement)) return
      if (active) return cancelCurrent?.() // deuxième doigt : c'est un pincement, on annule
      if (e.button !== 0) return
      const ui = useUi.getState()
      if (ui.drag) return
      // Au doigt, l'appui long ouvre la fiche (pas de survol pour l'infobulle) : on ne déplace qu'en mode construction.
      // À la souris, l'appui prolongé saisit toujours (l'infobulle est au survol).
      const info = e.pointerType !== 'mouse' && !ui.editMode
      const { world, rules } = useGame.getState()
      let from = pickCell(e.clientX, e.clientY, 0.35) // plan à mi-hauteur du personnage
      let entity = from && world.get(`${from.x},${from.z}`)?.entity
      if (!entity && info) {
        // pas de personnage : un bloc producteur du sol (bloc d'eau) a aussi sa fiche
        from = pickCell(e.clientX, e.clientY)
        const cell = from && world.get(`${from.x},${from.z}`)
        if (!from || !cell || !inspectCell(rules, cell, clock.hour)) return
      } else if (!from || !entity) return
      active = true
      cancelCurrent = hold(e, from, entity ? entity.itemId : '', info, () => {
        active = false
        cancelCurrent = null
      })
    }
    let cancelCurrent: (() => void) | null = null
    // Phase de capture : on voit l'appui sans jamais l'empêcher d'atteindre la caméra (elle n'est coupée qu'une fois le personnage saisi)
    window.addEventListener('pointerdown', down, true)
    return () => window.removeEventListener('pointerdown', down, true)
  }, [])
  return null
}

function hold(e: PointerEvent, from: { x: number; z: number }, itemId: string, info: boolean, done: () => void) {
  const startX = e.clientX
  const startY = e.clientY
  const pointerId = e.pointerId
  let x = startX
  let y = startY
  let grabbed = false

  const overDock = (cx: number, cy: number) => !!document.elementFromPoint(cx, cy)?.closest('[data-dock]')

  const update = (cx: number, cy: number) => {
    const dock = overDock(cx, cy)
    const cell = dock ? null : pickCell(cx, cy)
    const { rules, world } = useGame.getState()
    updateDrag({ itemId, x: cx, y: cy, mergeTarget: null, from, overDock: dock }, cell ? { ...cell, action: previewBoardDrop(rules, world, from, cell) } : null)
  }

  const timer = setTimeout(() => {
    if (info) {
      haptic(20)
      sfx('merge')
      showCellInfo(from)
      return stop(false)
    }
    // Toujours au même endroit : on le saisit. La caméra est coupée pour que le glisser ne déplace pas la vue.
    grabbed = true
    if (cameraControl.current) cameraControl.current.enabled = false
    haptic(14)
    emit({ type: 'itemGrabbed', itemId })
    update(x, y)
  }, info ? INFO_HOLD_MS : HOLD_MS)

  const move = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return
    x = ev.clientX
    y = ev.clientY
    if (grabbed) update(x, y)
    else if (Math.hypot(x - startX, y - startY) > MOVE_TOLERANCE) stop(false) // balayage : geste de caméra
  }

  function stop(drop: boolean) {
    clearTimeout(timer)
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', end)
    window.removeEventListener('pointercancel', cancel)
    if (grabbed) {
      if (cameraControl.current) cameraControl.current.enabled = true
      if (drop) {
        emit({ type: 'itemReleased', itemId })
        const game = useGame.getState()
        const dock = overDock(x, y)
        const to = dock ? null : pickCell(x, y)
        // Une fusion refusée faute de coquillages (le Mammouth se paie) n'est pas une confusion
        const broke = !!to && previewBoardDrop(game.rules, game.world, from, to) === 'merge'
        const ok = to ? game.moveOnBoard(from, to) : dock ? game.pickUp(from.x, from.z) : false
        if (!ok && !broke && (to || dock)) emit({ type: 'actionRejected', kind: 'board' })
        haptic(ok ? 25 : 6)
      }
      cancelDrag()
    }
    done()
  }
  const end = (ev: PointerEvent) => ev.pointerId === pointerId && stop(true)
  const cancel = (ev: PointerEvent) => ev.pointerId === pointerId && stop(false)

  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', end)
  window.addEventListener('pointercancel', cancel)
  return () => stop(false)
}

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { clock } from '../engine/clock'
import { inspectCell, type CellInfo } from '../engine/inspect'
import { useGame } from '../store/game'
import { itemDesc } from '../i18n'
import { CellInfoBody, cellName } from './CellTooltip'
import { GameWindow } from './Game'
import ItemIcon from './ItemIcon'
import { closeCellInfo, useUi } from '../interaction/uiStore'

const REFRESH_MS = 200 // les compteurs du moteur changent sans re-rendu : on les relit à cette cadence
const close = closeCellInfo

// Fiche d'un personnage / bloc du plateau (appui long au doigt) : même contenu que l'infobulle de la souris, plus sa description.
export default function CellInfoSheet() {
  const cell = useUi((s) => s.cellInfo)
  return cell ? <Sheet key={`${cell.x},${cell.z}`} x={cell.x} z={cell.z} /> : null
}

function Sheet({ x, z }: { x: number; z: number }) {
  useTranslation()
  const rules = useGame((s) => s.rules)
  const [info, setInfo] = useState<CellInfo | null>(null)

  useEffect(() => {
    const read = () => {
      const target = useGame.getState().world.get(`${x},${z}`)
      const next = target ? inspectCell(rules, target, clock.hour) : null
      if (!next) return close() // le personnage a été déplacé ou fusionné
      setInfo(next)
    }
    read()
    const id = setInterval(read, REFRESH_MS)
    return () => clearInterval(id)
  }, [x, z, rules])

  if (!info) return null
  const def = info.itemId ? rules.items[info.itemId] : undefined
  return (
    <GameWindow title={cellName(rules, info)} onClose={close}>
      <div className="mt-1 flex flex-col gap-3">
        {def && (
          <div className="flex items-center gap-3">
            <div className="grid size-20 shrink-0 place-items-center rounded-2xl bg-gradient-to-b from-[#fff7e6] to-[#ffe2b0] shadow-[0_3px_0_#140a04]">
              <ItemIcon def={def} size={68} />
            </div>
            {def.desc && <p className="ginset rounded-2xl p-2.5 font-display text-[13px] leading-snug">{itemDesc(def)}</p>}
          </div>
        )}
        <div className="flex flex-col gap-1.5 rounded-2xl bg-surface-container-high bg-[image:var(--grain)] p-2.5 font-display ring-2 ring-surface-container-highest">
          <CellInfoBody info={info} rules={rules} />
        </div>
      </div>
    </GameWindow>
  )
}

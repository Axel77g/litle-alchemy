import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getVolume, isMuted, setMuted, setVolume } from '../xe'
import { sfx } from '../xe/sfx'
import { GameButton, GameWindow } from './Game'
import { LANGUAGES, setLang, useSettings } from './settings'
import { useUi } from './uiStore'

const close = () => useUi.setState({ settingsOpen: false })

// Fenêtre des paramètres : son (volume + coupure) et langue
export default function SettingsSheet() {
  const open = useUi((s) => s.settingsOpen)
  return open ? <Settings /> : null
}

function Settings() {
  const { t } = useTranslation()
  const lang = useSettings((s) => s.lang)
  const [muted, setMutedState] = useState(isMuted)
  const [volume, setVolumeState] = useState(() => Math.round(getVolume() * 100))

  return (
    <GameWindow title={t('settings.title')} onClose={close}>
      <div className="mt-1 flex flex-col gap-3">
        <Section title={t('settings.sound')}>
          <div className="flex items-center gap-3">
            <GameButton
              variant={muted ? 'red' : 'green'}
              shape="icon"
              aria-label={muted ? t('settings.muteOff') : t('settings.muteOn')}
              onClick={() => {
                const next = !muted
                setMuted(next)
                setMutedState(next)
                if (!next) sfx('success')
              }}
            >
              {muted ? '🔇' : '🔊'}
            </GameButton>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={volume}
              disabled={muted}
              aria-label={t('settings.volume')}
              className="h-8 min-w-0 flex-1 accent-[#06d6a0] disabled:opacity-40"
              onChange={(e) => {
                const n = Number(e.target.value)
                setVolumeState(n)
                setVolume(n / 100)
              }}
              onPointerUp={() => sfx('pop')}
            />
            <span className="stroke-sm w-12 text-right font-display text-[14px] [--edge:#140a04]">{muted ? '—' : `${volume} %`}</span>
          </div>
        </Section>

        <Section title={t('settings.language')}>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as typeof lang)}
            className="ginset w-full rounded-2xl px-3 py-2.5 font-display text-[15px] font-bold text-card-ink"
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </Section>
      </div>
    </GameWindow>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="stroke-sm font-display text-[13px] uppercase tracking-wide [--edge:#140a04]">{title}</div>
      <div className="ginset rounded-2xl p-3">{children}</div>
    </div>
  )
}

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getVolume, isMuted, setMuted, setVolume } from '../xe'
import { sfx } from '../xe/sfx'
import { GameButton, GameWindow } from './Game'
import { LANGUAGES, setLang, useSettings } from './settings'
import { haptic } from '../shared/haptics'
import { closeSettings, useUi } from '../interaction/uiStore'

const close = closeSettings

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
          <LanguagePicker />
        </Section>
      </div>
    </GameWindow>
  )
}

// Menu déroulant aux couleurs du jeu (pas de <select> natif) : la liste se déplie sous le bouton
function LanguagePicker() {
  const { t } = useTranslation()
  const lang = useSettings((s) => s.lang)
  const [open, setOpen] = useState(false)
  const current = LANGUAGES.find((l) => l.id === lang)

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('settings.language')}
        onClick={() => {
          haptic(10)
          sfx('hover')
          setOpen(!open)
        }}
        className="gbtn w-full !justify-between px-4"
      >
        <span>{current?.label}</span>
        <span className={`text-sm transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && (
        <ul role="listbox" className="flex animate-pop flex-col gap-1.5">
          {LANGUAGES.map((l) => {
            const selected = l.id === lang
            return (
              <li key={l.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    haptic(10)
                    sfx('hover')
                    setLang(l.id)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 font-display text-[15px] font-bold shadow-[0_2px_0_rgba(0,0,0,0.25)] transition-transform active:translate-y-0.5 ${
                    selected ? 'bg-primary-container text-on-primary' : 'bg-[#fff1d6] text-card-ink'
                  }`}
                >
                  {l.label}
                  {selected && <span>✔</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
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

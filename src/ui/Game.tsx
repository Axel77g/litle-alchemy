import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { sfx } from '../xe/sfx'
import { haptic } from './haptics'

type Variant = 'green' | 'orange' | 'blue' | 'red' | 'gold' | 'purple' | 'stone'
type Shape = 'normal' | 'icon' | 'round'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  shape?: Shape
  shine?: boolean // éclat périodique : pour l'action principale de l'écran
}

// Bouton 3D « jeu » : les couleurs et le relief sont dans index.css (.gbtn)
export function GameButton({ variant = 'stone', shape = 'normal', shine, className = '', onClick, ...rest }: ButtonProps) {
  const classes = [
    'gbtn',
    variant === 'stone' ? '' : `gbtn-${variant}`,
    shape === 'icon' ? 'gbtn-icon' : shape === 'round' ? 'gbtn-round' : '',
    shine ? 'gbtn-shine' : '',
    className,
  ]
  return (
    <button
      {...rest}
      className={classes.join(' ')}
      onClick={(e) => {
        haptic(10)
        sfx('hover')
        onClick?.(e)
      }}
    />
  )
}

// Rond rouge avec une croix, posé sur le coin d'une fenêtre
export function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <GameButton variant="red" shape="round" onClick={onClick} aria-label="Fermer" className="absolute -right-4 -top-4 z-20 !size-11 !text-2xl">
      ✕
    </GameButton>
  )
}

export function Ribbon({ children }: { children: ReactNode }) {
  return (
    <div className="gribbon">
      <span>{children}</span>
    </div>
  )
}

interface WindowProps {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  className?: string
}

// Fenêtre centrée sur fond assombri : ruban de titre à cheval sur le haut, croix rouge dans le coin. Toucher le fond la ferme.
export function GameWindow({ title, onClose, children, className = '' }: WindowProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#140a04]/75 px-6 pb-safe pt-safe backdrop-blur-[2px]" onPointerDown={onClose}>
      <div onPointerDown={(e) => e.stopPropagation()} className={`gwindow flex max-h-[82dvh] w-full max-w-md animate-pop flex-col px-4 pb-4 pt-9 ${className}`}>
        <div className="absolute -top-6 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap">
          <Ribbon>{title}</Ribbon>
        </div>
        <CloseButton onClick={onClose} />
        {children}
      </div>
    </div>
  )
}

// Petite pastille ronde et détourée (compteur, notification)
export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`stroke-sm grid min-w-6 place-items-center rounded-full border-2 border-[#6e0e12] bg-gradient-to-b from-[#ff8a78] to-[#e0302a] px-1.5 font-display text-[13px] shadow-[0_2px_0_#6e0e12] [--edge:#6e0e12] ${className}`}>
      {children}
    </span>
  )
}

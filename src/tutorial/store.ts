import { create } from 'zustand'
import { isAutoplay } from '../shared/autoplayMode'
import { hasSave } from '../store/persist'
import { STEPS } from './steps'

// Seulement une partie neuve (pas de sauvegarde au chargement), et jamais en autopilote
const fresh = !hasSave() && !isAutoplay

// stepId : l'étape en cours (null = pas de tutoriel) ; intro : le mot d'accueil (scénario) passe avant la première étape
export const useTutorial = create<{ stepId: string | null; intro: boolean; hiddenFor: string | null; skipped: boolean }>(() => ({ stepId: fresh ? STEPS[0].id : null, intro: fresh, hiddenFor: null, skipped: false }))
// skipped : le joueur a passé le tutoriel : aucun chapitre ne se lance plus (runner)
// hiddenFor : l'étape dont le joueur a masqué le guide (« J'ai compris ») pour jouer librement ; la validation de l'étape le fait réapparaître
export const hideGuide = (id: string) => useTutorial.setState({ hiddenFor: id })

export const currentStep = (id: string | null = useTutorial.getState().stepId) => STEPS.find((s) => s.id === id)
export const stepIndex = (id: string | null) => STEPS.findIndex((s) => s.id === id)

export const beginTutorial = () => !isAutoplay && useTutorial.setState({ stepId: STEPS[0].id, intro: true, hiddenFor: null, skipped: false })
export const endIntro = () => useTutorial.setState({ intro: false })
export const endTutorial = () => useTutorial.setState({ stepId: null, intro: false, skipped: true })

// Le tutoriel est découpé en chapitres : celui de la première partie, puis ceux qui se lancent sur un événement (`startOn`).
// Un chapitre s'arrête avant la prochaine étape `startOn`.
export const firstChapterEnd = STEPS.findIndex((s, i) => i > 0 && s.startOn) // index de la première étape d'un chapitre à part (-1 : aucun)
export const inFirstChapter = (id: string) => firstChapterEnd < 0 || stepIndex(id) < firstChapterEnd

// Passe à l'étape suivante. Passer par un id (completeStep) plutôt que par un index rend les doubles validations sans effet :
// un événement et un état qui valident la même étape ne la font pas sauter deux fois.
export function completeStep(id: string) {
  const { stepId } = useTutorial.getState()
  if (stepId !== id) return
  const next = STEPS[stepIndex(id) + 1]
  useTutorial.setState({ stepId: next && !next.startOn ? next.id : null })
}

// Le guide est-il affiché (et n'explique-t-il pas justement la découverte) ? Les popups (découvertes...) attendent alors la fin de l'étape (Celebrations)
type TutorialState = ReturnType<typeof useTutorial.getState>
export const blocksPopups = (s: TutorialState = useTutorial.getState()) =>
  s.stepId !== null && !s.intro && s.hiddenFor !== s.stepId && !currentStep(s.stepId)?.holdsDiscovery
export const useBlocksPopups = () => useTutorial(blocksPopups)

// La bannière « Nouvelle découverte ! » doit-elle rester ? (Celebrations)
export const holdsDiscovery = () => !!currentStep()?.holdsDiscovery
export const useHoldsDiscovery = () => useTutorial((s) => !!currentStep(s.stepId)?.holdsDiscovery)

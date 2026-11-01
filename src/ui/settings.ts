// Langue du joueur : le choix vit dans i18n (voir i18n/index.ts), ce store ne sert qu'à redessiner l'interface quand il change.
import { create } from 'zustand'
import { currentLang, setLanguage, type Lang } from '../i18n'

export { LANGUAGES } from '../i18n'
export type { Lang }

export const useSettings = create<{ lang: Lang }>(() => ({ lang: currentLang() }))

export function setLang(lang: Lang) {
  setLanguage(lang)
  useSettings.setState({ lang })
}

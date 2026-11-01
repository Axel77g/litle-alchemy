// Traductions (i18next). Le français est la langue source : les textes des items / objectifs sont aussi dans content/world1 et servent de valeur par défaut.
// Un composant qui affiche du texte appelle useTranslation() pour se redessiner quand la langue change ; les fonctions hors React utilisent `t` d'ici.
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import fr from './locales/fr.json'

export const LANGUAGES = [
  { id: 'fr', label: 'Français' },
  { id: 'en', label: 'English' },
] as const
export type Lang = (typeof LANGUAGES)[number]['id']

export const LANG_KEY = 'alchemy:lang'

function readLang(): Lang {
  try {
    const raw = localStorage.getItem(LANG_KEY)
    return LANGUAGES.find((l) => l.id === raw)?.id ?? 'fr'
  } catch {
    return 'fr'
  }
}

void i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, en: { translation: en } },
  lng: readLang(),
  fallbackLng: 'fr',
  interpolation: { escapeValue: false }, // React échappe déjà
  returnNull: false,
})

export function setLanguage(lang: Lang) {
  void i18n.changeLanguage(lang)
  document.documentElement.lang = lang
  try {
    localStorage.setItem(LANG_KEY, lang)
  } catch {
    // stockage indisponible : le choix vaut pour cette session
  }
}
document.documentElement.lang = i18n.language

export const t = i18n.t.bind(i18n)
export const currentLang = () => i18n.language as Lang

// Contenu du monde : le texte du jeu (items, objectifs...) est la valeur par défaut si la clé manque
interface Named {
  id: string
  name: string
  desc?: string
}
export const itemName = (def: Named) => t(`items.${def.id}.name`, { defaultValue: def.name })
export const itemDesc = (def: Named) => (def.desc ? t(`items.${def.id}.desc`, { defaultValue: def.desc }) : undefined)
export const goalText = (g: { item: string; text: string }) => t(`goals.${g.item}`, { defaultValue: g.text })
export const finaleText = (f: { text: string }) => t('world.finale', { defaultValue: f.text })
export const compareNames = (a: Named, b: Named) => itemName(a).localeCompare(itemName(b), currentLang())

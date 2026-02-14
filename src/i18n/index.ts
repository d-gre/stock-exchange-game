import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import de from './de.json';
import en from './en.json';
import ja from './ja.json';
import la from './la.json';

export type Language = 'de' | 'en' | 'ja' | 'la';

// All languages including hidden Easter Egg (Latin)
export const ALL_LANGUAGES: { code: Language; name: string; short: string }[] = [
  { code: 'de', name: 'Deutsch', short: 'DE' },
  { code: 'en', name: 'English', short: 'EN' },
  { code: 'ja', name: '日本語', short: '日本' },
  { code: 'la', name: 'Latina', short: 'LA' },
];

// Visible languages (without Latin Easter Egg)
export const LANGUAGES = ALL_LANGUAGES.filter(l => l.code !== 'la');

const STORAGE_KEY = 'stock-game-language';

// User-selectable languages (without Easter Egg)
type UserLanguage = 'de' | 'en' | 'ja';
const USER_LANGUAGES: UserLanguage[] = ['de', 'en', 'ja'];

// Load language from localStorage or default to 'de'
// Note: Latin (Easter Egg) is never stored, so only user languages are returned
export const getStoredLanguage = (): UserLanguage => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && USER_LANGUAGES.includes(stored as UserLanguage)) {
      return stored as UserLanguage;
    }
  } catch {
    // localStorage not available
  }
  return 'de';
};

// Save language to localStorage
// Note: Latin (Easter Egg) is never persisted
export const setStoredLanguage = (lang: Language): void => {
  // Only persist user-selectable languages (not Latin Easter Egg)
  if (lang === 'la') {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // localStorage not available
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      de: { translation: de },
      en: { translation: en },
      ja: { translation: ja },
      la: { translation: la },
    },
    lng: getStoredLanguage(),
    fallbackLng: 'de',
    interpolation: {
      escapeValue: false, // React already escapes
    },
  });

export default i18n;

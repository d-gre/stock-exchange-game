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

// All valid languages (including hidden ones for localStorage)
const VALID_LANGUAGES: Language[] = ALL_LANGUAGES.map(l => l.code);

// Load language from localStorage or default to 'de'
export const getStoredLanguage = (): Language => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID_LANGUAGES.includes(stored as Language)) {
      return stored as Language;
    }
  } catch {
    // localStorage not available
  }
  return 'de';
};

// Save language to localStorage
export const setStoredLanguage = (lang: Language): void => {
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

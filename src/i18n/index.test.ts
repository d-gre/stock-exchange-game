import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getStoredLanguage, setStoredLanguage, LANGUAGES, ALL_LANGUAGES, type Language } from './index';

describe('i18n', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    });
  });

  describe('LANGUAGES', () => {
    it('should contain visible languages (excluding Latin Easter Egg)', () => {
      expect(LANGUAGES).toHaveLength(3);
      expect(LANGUAGES.map(l => l.code)).toEqual(['de', 'en', 'ja']);
    });

    it('should have name and short for each visible language', () => {
      expect(LANGUAGES.find(l => l.code === 'de')).toEqual({ code: 'de', name: 'Deutsch', short: 'DE' });
      expect(LANGUAGES.find(l => l.code === 'en')).toEqual({ code: 'en', name: 'English', short: 'EN' });
      expect(LANGUAGES.find(l => l.code === 'ja')).toEqual({ code: 'ja', name: '日本語', short: '日本' });
    });
  });

  describe('ALL_LANGUAGES', () => {
    it('should contain all languages including Latin Easter Egg', () => {
      expect(ALL_LANGUAGES).toHaveLength(4);
      expect(ALL_LANGUAGES.map(l => l.code)).toEqual(['de', 'en', 'ja', 'la']);
    });

    it('should have name and short for each language', () => {
      expect(ALL_LANGUAGES.find(l => l.code === 'la')).toEqual({ code: 'la', name: 'Latina', short: 'LA' });
    });
  });

  describe('getStoredLanguage', () => {
    it('should return default language "de" when localStorage is empty', () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      const result = getStoredLanguage();

      expect(result).toBe('de');
    });

    it('should return stored language when valid', () => {
      vi.mocked(localStorage.getItem).mockReturnValue('en');

      const result = getStoredLanguage();

      expect(result).toBe('en');
      expect(localStorage.getItem).toHaveBeenCalledWith('stock-game-language');
    });

    it('should return stored Japanese language', () => {
      vi.mocked(localStorage.getItem).mockReturnValue('ja');

      const result = getStoredLanguage();

      expect(result).toBe('ja');
    });

    it('should return default "de" when stored language is Latin (Easter Egg not persisted)', () => {
      // Latin is never stored, but if it somehow was, it should be treated as invalid
      vi.mocked(localStorage.getItem).mockReturnValue('la');

      const result = getStoredLanguage();

      expect(result).toBe('de');
    });

    it('should return default "de" when stored value is invalid', () => {
      vi.mocked(localStorage.getItem).mockReturnValue('fr');

      const result = getStoredLanguage();

      expect(result).toBe('de');
    });

    it('should return default "de" when localStorage throws', () => {
      vi.mocked(localStorage.getItem).mockImplementation(() => {
        throw new Error('localStorage not available');
      });

      const result = getStoredLanguage();

      expect(result).toBe('de');
    });
  });

  describe('setStoredLanguage', () => {
    it('should save language to localStorage', () => {
      setStoredLanguage('en');

      expect(localStorage.setItem).toHaveBeenCalledWith('stock-game-language', 'en');
    });

    it('should save German language', () => {
      setStoredLanguage('de');

      expect(localStorage.setItem).toHaveBeenCalledWith('stock-game-language', 'de');
    });

    it('should save Japanese language', () => {
      setStoredLanguage('ja');

      expect(localStorage.setItem).toHaveBeenCalledWith('stock-game-language', 'ja');
    });

    it('should NOT save Latin language (Easter Egg not persisted)', () => {
      setStoredLanguage('la');

      expect(localStorage.setItem).not.toHaveBeenCalled();
    });

    it('should not throw when localStorage is unavailable', () => {
      vi.mocked(localStorage.setItem).mockImplementation(() => {
        throw new Error('localStorage not available');
      });

      expect(() => setStoredLanguage('en')).not.toThrow();
    });
  });

  describe('language persistence roundtrip', () => {
    it('should persist and retrieve the same language (excluding Easter Egg)', () => {
      // Latin (Easter Egg) is explicitly excluded from persistence
      const persistableLanguages: Language[] = ['de', 'en', 'ja'];

      for (const lang of persistableLanguages) {
        let storedValue: string | null = null;
        vi.mocked(localStorage.setItem).mockImplementation((_, value) => {
          storedValue = value;
        });
        vi.mocked(localStorage.getItem).mockImplementation(() => storedValue);

        setStoredLanguage(lang);
        const result = getStoredLanguage();

        expect(result).toBe(lang);
      }
    });

    it('should not persist Latin (Easter Egg) language', () => {
      let storedValue: string | null = 'en'; // Previous language
      vi.mocked(localStorage.setItem).mockImplementation((_, value) => {
        storedValue = value;
      });
      vi.mocked(localStorage.getItem).mockImplementation(() => storedValue);

      setStoredLanguage('la');
      const result = getStoredLanguage();

      // Should return previous language since Latin was not stored
      expect(result).toBe('en');
    });
  });
});

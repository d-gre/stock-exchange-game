import { useEffect, useRef, useCallback } from 'react';
import type { Language } from '../i18n';
import type { Theme } from './useTheme';

/**
 * Easter Egg: Press Ctrl+L to toggle Latin language and medieval theme
 * Press again to return to previous language and theme
 */
export const useLatinEasterEgg = (
  currentLanguage: Language,
  onLanguageChange: (language: Language) => void,
  onThemeChange?: (theme: Theme) => void,
  getUserTheme?: () => 'dark' | 'light'
) => {
  const previousLanguageRef = useRef<Language | null>(null);

  const handleToggle = useCallback(() => {
    if (currentLanguage === 'la') {
      // Switch back to previous language and theme
      const previousLang = previousLanguageRef.current || 'de';
      onLanguageChange(previousLang);
      previousLanguageRef.current = null;
      // Restore user's preferred theme
      if (onThemeChange && getUserTheme) {
        onThemeChange(getUserTheme());
      }
    } else {
      // Save current language and switch to Latin + medieval theme
      previousLanguageRef.current = currentLanguage;
      onLanguageChange('la');
      if (onThemeChange) {
        onThemeChange('medieval');
      }
    }
  }, [currentLanguage, onLanguageChange, onThemeChange, getUserTheme]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      // Ctrl+L (or Cmd+L on Mac)
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        handleToggle();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleToggle]);
};

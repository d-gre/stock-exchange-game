import { useEffect, useRef, useCallback } from 'react';
import type { Language } from '../i18n';

/**
 * Easter Egg: Press Ctrl+L to toggle Latin language
 * Press again to return to previous language
 */
export const useLatinEasterEgg = (
  currentLanguage: Language,
  onLanguageChange: (language: Language) => void
) => {
  const previousLanguageRef = useRef<Language | null>(null);

  const handleToggle = useCallback(() => {
    if (currentLanguage === 'la') {
      // Switch back to previous language
      const previousLang = previousLanguageRef.current || 'de';
      onLanguageChange(previousLang);
      previousLanguageRef.current = null;
    } else {
      // Save current language and switch to Latin
      previousLanguageRef.current = currentLanguage;
      onLanguageChange('la');
    }
  }, [currentLanguage, onLanguageChange]);

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

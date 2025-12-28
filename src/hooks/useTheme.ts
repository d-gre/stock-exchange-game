import { useState, useEffect, useCallback } from 'react';

export type Theme = 'dark' | 'light';

const THEME_KEY = 'stock-exchange-theme';

export const useTheme = () => {
  const [theme, setThemeState] = useState<Theme>(() => {
    // SSR-safe: nur im Browser localStorage lesen
    if (typeof window === 'undefined') return 'dark';
    return (localStorage.getItem(THEME_KEY) as Theme) || 'dark';
  });

  // Theme beim Mount anwenden
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_KEY, newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme };
};

import { useState, useEffect, useCallback } from 'react';

export type Theme = 'dark' | 'light' | 'medieval';

const THEME_KEY = 'stock-exchange-theme';
const USER_THEME_KEY = 'stock-exchange-user-theme';

export const useTheme = () => {
  const [theme, setThemeState] = useState<Theme>(() => {
    // SSR-safe: nur im Browser localStorage lesen
    if (typeof window === 'undefined') return 'dark';
    const stored = localStorage.getItem(THEME_KEY) as Theme;
    // Never restore medieval theme from storage - it's only for Easter Egg
    if (stored === 'medieval') return 'dark';
    return stored || 'dark';
  });

  // Theme beim Mount anwenden
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    // Only persist user-selectable themes (not medieval)
    if (newTheme !== 'medieval') {
      localStorage.setItem(THEME_KEY, newTheme);
      localStorage.setItem(USER_THEME_KEY, newTheme);
    }
    document.documentElement.setAttribute('data-theme', newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  // Get the user's preferred theme (dark/light), ignoring medieval
  const getUserTheme = useCallback((): 'dark' | 'light' => {
    if (typeof window === 'undefined') return 'dark';
    return (localStorage.getItem(USER_THEME_KEY) as 'dark' | 'light') ||
           (localStorage.getItem(THEME_KEY) as 'dark' | 'light') ||
           'dark';
  }, []);

  return { theme, setTheme, toggleTheme, getUserTheme };
};

import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CONFIG } from '../config';
import { useTheme } from '../hooks/useTheme';
import { useClickOutside } from '../hooks/useClickOutside';
import { useAppDispatch } from '../store/hooks';
import { setLanguage } from '../store/settingsSlice';
import { LANGUAGES, ALL_LANGUAGES, setStoredLanguage, type Language } from '../i18n';
import { HelpModal } from './HelpModal';
import type { GameMode } from '../types';

interface GameStartProps {
  defaultGameMode: GameMode;
  isWarmingUp: boolean;
  warmupProgress: number;
  onStart: (gameMode: GameMode, initialCash: number) => Promise<void>;
}

export const GameStart = ({ defaultGameMode, isWarmingUp, warmupProgress, onStart }: GameStartProps) => {
  const dispatch = useAppDispatch();
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const [selectedStartMode] = useState<GameMode>(defaultGameMode);
  const [initialCash, setInitialCash] = useState<number>(CONFIG.initialCash);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const languageRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useClickOutside(languageRef, useCallback(() => setLanguageOpen(false), []));

  // Use ALL_LANGUAGES to also show short for hidden Latin Easter Egg
  const currentLang = ALL_LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];

  const handleLanguageSelect = (code: Language): void => {
    dispatch(setLanguage(code));
    setStoredLanguage(code);
    setLanguageOpen(false);
  };

  const handleStartGame = async (): Promise<void> => {
    await onStart(selectedStartMode, initialCash);
  };

  const handleCashChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 0) {
      setInitialCash(value);
    }
  };

  return (
    <div className="game-start">
      <div className="game-start__modal">
        <div className="game-start__toolbar">
          <button
            className="game-start__theme-toggle"
            type="button"
            title={t('settings.theme')}
            aria-label={t('settings.theme')}
            aria-pressed={theme === 'dark'}
            onClick={toggleTheme}
          >
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              className={`game-start__theme-icon game-start__theme-icon--light${theme === 'light' ? ' game-start__theme-icon--active' : ''}`}
            >
              <path
                fill="currentColor"
                d="M12,9c1.65,0,3,1.35,3,3s-1.35,3-3,3s-3-1.35-3-3S10.35,9,12,9 M12,7c-2.76,0-5,2.24-5,5s2.24,5,5,5s5-2.24,5-5 S14.76,7,12,7L12,7z M2,13l2,0c0.55,0,1-0.45,1-1s-0.45-1-1-1l-2,0c-0.55,0-1,0.45-1,1S1.45,13,2,13z M20,13l2,0c0.55,0,1-0.45,1-1 s-0.45-1-1-1l-2,0c-0.55,0-1,0.45-1,1S19.45,13,20,13z M11,2v2c0,0.55,0.45,1,1,1s1-0.45,1-1V2c0-0.55-0.45-1-1-1S11,1.45,11,2z M11,20v2c0,0.55,0.45,1,1,1s1-0.45,1-1v-2c0-0.55-0.45-1-1-1C11.45,19,11,19.45,11,20z M5.99,4.58c-0.39-0.39-1.03-0.39-1.41,0 c-0.39,0.39-0.39,1.03,0,1.41l1.06,1.06c0.39,0.39,1.03,0.39,1.41,0s0.39-1.03,0-1.41L5.99,4.58z M18.36,16.95 c-0.39-0.39-1.03-0.39-1.41,0c-0.39,0.39-0.39,1.03,0,1.41l1.06,1.06c0.39,0.39,1.03,0.39,1.41,0c0.39-0.39,0.39-1.03,0-1.41 L18.36,16.95z M19.42,5.99c0.39-0.39,0.39-1.03,0-1.41c-0.39-0.39-1.03-0.39-1.41,0l-1.06,1.06c-0.39,0.39-0.39,1.03,0,1.41 s1.03,0.39,1.41,0L19.42,5.99z M7.05,18.36c0.39-0.39,0.39-1.03,0-1.41c-0.39-0.39-1.03-0.39-1.41,0l-1.06,1.06 c-0.39,0.39-0.39,1.03,0,1.41s1.03,0.39,1.41,0L7.05,18.36z"
              />
            </svg>
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              className={`game-start__theme-icon game-start__theme-icon--dark${theme === 'dark' ? ' game-start__theme-icon--active' : ''}`}
            >
              <path
                fill="currentColor"
                d="M9.37,5.51C9.19,6.15,9.1,6.82,9.1,7.5c0,4.08,3.32,7.4,7.4,7.4c0.68,0,1.35-0.09,1.99-0.27C17.45,17.19,14.93,19,12,19 c-3.86,0-7-3.14-7-7C5,9.07,6.81,6.55,9.37,5.51z M12,3c-4.97,0-9,4.03-9,9s4.03,9,9,9s9-4.03,9-9c0-0.46-0.04-0.92-0.1-1.36 c-0.98,1.37-2.58,2.26-4.4,2.26c-2.98,0-5.4-2.42-5.4-5.4c0-1.81,0.89-3.42,2.26-4.4C12.92,3.04,12.46,3,12,3L12,3z"
              />
            </svg>
          </button>
          <div className="game-start__language" ref={languageRef}>
            <button
              type="button"
              className={`game-start__language-trigger${languageOpen ? ' game-start__language-trigger--open' : ''}`}
              onClick={() => setLanguageOpen(!languageOpen)}
              aria-label={t('settings.language')}
            >
              <span>{currentLang.short}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 10l5 5 5-5z" />
              </svg>
            </button>
            {languageOpen && (
              <div className="game-start__language-options">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    className={`game-start__language-option${lang.code === i18n.language ? ' game-start__language-option--active' : ''}`}
                    onClick={() => handleLanguageSelect(lang.code)}
                  >
                    {lang.short}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="game-start__logo">
          <img src={`${import.meta.env.BASE_URL}assets/logo.svg`} alt="Logo" />
          <span>D-GRE Stock Exchange</span>
        </div>
        {isWarmingUp ? (
          <div className="game-start__progress">
            <div className="game-start__progress-pie">
              <svg viewBox="0 0 100 100">
                <defs>
                  <linearGradient id="pie-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--accent-primary)" />
                    <stop offset="100%" stopColor="var(--accent-secondary)" />
                  </linearGradient>
                </defs>
                <circle
                  className="game-start__progress-pie-bg"
                  cx="50"
                  cy="50"
                  r="42"
                />
                <circle
                  className="game-start__progress-pie-fill"
                  cx="50"
                  cy="50"
                  r="42"
                  strokeDasharray={2 * Math.PI * 42}
                  strokeDashoffset={2 * Math.PI * 42 * (1 - warmupProgress / 100)}
                />
              </svg>
              <span className="game-start__progress-pie-text">{warmupProgress}%</span>
            </div>
            <span className="game-start__progress-label">{t('game.preparingMarket')}</span>
          </div>
        ) : (
          <>
            {/* Game modes temporarily hidden for release candidate
            <div className="game-start__modes">
              {GAME_MODES.map((mode) => (
                <label key={mode.id} className="game-start__mode">
                  <input
                    type="radio"
                    name="gameMode"
                    value={mode.id}
                    checked={selectedStartMode === mode.id}
                    onChange={() => setSelectedStartMode(mode.id)}
                  />
                  <div className="game-start__mode-content">
                    <span className="game-start__mode-name">{t(`gameModes.${mode.id}.name`)}</span>
                    <span className="game-start__mode-desc">{t(`gameModes.${mode.id}.description`)}</span>
                  </div>
                </label>
              ))}
            </div>
            */}
            <div className="game-start__capital">
              <label className="game-start__capital-label">
                {t('game.startingCapital')}
              </label>
              <div className="game-start__capital-input-wrapper">
                <span className="game-start__capital-currency">$</span>
                <input
                  type="number"
                  className="game-start__capital-input"
                  value={initialCash}
                  onChange={handleCashChange}
                  min={1000}
                  step={1000}
                />
              </div>
            </div>
            <button className="game-start__button" onClick={handleStartGame}>
              {t('game.start')}
            </button>
            <button
              type="button"
              className="game-start__help-link"
              onClick={() => setShowHelp(true)}
            >
              {t('help.linkText')}
            </button>
          </>
        )}
      </div>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
};

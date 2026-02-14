import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CONFIG, GAME_MODES } from '../config';
import type { Theme } from '../hooks/useTheme';
import { useClickOutside } from '../hooks/useClickOutside';
import { useAppDispatch } from '../store/hooks';
import { setLanguage } from '../store/settingsSlice';
import { LANGUAGES, ALL_LANGUAGES, setStoredLanguage, type Language } from '../i18n';
import { Help } from './Help';
import { CircularTimer } from './CircularTimer';
import { Logo } from './Logo';
import type { GameMode } from '../types';
import { GAME_DURATION_OPTIONS } from '../store/gameSessionSlice';

interface GameStartProps {
  defaultGameMode: GameMode;
  isWarmingUp: boolean;
  warmupProgress: number;
  currentTheme: Theme;
  hasSavedGame: boolean;
  onStart: (gameMode: GameMode, initialCash: number, gameDuration: number | null) => Promise<void>;
  onThemeChange: (theme: Theme) => void;
  onContinueGame: () => void;
}

export const GameStart = ({ defaultGameMode, isWarmingUp, warmupProgress, currentTheme, hasSavedGame, onStart, onThemeChange, onContinueGame }: GameStartProps) => {
  const dispatch = useAppDispatch();
  const { t, i18n } = useTranslation();
  const [selectedStartMode, setSelectedStartMode] = useState<GameMode>(defaultGameMode);
  const [initialCash, setInitialCash] = useState<number>(CONFIG.initialCash);
  const [gameDuration, setGameDuration] = useState<number | null>(GAME_DURATION_OPTIONS[GAME_DURATION_OPTIONS.length - 1].cycles);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [durationOpen, setDurationOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const languageRef = useRef<HTMLDivElement>(null);
  const durationRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useClickOutside(languageRef, useCallback(() => setLanguageOpen(false), []));
  useClickOutside(durationRef, useCallback(() => setDurationOpen(false), []));

  // Use ALL_LANGUAGES to also show short for hidden Latin Easter Egg
  const currentLang = ALL_LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];

  const handleLanguageSelect = (code: Language): void => {
    dispatch(setLanguage(code));
    setStoredLanguage(code);
    setLanguageOpen(false);
  };

  const handleStartGame = async (): Promise<void> => {
    await onStart(selectedStartMode, initialCash, gameDuration);
  };

  const handleDurationSelect = (cycles: number | null): void => {
    setGameDuration(cycles);
    setDurationOpen(false);
  };

  // Get current duration label
  const currentDuration = GAME_DURATION_OPTIONS.find(opt => opt.cycles === gameDuration) || GAME_DURATION_OPTIONS[GAME_DURATION_OPTIONS.length - 1];

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
          {currentTheme !== 'medieval' && (
            <button
              className="game-start__theme-toggle"
              type="button"
              title={t('settings.theme')}
              aria-label={t('settings.theme')}
              aria-pressed={currentTheme === 'dark'}
              onClick={() => onThemeChange(currentTheme === 'dark' ? 'light' : 'dark')}
            >
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                className={`game-start__theme-icon game-start__theme-icon--light${currentTheme === 'light' ? ' game-start__theme-icon--active' : ''}`}
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
                className={`game-start__theme-icon game-start__theme-icon--dark${currentTheme === 'dark' ? ' game-start__theme-icon--active' : ''}`}
              >
                <path
                  fill="currentColor"
                  d="M9.37,5.51C9.19,6.15,9.1,6.82,9.1,7.5c0,4.08,3.32,7.4,7.4,7.4c0.68,0,1.35-0.09,1.99-0.27C17.45,17.19,14.93,19,12,19 c-3.86,0-7-3.14-7-7C5,9.07,6.81,6.55,9.37,5.51z M12,3c-4.97,0-9,4.03-9,9s4.03,9,9,9s9-4.03,9-9c0-0.46-0.04-0.92-0.1-1.36 c-0.98,1.37-2.58,2.26-4.4,2.26c-2.98,0-5.4-2.42-5.4-5.4c0-1.81,0.89-3.42,2.26-4.4C12.92,3.04,12.46,3,12,3L12,3z"
                />
              </svg>
            </button>
          )}
          {i18n.language !== 'la' && (
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
          )}
        </div>
        <div className="game-start__logo">
          <Logo className="game-start__logo-icon" />
          <span>D-GRE Stock Exchange</span>
        </div>
        {isWarmingUp ? (
          <div className="game-start__progress">
            <CircularTimer
              progress={warmupProgress}
              size={80}
              strokeWidth={6}
              counterClockwise={false}
              centerText={`${warmupProgress}%`}
              className="game-start__progress-timer"
            />
            <span className="game-start__progress-label">{t('game.preparingMarket')}</span>
          </div>
        ) : (
          <>
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
            <div className="game-start__capital">
              <label className="game-start__capital-label" htmlFor="starting-capital">
                {t('game.startingCapital')}
              </label>
              <div className="game-start__capital-input-wrapper">
                <span className="game-start__capital-currency">$</span>
                <input
                  type="number"
                  id="starting-capital"
                  className="game-start__capital-input"
                  value={initialCash}
                  onChange={handleCashChange}
                  min={1000}
                  step={1000}
                />
              </div>
            </div>
            <div className="game-start__duration">
              <span className="game-start__duration-label">
                {t('gameStart.duration')}
              </span>
              <div className="game-start__duration-dropdown" ref={durationRef}>
                <button
                  type="button"
                  className={`game-start__duration-toggle${durationOpen ? ' game-start__duration-toggle--open' : ''}`}
                  onClick={() => setDurationOpen(!durationOpen)}
                  aria-label={t('gameStart.duration')}
                >
                  <span>{t(currentDuration.labelKey)}</span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7 10l5 5 5-5z" />
                  </svg>
                </button>
                {durationOpen && (
                  <div className="game-start__duration-options">
                    {GAME_DURATION_OPTIONS.map((option) => (
                      <button
                        key={option.cycles === null ? 'null' : option.cycles}
                        type="button"
                        className={`game-start__duration-option${option.cycles === gameDuration ? ' game-start__duration-option--active' : ''}`}
                        onClick={() => handleDurationSelect(option.cycles)}
                      >
                        {t(option.labelKey)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="game-start__actions">
              {hasSavedGame && (
                <button className="game-start__button game-start__button--continue" onClick={onContinueGame}>
                  {t('game.continueGame')}
                </button>
              )}
              <button className="game-start__button" onClick={handleStartGame}>
                {hasSavedGame ? t('game.newGame') : t('game.start')}
              </button>
            </div>
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

      {showHelp && <Help onClose={() => setShowHelp(false)} />}
    </div>
  );
};

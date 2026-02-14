import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Theme } from '../hooks/useTheme';
import { useClickOutside } from '../hooks/useClickOutside';
import { LANGUAGES, ALL_LANGUAGES, type Language } from '../i18n';

interface SettingsSidebarProps {
  currentTheme: Theme;
  currentLanguage: Language;
  hasSavedGame: boolean;
  onClose: () => void;
  onThemeChange: (theme: Theme) => void;
  onLanguageChange: (language: Language) => void;
  onResetGame: () => void;
  onSaveGame: () => void;
  onLoadGame: () => void;
}

export const SettingsSidebar = ({
  currentTheme,
  currentLanguage,
  hasSavedGame,
  onClose,
  onThemeChange,
  onLanguageChange,
  onResetGame,
  onSaveGame,
  onLoadGame,
}: SettingsSidebarProps) => {
  const { t } = useTranslation();
  const [languageOpen, setLanguageOpen] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const languageRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useClickOutside(languageRef, useCallback(() => setLanguageOpen(false), []));

  // Close sidebar when clicking on overlay
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Use ALL_LANGUAGES to also find hidden Latin Easter Egg
  const currentLang = ALL_LANGUAGES.find(l => l.code === currentLanguage);

  const handleLanguageSelect = (code: Language): void => {
    onLanguageChange(code);
    setLanguageOpen(false);
  };

  const handleResetClick = (): void => {
    setShowResetConfirm(true);
  };

  const handleResetConfirm = (): void => {
    onResetGame();
    onClose();
  };

  const handleResetCancel = (): void => {
    setShowResetConfirm(false);
  };

  const handleSaveGame = (): void => {
    onSaveGame();
    onClose();
  };

  const handleLoadGame = (): void => {
    onLoadGame();
    onClose();
  };

  return (
    <div className="settings-sidebar__overlay" onClick={handleOverlayClick}>
      <div className="settings-sidebar" ref={sidebarRef}>
        <div className="settings-sidebar__header">
          <button className="settings-sidebar__close-btn" onClick={onClose} aria-label={t('common.close')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="settings-sidebar__body">
          {/* Settings Section */}
          <section className="settings-sidebar__section">
            <h3 className="settings-sidebar__section-title">{t('settings.settings')}</h3>

            {currentLanguage !== 'la' && (
              <div className="settings-sidebar__input-group">
                <label>{t('settings.language')}</label>
                <div className="settings-sidebar__language" ref={languageRef}>
                  <button
                    type="button"
                    className={`settings-sidebar__language-trigger${languageOpen ? ' settings-sidebar__language-trigger--open' : ''}`}
                    onClick={() => setLanguageOpen(!languageOpen)}
                  >
                    <span>{currentLang?.name}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7 10l5 5 5-5z"/>
                    </svg>
                  </button>
                  {languageOpen && (
                    <div className="settings-sidebar__language-options">
                      {LANGUAGES.map((lang) => (
                        <button
                          key={lang.code}
                          type="button"
                          className={`settings-sidebar__language-option${lang.code === currentLanguage ? ' settings-sidebar__language-option--active' : ''}`}
                          onClick={() => handleLanguageSelect(lang.code)}
                        >
                          {lang.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentTheme !== 'medieval' && (
              <div className="settings-sidebar__input-group">
                <label>{t('settings.appearance')}</label>
                <div className="settings-sidebar__theme-selector">
                  <button
                    type="button"
                    className={`settings-sidebar__theme-option${currentTheme === 'dark' ? ' settings-sidebar__theme-option--active' : ''}`}
                    onClick={() => onThemeChange('dark')}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
                    </svg>
                    <span>{t('settings.dark')}</span>
                  </button>
                  <button
                    type="button"
                    className={`settings-sidebar__theme-option${currentTheme === 'light' ? ' settings-sidebar__theme-option--active' : ''}`}
                    onClick={() => onThemeChange('light')}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="4"/>
                      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                    </svg>
                    <span>{t('settings.light')}</span>
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Game Controls Section */}
          <section className="settings-sidebar__section">
            <h3 className="settings-sidebar__section-title">{t('settings.gameControls')}</h3>

            <div className="settings-sidebar__button-group">
              <button
                type="button"
                className="settings-sidebar__action-btn settings-sidebar__action-btn--save"
                onClick={handleSaveGame}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                  <polyline points="7 3 7 8 15 8"/>
                </svg>
                {t('settings.saveGame')}
              </button>

              {hasSavedGame && (
                <button
                  type="button"
                  className="settings-sidebar__action-btn settings-sidebar__action-btn--load"
                  onClick={handleLoadGame}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                  </svg>
                  {t('settings.loadGame')}
                </button>
              )}
            </div>

            <div className="settings-sidebar__reset-section">
              {!showResetConfirm ? (
                <button
                  type="button"
                  className="settings-sidebar__action-btn settings-sidebar__action-btn--reset"
                  onClick={handleResetClick}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                    <path d="M3 3v5h5"/>
                  </svg>
                  {t('settings.resetGame')}
                </button>
              ) : (
                <div className="settings-sidebar__reset-confirm">
                  <p className="settings-sidebar__reset-message">{t('settings.resetGameConfirm')}</p>
                  <div className="settings-sidebar__reset-actions">
                    <button
                      type="button"
                      className="settings-sidebar__reset-cancel"
                      onClick={handleResetCancel}
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="button"
                      className="settings-sidebar__reset-confirm-btn"
                      onClick={handleResetConfirm}
                    >
                      {t('settings.resetGame')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="settings-sidebar__footer">
          <button
            type="button"
            className="settings-sidebar__footer-close-btn"
            onClick={onClose}
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

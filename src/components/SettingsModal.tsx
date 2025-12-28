import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Theme } from '../hooks/useTheme';
import { useClickOutside } from '../hooks/useClickOutside';
import { LANGUAGES, ALL_LANGUAGES, type Language } from '../i18n';

interface SettingsModalProps {
  currentInterval: number;
  currentTheme: Theme;
  currentLanguage: Language;
  onClose: () => void;
  onSave: (intervalSeconds: number) => void;
  onThemeChange: (theme: Theme) => void;
  onLanguageChange: (language: Language) => void;
}

export const SettingsModal = ({
  currentInterval,
  currentTheme,
  currentLanguage,
  onClose,
  onSave,
  onThemeChange,
  onLanguageChange,
}: SettingsModalProps) => {
  const { t } = useTranslation();
  const [seconds, setSeconds] = useState(currentInterval);
  const [languageOpen, setLanguageOpen] = useState(false);
  const languageRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useClickOutside(languageRef, useCallback(() => setLanguageOpen(false), []));

  // Use ALL_LANGUAGES to also find hidden Latin Easter Egg
  const currentLang = ALL_LANGUAGES.find(l => l.code === currentLanguage);

  const handleLanguageSelect = (code: Language): void => {
    onLanguageChange(code);
    setLanguageOpen(false);
  };

  const handleSubmit = (): void => {
    if (seconds >= 1) {
      onSave(seconds);
      onClose();
    }
  };

  return (
    <div className="settings-modal__overlay">
      <div className="settings-modal">
        <div className="settings-modal__header">
          <h2>{t('settings.title')}</h2>
          <button className="settings-modal__close-btn" onClick={onClose}>×</button>
        </div>
        <div className="settings-modal__body">
          <div className="settings-modal__input-group">
            <label>{t('settings.language')}</label>
            <div className="settings-modal__language" ref={languageRef}>
              <button
                type="button"
                className={`settings-modal__language-trigger${languageOpen ? ' settings-modal__language-trigger--open' : ''}`}
                onClick={() => setLanguageOpen(!languageOpen)}
              >
                <span>{currentLang?.name}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 10l5 5 5-5z"/>
                </svg>
              </button>
              {languageOpen && (
                <div className="settings-modal__language-options">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      className={`settings-modal__language-option${lang.code === currentLanguage ? ' settings-modal__language-option--active' : ''}`}
                      onClick={() => handleLanguageSelect(lang.code)}
                    >
                      {lang.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="settings-modal__input-group">
            <label>{t('settings.appearance')}</label>
            <div className="settings-modal__theme-selector">
              <button
                type="button"
                className={`settings-modal__theme-option${currentTheme === 'dark' ? ' settings-modal__theme-option--active' : ''}`}
                onClick={() => onThemeChange('dark')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
                </svg>
                <span>{t('settings.dark')}</span>
              </button>
              <button
                type="button"
                className={`settings-modal__theme-option${currentTheme === 'light' ? ' settings-modal__theme-option--active' : ''}`}
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
          <div className="settings-modal__input-group">
            <label htmlFor="interval">{t('settings.updateInterval')}</label>
            <input
              id="interval"
              type="number"
              min="1"
              value={seconds}
              onChange={e => setSeconds(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>
        </div>
        <div className="settings-modal__footer">
          <button className="settings-modal__cancel-btn" onClick={onClose}>{t('common.cancel')}</button>
          <button className="settings-modal__confirm-btn" onClick={handleSubmit}>{t('common.save')}</button>
        </div>
      </div>
    </div>
  );
}

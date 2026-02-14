import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsSidebar } from './SettingsSidebar';
import type { Theme } from '../hooks/useTheme';
import type { Language } from '../i18n';

describe('SettingsSidebar', () => {
  const mockOnClose = vi.fn();
  const mockOnThemeChange = vi.fn();
  const mockOnLanguageChange = vi.fn();
  const mockOnResetGame = vi.fn();
  const mockOnSaveGame = vi.fn();
  const mockOnLoadGame = vi.fn();

  const defaultProps = {
    currentTheme: 'dark' as Theme,
    currentLanguage: 'de' as Language,
    hasSavedGame: false,
    onClose: mockOnClose,
    onThemeChange: mockOnThemeChange,
    onLanguageChange: mockOnLanguageChange,
    onResetGame: mockOnResetGame,
    onSaveGame: mockOnSaveGame,
    onLoadGame: mockOnLoadGame,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should display theme selector', () => {
      render(<SettingsSidebar {...defaultProps} />);

      expect(screen.getByText('Erscheinungsbild')).toBeInTheDocument();
      expect(screen.getByText('Dunkel')).toBeInTheDocument();
      expect(screen.getByText('Hell')).toBeInTheDocument();
    });

    it('should show dark theme as active when currentTheme is dark', () => {
      render(<SettingsSidebar {...defaultProps} currentTheme="dark" />);

      const darkOption = screen.getByText('Dunkel').closest('button');
      expect(darkOption).toHaveClass('settings-sidebar__theme-option--active');
    });

    it('should show light theme as active when currentTheme is light', () => {
      render(<SettingsSidebar {...defaultProps} currentTheme="light" />);

      const lightOption = screen.getByText('Hell').closest('button');
      expect(lightOption).toHaveClass('settings-sidebar__theme-option--active');
    });

    it('should display settings section title', () => {
      render(<SettingsSidebar {...defaultProps} />);

      const sectionTitles = screen.getAllByText('Einstellungen');
      expect(sectionTitles.length).toBe(1); // Header h2 and section h3
    });

    it('should display game controls section title', () => {
      render(<SettingsSidebar {...defaultProps} />);

      expect(screen.getByText('Spielstand')).toBeInTheDocument();
    });

    it('should display footer close button', () => {
      render(<SettingsSidebar {...defaultProps} />);

      const footerCloseButton = document.querySelector('.settings-sidebar__footer-close-btn');
      expect(footerCloseButton).toBeInTheDocument();
    });
  });

  describe('close button', () => {
    it('should call onClose when clicking header close button', () => {
      render(<SettingsSidebar {...defaultProps} />);

      const closeButton = document.querySelector('.settings-sidebar__close-btn');
      fireEvent.click(closeButton!);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onClose when clicking footer close button', () => {
      render(<SettingsSidebar {...defaultProps} />);

      const footerCloseButton = document.querySelector('.settings-sidebar__footer-close-btn');
      fireEvent.click(footerCloseButton!);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onClose when clicking overlay', () => {
      render(<SettingsSidebar {...defaultProps} />);

      const overlay = document.querySelector('.settings-sidebar__overlay');
      fireEvent.click(overlay!);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('theme change', () => {
    it('should call onThemeChange when clicking light theme option', () => {
      render(<SettingsSidebar {...defaultProps} currentTheme="dark" />);

      const lightOption = screen.getByText('Hell').closest('button');
      fireEvent.click(lightOption!);

      expect(mockOnThemeChange).toHaveBeenCalledWith('light');
    });

    it('should call onThemeChange with dark when clicking dark option', () => {
      render(<SettingsSidebar {...defaultProps} currentTheme="light" />);

      const darkOption = screen.getByText('Dunkel').closest('button');
      fireEvent.click(darkOption!);

      expect(mockOnThemeChange).toHaveBeenCalledWith('dark');
    });
  });

  describe('language change', () => {
    it('should display current language in trigger', () => {
      render(<SettingsSidebar {...defaultProps} currentLanguage="de" />);

      expect(screen.getByText('Deutsch')).toBeInTheDocument();
    });

    it('should open language dropdown when clicking trigger', () => {
      render(<SettingsSidebar {...defaultProps} />);

      const trigger = screen.getByText('Deutsch').closest('button');
      fireEvent.click(trigger!);

      expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument();
    });

    it('should call onLanguageChange when selecting a language', () => {
      render(<SettingsSidebar {...defaultProps} currentLanguage="de" />);

      const trigger = screen.getByText('Deutsch').closest('button');
      fireEvent.click(trigger!);

      const englishOption = screen.getByRole('button', { name: 'English' });
      fireEvent.click(englishOption);

      expect(mockOnLanguageChange).toHaveBeenCalledWith('en');
    });

    it('should close dropdown after selecting a language', () => {
      render(<SettingsSidebar {...defaultProps} currentLanguage="de" />);

      const trigger = screen.getByText('Deutsch').closest('button');
      fireEvent.click(trigger!);

      const englishOption = screen.getByRole('button', { name: 'English' });
      fireEvent.click(englishOption);

      // Dropdown should be closed, so English option button should not be visible
      expect(screen.queryByRole('button', { name: 'English' })).not.toBeInTheDocument();
    });

    it('should display Japanese language option', () => {
      render(<SettingsSidebar {...defaultProps} />);

      const trigger = screen.getByText('Deutsch').closest('button');
      fireEvent.click(trigger!);

      expect(screen.getByRole('button', { name: '日本語' })).toBeInTheDocument();
    });
  });

  describe('save game', () => {
    it('should display save game button', () => {
      render(<SettingsSidebar {...defaultProps} />);

      expect(screen.getByText('Spiel speichern')).toBeInTheDocument();
    });

    it('should call onSaveGame when clicking save button', () => {
      render(<SettingsSidebar {...defaultProps} />);

      const saveButton = screen.getByText('Spiel speichern');
      fireEvent.click(saveButton);

      expect(mockOnSaveGame).toHaveBeenCalled();
    });

    it('should close sidebar after saving', () => {
      render(<SettingsSidebar {...defaultProps} />);

      const saveButton = screen.getByText('Spiel speichern');
      fireEvent.click(saveButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('load game', () => {
    it('should not display load game button when no saved game exists', () => {
      render(<SettingsSidebar {...defaultProps} hasSavedGame={false} />);

      expect(screen.queryByText('Spiel laden')).not.toBeInTheDocument();
    });

    it('should display load game button when saved game exists', () => {
      render(<SettingsSidebar {...defaultProps} hasSavedGame={true} />);

      expect(screen.getByText('Spiel laden')).toBeInTheDocument();
    });

    it('should call onLoadGame when clicking load button', () => {
      render(<SettingsSidebar {...defaultProps} hasSavedGame={true} />);

      const loadButton = screen.getByText('Spiel laden');
      fireEvent.click(loadButton);

      expect(mockOnLoadGame).toHaveBeenCalled();
    });

    it('should close sidebar after loading', () => {
      render(<SettingsSidebar {...defaultProps} hasSavedGame={true} />);

      const loadButton = screen.getByText('Spiel laden');
      fireEvent.click(loadButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('reset game', () => {
    it('should display reset game button', () => {
      render(<SettingsSidebar {...defaultProps} />);

      expect(screen.getByText('Neues Spiel starten')).toBeInTheDocument();
    });

    it('should show confirmation dialog when clicking reset button', () => {
      render(<SettingsSidebar {...defaultProps} />);

      const resetButton = screen.getByText('Neues Spiel starten');
      fireEvent.click(resetButton);

      expect(screen.getByText('Sind Sie sicher, dass Sie ein neues Spiel starten möchten? Alle Spielfortschritte gehen verloren.')).toBeInTheDocument();
      expect(screen.getByText('Abbrechen')).toBeInTheDocument();
    });

    it('should hide confirmation dialog when clicking cancel', () => {
      render(<SettingsSidebar {...defaultProps} />);

      const resetButton = screen.getByText('Neues Spiel starten');
      fireEvent.click(resetButton);

      const cancelButton = screen.getByText('Abbrechen');
      fireEvent.click(cancelButton);

      expect(screen.queryByText('Sind Sie sicher, dass Sie ein neues Spiel starten möchten? Alle Spielfortschritte gehen verloren.')).not.toBeInTheDocument();
    });

    it('should call onResetGame and onClose when confirming reset', () => {
      render(<SettingsSidebar {...defaultProps} />);

      const resetButton = screen.getByText('Neues Spiel starten');
      fireEvent.click(resetButton);

      // Click the confirm button (second "Neues Spiel starten" button in the confirmation dialog)
      const confirmButtons = screen.getAllByText('Neues Spiel starten');
      fireEvent.click(confirmButtons[0]); // The button in the confirmation dialog

      expect(mockOnResetGame).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should not call onResetGame when canceling', () => {
      render(<SettingsSidebar {...defaultProps} />);

      const resetButton = screen.getByText('Neues Spiel starten');
      fireEvent.click(resetButton);

      const cancelButton = screen.getByText('Abbrechen');
      fireEvent.click(cancelButton);

      expect(mockOnResetGame).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('should have aria-label on header close button', () => {
      render(<SettingsSidebar {...defaultProps} />);

      const closeButton = document.querySelector('.settings-sidebar__close-btn');
      expect(closeButton).toHaveAttribute('aria-label', 'Schließen');
    });
  });
});

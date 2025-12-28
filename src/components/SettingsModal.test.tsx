import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsModal } from './SettingsModal';
import type { Theme } from '../hooks/useTheme';
import type { Language } from '../i18n';

describe('SettingsModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();
  const mockOnThemeChange = vi.fn();
  const mockOnLanguageChange = vi.fn();

  const defaultProps = {
    currentInterval: 30,
    currentTheme: 'dark' as Theme,
    currentLanguage: 'de' as Language,
    onClose: mockOnClose,
    onSave: mockOnSave,
    onThemeChange: mockOnThemeChange,
    onLanguageChange: mockOnLanguageChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render with correct title', () => {
      render(<SettingsModal {...defaultProps} />);

      expect(screen.getByText('Einstellungen')).toBeInTheDocument();
    });

    it('should display the current interval value', () => {
      render(<SettingsModal {...defaultProps} />);

      const input = screen.getByLabelText('Update-Intervall (Sekunden)') as HTMLInputElement;
      expect(input.value).toBe('30');
    });

    it('should display different interval values', () => {
      render(<SettingsModal {...defaultProps} currentInterval={60} />);

      const input = screen.getByLabelText('Update-Intervall (Sekunden)') as HTMLInputElement;
      expect(input.value).toBe('60');
    });

    it('should display theme selector', () => {
      render(<SettingsModal {...defaultProps} />);

      expect(screen.getByText('Erscheinungsbild')).toBeInTheDocument();
      expect(screen.getByText('Dunkel')).toBeInTheDocument();
      expect(screen.getByText('Hell')).toBeInTheDocument();
    });

    it('should show dark theme as active when currentTheme is dark', () => {
      render(<SettingsModal {...defaultProps} currentTheme="dark" />);

      const darkOption = screen.getByText('Dunkel').closest('button');
      expect(darkOption).toHaveClass('settings-modal__theme-option--active');
    });

    it('should show light theme as active when currentTheme is light', () => {
      render(<SettingsModal {...defaultProps} currentTheme="light" />);

      const lightOption = screen.getByText('Hell').closest('button');
      expect(lightOption).toHaveClass('settings-modal__theme-option--active');
    });
  });

  describe('interactions', () => {
    it('should call onClose when clicking close button', () => {
      render(<SettingsModal {...defaultProps} />);

      fireEvent.click(screen.getByText('×'));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onClose when clicking cancel button', () => {
      render(<SettingsModal {...defaultProps} />);

      fireEvent.click(screen.getByText('Abbrechen'));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should not close when clicking overlay', () => {
      render(<SettingsModal {...defaultProps} />);

      fireEvent.click(screen.getByText('Speichern').closest('.settings-modal__overlay')!);
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should update interval input value when typing', () => {
      render(<SettingsModal {...defaultProps} />);

      const input = screen.getByLabelText('Update-Intervall (Sekunden)');
      fireEvent.change(input, { target: { value: '45' } });

      expect(input).toHaveValue(45);
    });

    it('should call onThemeChange when clicking theme option', () => {
      render(<SettingsModal {...defaultProps} currentTheme="dark" />);

      const lightOption = screen.getByText('Hell').closest('button');
      fireEvent.click(lightOption!);

      expect(mockOnThemeChange).toHaveBeenCalledWith('light');
    });

    it('should call onThemeChange with dark when clicking dark option', () => {
      render(<SettingsModal {...defaultProps} currentTheme="light" />);

      const darkOption = screen.getByText('Dunkel').closest('button');
      fireEvent.click(darkOption!);

      expect(mockOnThemeChange).toHaveBeenCalledWith('dark');
    });

    it('should display current language in trigger', () => {
      render(<SettingsModal {...defaultProps} currentLanguage="de" />);

      expect(screen.getByText(/Deutsch/)).toBeInTheDocument();
    });

    it('should open language dropdown when clicking trigger', () => {
      render(<SettingsModal {...defaultProps} />);

      const trigger = screen.getByText(/Deutsch/).closest('button');
      fireEvent.click(trigger!);

      expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument();
    });

    it('should call onLanguageChange when selecting a language', () => {
      render(<SettingsModal {...defaultProps} currentLanguage="de" />);

      const trigger = screen.getByText(/Deutsch/).closest('button');
      fireEvent.click(trigger!);

      const englishOption = screen.getByRole('button', { name: 'English' });
      fireEvent.click(englishOption);

      expect(mockOnLanguageChange).toHaveBeenCalledWith('en');
    });

    it('should close dropdown after selecting a language', () => {
      render(<SettingsModal {...defaultProps} currentLanguage="de" />);

      const trigger = screen.getByText(/Deutsch/).closest('button');
      fireEvent.click(trigger!);

      const englishOption = screen.getByRole('button', { name: 'English' });
      fireEvent.click(englishOption);

      // Dropdown should be closed, so English option button should not be visible
      expect(screen.queryByRole('button', { name: 'English' })).not.toBeInTheDocument();
    });
  });

  describe('saving', () => {
    it('should call onSave and onClose with new values when clicking save', () => {
      render(<SettingsModal {...defaultProps} />);

      const intervalInput = screen.getByLabelText('Update-Intervall (Sekunden)');
      fireEvent.change(intervalInput, { target: { value: '45' } });

      fireEvent.click(screen.getByText('Speichern'));

      expect(mockOnSave).toHaveBeenCalledWith(45);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should save unchanged values when clicking save without modification', () => {
      render(<SettingsModal {...defaultProps} />);

      fireEvent.click(screen.getByText('Speichern'));

      expect(mockOnSave).toHaveBeenCalledWith(30);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    it('should enforce minimum interval value of 1', () => {
      render(<SettingsModal {...defaultProps} />);

      const input = screen.getByLabelText('Update-Intervall (Sekunden)');
      fireEvent.change(input, { target: { value: '0' } });

      // Should be corrected to 1
      expect(input).toHaveValue(1);
    });

    it('should save minimum interval value of 1 when input is invalid', () => {
      render(<SettingsModal {...defaultProps} />);

      const input = screen.getByLabelText('Update-Intervall (Sekunden)');
      fireEvent.change(input, { target: { value: '-5' } });

      fireEvent.click(screen.getByText('Speichern'));

      expect(mockOnSave).toHaveBeenCalledWith(1);
    });
  });
});

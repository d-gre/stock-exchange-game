import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { GameStart } from './GameStart';
import { CONFIG } from '../config';

// Mock useTheme hook
const mockToggleTheme = vi.fn();
vi.mock('../hooks/useTheme', () => ({
  useTheme: () => ({
    theme: 'dark',
    toggleTheme: mockToggleTheme,
  }),
}));

// Mock i18n
const mockSetStoredLanguage = vi.fn();
vi.mock('../i18n', () => ({
  LANGUAGES: [
    { code: 'de', name: 'Deutsch', short: 'DE' },
    { code: 'en', name: 'English', short: 'EN' },
    { code: 'ja', name: '日本語', short: '日本' },
  ],
  ALL_LANGUAGES: [
    { code: 'de', name: 'Deutsch', short: 'DE' },
    { code: 'en', name: 'English', short: 'EN' },
    { code: 'ja', name: '日本語', short: '日本' },
    { code: 'la', name: 'Latina', short: 'LA' },
  ],
  setStoredLanguage: (lang: string) => mockSetStoredLanguage(lang),
}));

// Mock Redux hooks
const mockDispatch = vi.fn();
vi.mock('../store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
}));

vi.mock('../store/settingsSlice', () => ({
  setLanguage: (lang: string) => ({ type: 'settings/setLanguage', payload: lang }),
}));

describe('GameStart', () => {
  const mockOnStart = vi.fn();
  const defaultProps = {
    defaultGameMode: 'realLife' as const,
    isWarmingUp: false,
    warmupProgress: 0,
    onStart: mockOnStart,
  };

  beforeEach(() => {
    mockOnStart.mockClear();
    mockToggleTheme.mockClear();
    mockSetStoredLanguage.mockClear();
    mockDispatch.mockClear();
    // Reset language to German before each test
    i18n.changeLanguage('de');
  });

  describe('rendering', () => {
    it('should render the logo and title', () => {
      render(<GameStart {...defaultProps} />);

      expect(screen.getByText('D-GRE Stock Exchange')).toBeInTheDocument();
      expect(screen.getByAltText('Logo')).toBeInTheDocument();
    });

    it('should render starting capital input with default value', () => {
      render(<GameStart {...defaultProps} />);

      const input = screen.getByRole('spinbutton');
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue(CONFIG.initialCash);
    });

    it('should render starting capital label', () => {
      render(<GameStart {...defaultProps} />);

      // Translation resolves to "Startkapital" in German
      expect(screen.getByText('Startkapital')).toBeInTheDocument();
    });

    it('should render the start button', () => {
      render(<GameStart {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Spiel starten' })).toBeInTheDocument();
    });

    it('should render the theme toggle button', () => {
      render(<GameStart {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'settings.theme' })).toBeInTheDocument();
    });

    it('should render the language dropdown', () => {
      render(<GameStart {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Sprache' })).toBeInTheDocument();
    });
  });

  describe('theme toggle', () => {
    it('should call toggleTheme when clicking the theme button', () => {
      render(<GameStart {...defaultProps} />);

      const themeButton = screen.getByRole('button', { name: 'settings.theme' });
      fireEvent.click(themeButton);

      expect(mockToggleTheme).toHaveBeenCalledTimes(1);
    });
  });

  describe('language dropdown', () => {
    it('should show language options when clicking the dropdown', () => {
      render(<GameStart {...defaultProps} />);

      const languageButton = screen.getByRole('button', { name: 'Sprache' });
      fireEvent.click(languageButton);

      // DE appears twice: in trigger and in options
      expect(screen.getAllByText('DE')).toHaveLength(2);
      expect(screen.getByText('EN')).toBeInTheDocument();
      expect(screen.getByText('日本')).toBeInTheDocument();
    });

    it('should change language when selecting an option', () => {
      render(<GameStart {...defaultProps} />);

      const languageButton = screen.getByRole('button', { name: 'Sprache' });
      fireEvent.click(languageButton);

      const enOption = screen.getByText('EN');
      fireEvent.click(enOption);

      expect(mockDispatch).toHaveBeenCalledWith({ type: 'settings/setLanguage', payload: 'en' });
      expect(mockSetStoredLanguage).toHaveBeenCalledWith('en');
    });

    it('should not show Latin in dropdown (Easter Egg)', () => {
      render(<GameStart {...defaultProps} />);

      const languageButton = screen.getByRole('button', { name: 'Sprache' });
      fireEvent.click(languageButton);

      expect(screen.queryByText('LA')).not.toBeInTheDocument();
    });
  });

  describe('starting capital input', () => {
    it('should allow changing the starting capital', () => {
      render(<GameStart {...defaultProps} />);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '50000' } });

      expect(input).toHaveValue(50000);
    });

    it('should not accept negative values', () => {
      render(<GameStart {...defaultProps} />);

      const input = screen.getByRole('spinbutton');
      const initialValue = CONFIG.initialCash;
      fireEvent.change(input, { target: { value: '-1000' } });

      // Should keep the previous value since -1000 is invalid
      expect(input).toHaveValue(initialValue);
    });

    it('should pass starting capital to onStart', async () => {
      mockOnStart.mockResolvedValue(undefined);
      render(<GameStart {...defaultProps} />);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '75000' } });

      const startButton = screen.getByRole('button', { name: 'Spiel starten' });
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(mockOnStart).toHaveBeenCalledWith('realLife', 75000);
      });
    });
  });

  describe('warmup progress', () => {
    it('should show progress pie when warming up', () => {
      render(<GameStart {...defaultProps} isWarmingUp={true} warmupProgress={50} />);

      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('should hide starting capital input during warmup', () => {
      render(<GameStart {...defaultProps} isWarmingUp={true} warmupProgress={0} />);

      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Spiel starten' })).not.toBeInTheDocument();
    });

    it('should call onStart with game mode and starting capital', async () => {
      mockOnStart.mockResolvedValue(undefined);
      render(<GameStart {...defaultProps} />);

      const startButton = screen.getByRole('button', { name: 'Spiel starten' });
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(mockOnStart).toHaveBeenCalledTimes(1);
        expect(mockOnStart).toHaveBeenCalledWith('realLife', CONFIG.initialCash);
      });
    });
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { GameStart } from './GameStart';
import { CONFIG } from '../config';

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

// Mock Help component
vi.mock('./Help', () => ({
  Help: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="help-modal">
      <button onClick={onClose}>Close Help</button>
    </div>
  ),
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
  const mockOnThemeChange = vi.fn();
  const mockOnContinueGame = vi.fn();
  const defaultProps = {
    defaultGameMode: 'realLife' as const,
    isWarmingUp: false,
    warmupProgress: 0,
    currentTheme: 'dark' as const,
    hasSavedGame: false,
    onStart: mockOnStart,
    onThemeChange: mockOnThemeChange,
    onContinueGame: mockOnContinueGame,
  };

  beforeEach(() => {
    mockOnStart.mockClear();
    mockOnThemeChange.mockClear();
    mockOnContinueGame.mockClear();
    mockSetStoredLanguage.mockClear();
    mockDispatch.mockClear();
    // Reset language to German before each test
    i18n.changeLanguage('de');
  });

  describe('rendering', () => {
    it('should render the logo and title', () => {
      const { container } = render(<GameStart {...defaultProps} />);

      expect(screen.getByText('D-GRE Stock Exchange')).toBeInTheDocument();
      expect(container.querySelector('.game-start__logo-icon')).toBeInTheDocument();
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

      expect(screen.getByRole('button', { name: 'Spiel beginnen' })).toBeInTheDocument();
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
    it('should call onThemeChange with light when current theme is dark', () => {
      render(<GameStart {...defaultProps} currentTheme="dark" />);

      const themeButton = screen.getByRole('button', { name: 'settings.theme' });
      fireEvent.click(themeButton);

      expect(mockOnThemeChange).toHaveBeenCalledTimes(1);
      expect(mockOnThemeChange).toHaveBeenCalledWith('light');
    });

    it('should call onThemeChange with dark when current theme is light', () => {
      render(<GameStart {...defaultProps} currentTheme="light" />);

      const themeButton = screen.getByRole('button', { name: 'settings.theme' });
      fireEvent.click(themeButton);

      expect(mockOnThemeChange).toHaveBeenCalledTimes(1);
      expect(mockOnThemeChange).toHaveBeenCalledWith('dark');
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

      const startButton = screen.getByRole('button', { name: 'Spiel beginnen' });
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(mockOnStart).toHaveBeenCalledWith('realLife', 75000, null);
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
      expect(screen.queryByRole('button', { name: 'Spiel beginnen' })).not.toBeInTheDocument();
    });

    it('should call onStart with game mode and starting capital', async () => {
      mockOnStart.mockResolvedValue(undefined);
      render(<GameStart {...defaultProps} />);

      const startButton = screen.getByRole('button', { name: 'Spiel beginnen' });
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(mockOnStart).toHaveBeenCalledTimes(1);
        expect(mockOnStart).toHaveBeenCalledWith('realLife', CONFIG.initialCash, null);
      });
    });
  });

  describe('duration dropdown', () => {
    it('should render the duration dropdown', () => {
      render(<GameStart {...defaultProps} />);

      // The dropdown shows the default duration label (unlimited is the last option and default)
      expect(screen.getByRole('button', { name: 'Spieldauer' })).toBeInTheDocument();
    });

    it('should open duration options when clicking the dropdown', () => {
      render(<GameStart {...defaultProps} />);

      const durationButton = screen.getByRole('button', { name: 'Spieldauer' });
      fireEvent.click(durationButton);

      // Should show all duration options (translated German labels)
      expect(screen.getByText('360 Runden (ca. 30 Min)')).toBeInTheDocument();
      expect(screen.getByText('240 Runden (ca. 20 Min)')).toBeInTheDocument();
      expect(screen.getByText('120 Runden (ca. 10 Min)')).toBeInTheDocument();
      expect(screen.getByText('60 Runden (ca. 5 Min)')).toBeInTheDocument();
      // Unlimited appears twice - in trigger button and in options
      expect(screen.getAllByText('zeitlich unbegrenzt')).toHaveLength(2);
    });

    it('should select a duration and close dropdown', () => {
      render(<GameStart {...defaultProps} />);

      // Open dropdown
      const durationButton = screen.getByRole('button', { name: 'Spieldauer' });
      fireEvent.click(durationButton);

      // Select 10 min option (120 cycles)
      const option10min = screen.getByText('120 Runden (ca. 10 Min)');
      fireEvent.click(option10min);

      // Dropdown should be closed (options no longer visible)
      expect(screen.queryByText('360 Runden (ca. 30 Min)')).not.toBeInTheDocument();
    });

    it('should pass selected duration to onStart', async () => {
      mockOnStart.mockResolvedValue(undefined);
      render(<GameStart {...defaultProps} />);

      // Open dropdown and select 5 min option (60 cycles)
      const durationButton = screen.getByRole('button', { name: 'Spieldauer' });
      fireEvent.click(durationButton);

      const option5min = screen.getByText('60 Runden (ca. 5 Min)');
      fireEvent.click(option5min);

      // Start the game
      const startButton = screen.getByRole('button', { name: 'Spiel beginnen' });
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(mockOnStart).toHaveBeenCalledWith('realLife', CONFIG.initialCash, 60);
      });
    });

    it('should toggle dropdown open and closed', () => {
      render(<GameStart {...defaultProps} />);

      const durationButton = screen.getByRole('button', { name: 'Spieldauer' });

      // Open
      fireEvent.click(durationButton);
      expect(screen.getByText('360 Runden (ca. 30 Min)')).toBeInTheDocument();

      // Close by clicking again
      fireEvent.click(durationButton);
      expect(screen.queryByText('360 Runden (ca. 30 Min)')).not.toBeInTheDocument();
    });

    it('should highlight the active duration option', () => {
      render(<GameStart {...defaultProps} />);

      const durationButton = screen.getByRole('button', { name: 'Spieldauer' });
      fireEvent.click(durationButton);

      // Default is unlimited (last option), so it should be active
      const unlimitedOptions = screen.getAllByText('zeitlich unbegrenzt');
      // The second one is in the dropdown options
      const optionInDropdown = unlimitedOptions[1];
      expect(optionInDropdown.closest('button')).toHaveClass('game-start__duration-option--active');
    });
  });

  describe('continue game', () => {
    it('should show continue button when saved game exists', () => {
      render(<GameStart {...defaultProps} hasSavedGame={true} />);

      expect(screen.getByRole('button', { name: 'Spiel fortsetzen' })).toBeInTheDocument();
    });

    it('should not show continue button when no saved game exists', () => {
      render(<GameStart {...defaultProps} hasSavedGame={false} />);

      expect(screen.queryByRole('button', { name: 'Spiel fortsetzen' })).not.toBeInTheDocument();
    });

    it('should call onContinueGame when continue button is clicked', () => {
      render(<GameStart {...defaultProps} hasSavedGame={true} />);

      const continueButton = screen.getByRole('button', { name: 'Spiel fortsetzen' });
      fireEvent.click(continueButton);

      expect(mockOnContinueGame).toHaveBeenCalledTimes(1);
    });

    it('should show "Neues Spiel" instead of "Spiel beginnen" when saved game exists', () => {
      render(<GameStart {...defaultProps} hasSavedGame={true} />);

      expect(screen.getByRole('button', { name: 'Neues Spiel' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Spiel beginnen' })).not.toBeInTheDocument();
    });
  });

  describe('help modal', () => {
    it('should render help link', () => {
      render(<GameStart {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Wie funktioniert das Spiel?' })).toBeInTheDocument();
    });

    it('should open help modal when clicking help link', () => {
      render(<GameStart {...defaultProps} />);

      const helpLink = screen.getByRole('button', { name: 'Wie funktioniert das Spiel?' });
      fireEvent.click(helpLink);

      expect(screen.getByTestId('help-modal')).toBeInTheDocument();
    });

    it('should close help modal when onClose is called', () => {
      render(<GameStart {...defaultProps} />);

      // Open help modal
      const helpLink = screen.getByRole('button', { name: 'Wie funktioniert das Spiel?' });
      fireEvent.click(helpLink);

      expect(screen.getByTestId('help-modal')).toBeInTheDocument();

      // Close help modal
      const closeButton = screen.getByRole('button', { name: 'Close Help' });
      fireEvent.click(closeButton);

      expect(screen.queryByTestId('help-modal')).not.toBeInTheDocument();
    });
  });

  describe('theme toggle visibility', () => {
    it('should hide theme toggle in medieval theme', () => {
      render(<GameStart {...defaultProps} currentTheme="medieval" />);

      expect(screen.queryByRole('button', { name: 'settings.theme' })).not.toBeInTheDocument();
    });

    it('should show theme toggle in dark theme', () => {
      render(<GameStart {...defaultProps} currentTheme="dark" />);

      expect(screen.getByRole('button', { name: 'settings.theme' })).toBeInTheDocument();
    });

    it('should show theme toggle in light theme', () => {
      render(<GameStart {...defaultProps} currentTheme="light" />);

      expect(screen.getByRole('button', { name: 'settings.theme' })).toBeInTheDocument();
    });
  });

  describe('language dropdown visibility', () => {
    it('should hide language dropdown when Latin is active', () => {
      // Set language to Latin
      i18n.changeLanguage('la');

      render(<GameStart {...defaultProps} />);

      expect(screen.queryByRole('button', { name: 'Sprache' })).not.toBeInTheDocument();
    });

    it('should show language dropdown when language is not Latin', () => {
      i18n.changeLanguage('de');

      render(<GameStart {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Sprache' })).toBeInTheDocument();
    });
  });

  describe('starting capital validation', () => {
    it('should not update when input is NaN', () => {
      render(<GameStart {...defaultProps} />);

      const input = screen.getByRole('spinbutton');
      const initialValue = CONFIG.initialCash;

      // Try to enter non-numeric value
      fireEvent.change(input, { target: { value: 'abc' } });

      // Should keep the previous value since 'abc' is NaN
      expect(input).toHaveValue(initialValue);
    });

    it('should accept zero as valid input', () => {
      render(<GameStart {...defaultProps} />);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '0' } });

      expect(input).toHaveValue(0);
    });

    it('should accept large numbers', () => {
      render(<GameStart {...defaultProps} />);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '1000000' } });

      expect(input).toHaveValue(1000000);
    });
  });
});

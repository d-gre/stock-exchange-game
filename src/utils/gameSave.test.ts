import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { hasSavedGame, getSavedGameInfo, saveGame, loadGame, deleteSavedGame } from './gameSave';
import type { RootState } from '../store';

const SAVE_KEY = 'stockExchange_savedGame';
const SAVE_VERSION = 3;

// Minimal mock state for testing
const createMockState = (): RootState => ({
  stocks: {
    stocks: [],
    dayIndex: 0,
    yearIndex: 0,
    lastUpdated: Date.now(),
  },
  portfolio: {
    cash: 10000,
    holdings: {},
  },
  virtualPlayers: {
    players: [],
    initialized: false,
  },
  settings: {
    gameMode: 'normal',
    updateInterval: 2000,
    virtualPlayerCount: 5,
    initialCash: 10000,
    speedMultiplier: 1,
    isPaused: false,
    countdown: 0,
    theme: 'dark',
    language: 'en',
  },
  pendingOrders: {
    orders: [],
  },
  tradeHistory: {
    trades: [],
    virtualPlayerTrades: [],
  },
  marketMaker: {
    inventory: {},
    lastUpdate: Date.now(),
  },
  sector: {
    sectorPerformance: {},
    sectorRotationTarget: null,
    rotationProgress: 0,
    lastRotation: 0,
  },
  loans: {
    currentLoan: null,
    loanHistory: [],
    cooldownUntil: null,
  },
  gameSession: {
    isActive: false,
    startTime: null,
    elapsedTime: 0,
    pausedTime: 0,
    lastTick: null,
  },
  marketPhase: {
    phase: 'pre-market',
    transitionProgress: 0,
    cycleCount: 0,
  },
  ui: {
    selectedStock: null,
    isTradeModalOpen: false,
    isSettingsOpen: false,
    isHelpOpen: false,
  },
  notifications: {
    notifications: [],
  },
  shortPositions: {
    positions: [],
    totalBorrowFeesPaid: 0,
    marginCallsReceived: 0,
    forcedCoversExecuted: 0,
    marginCallStatuses: [],
  },
  float: {
    floats: {},
  },
  orderBook: {
    books: {},
  },
} as unknown as RootState);

describe('gameSave utilities', () => {
  const mockLocalStorage: Record<string, string> = {};
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Mock localStorage
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(
      (key: string) => mockLocalStorage[key] ?? null
    );
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(
      (key: string, value: string) => {
        mockLocalStorage[key] = value;
      }
    );
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(
      (key: string) => {
        delete mockLocalStorage[key];
      }
    );

    // Mock console methods
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Clear mocks
    Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('hasSavedGame', () => {
    it('should return false when no saved game exists', () => {
      expect(hasSavedGame()).toBe(false);
    });

    it('should return true when a valid saved game exists', () => {
      mockLocalStorage[SAVE_KEY] = JSON.stringify({
        version: SAVE_VERSION,
        timestamp: Date.now(),
        state: { stocks: {} },
      });

      expect(hasSavedGame()).toBe(true);
    });

    it('should return false when saved game has wrong version', () => {
      mockLocalStorage[SAVE_KEY] = JSON.stringify({
        version: 1, // Old version
        timestamp: Date.now(),
        state: { stocks: {} },
      });

      expect(hasSavedGame()).toBe(false);
    });

    it('should return false when saved game has no state', () => {
      mockLocalStorage[SAVE_KEY] = JSON.stringify({
        version: SAVE_VERSION,
        timestamp: Date.now(),
        state: null,
      });

      expect(hasSavedGame()).toBe(false);
    });

    it('should return false when localStorage contains invalid JSON', () => {
      mockLocalStorage[SAVE_KEY] = 'not valid json';

      expect(hasSavedGame()).toBe(false);
    });
  });

  describe('getSavedGameInfo', () => {
    it('should return null when no saved game exists', () => {
      expect(getSavedGameInfo()).toBeNull();
    });

    it('should return timestamp when valid saved game exists', () => {
      const timestamp = Date.now();
      mockLocalStorage[SAVE_KEY] = JSON.stringify({
        version: SAVE_VERSION,
        timestamp,
        state: { stocks: {} },
      });

      expect(getSavedGameInfo()).toEqual({ timestamp });
    });

    it('should return null when saved game has wrong version', () => {
      mockLocalStorage[SAVE_KEY] = JSON.stringify({
        version: 1,
        timestamp: Date.now(),
        state: { stocks: {} },
      });

      expect(getSavedGameInfo()).toBeNull();
    });

    it('should return null when localStorage contains invalid JSON', () => {
      mockLocalStorage[SAVE_KEY] = '{invalid';

      expect(getSavedGameInfo()).toBeNull();
    });
  });

  describe('saveGame', () => {
    it('should save game state to localStorage', () => {
      const mockState = createMockState();

      const result = saveGame(mockState);

      expect(result).toBe(true);
      expect(localStorage.setItem).toHaveBeenCalledWith(
        SAVE_KEY,
        expect.any(String)
      );
    });

    it('should save with correct version', () => {
      const mockState = createMockState();

      saveGame(mockState);

      const saved = JSON.parse(mockLocalStorage[SAVE_KEY]);
      expect(saved.version).toBe(SAVE_VERSION);
    });

    it('should save with timestamp', () => {
      const mockState = createMockState();
      const beforeSave = Date.now();

      saveGame(mockState);

      const saved = JSON.parse(mockLocalStorage[SAVE_KEY]);
      expect(saved.timestamp).toBeGreaterThanOrEqual(beforeSave);
      expect(saved.timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('should save game-relevant settings only', () => {
      const mockState = createMockState();
      // Theme and language are not part of SettingsState, they use i18n directly

      saveGame(mockState);

      const saved = JSON.parse(mockLocalStorage[SAVE_KEY]);
      // Game settings should be saved
      expect(saved.state.settings.gameMode).toBe('normal');
      expect(saved.state.settings.isPaused).toBe(false);
    });

    it('should save all required state slices', () => {
      const mockState = createMockState();

      saveGame(mockState);

      const saved = JSON.parse(mockLocalStorage[SAVE_KEY]);
      expect(saved.state.stocks).toBeDefined();
      expect(saved.state.portfolio).toBeDefined();
      expect(saved.state.virtualPlayers).toBeDefined();
      expect(saved.state.pendingOrders).toBeDefined();
      expect(saved.state.tradeHistory).toBeDefined();
      expect(saved.state.marketMaker).toBeDefined();
      expect(saved.state.sector).toBeDefined();
      expect(saved.state.loans).toBeDefined();
      expect(saved.state.gameSession).toBeDefined();
      expect(saved.state.marketPhase).toBeDefined();
    });

    it('should return false when localStorage throws', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceeded');
      });

      const mockState = createMockState();
      const result = saveGame(mockState);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('loadGame', () => {
    it('should return null when no saved game exists', () => {
      expect(loadGame()).toBeNull();
    });

    it('should return saved state when valid', () => {
      const mockState = createMockState();
      saveGame(mockState);

      const loaded = loadGame();

      expect(loaded).not.toBeNull();
      expect(loaded?.stocks).toEqual(mockState.stocks);
      expect(loaded?.portfolio).toEqual(mockState.portfolio);
    });

    it('should return null when version mismatch', () => {
      mockLocalStorage[SAVE_KEY] = JSON.stringify({
        version: 1,
        timestamp: Date.now(),
        state: { stocks: {} },
      });

      const loaded = loadGame();

      expect(loaded).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Saved game version mismatch, cannot load'
      );
    });

    it('should return null when localStorage contains invalid JSON', () => {
      mockLocalStorage[SAVE_KEY] = 'corrupted data';

      const loaded = loadGame();

      expect(loaded).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('deleteSavedGame', () => {
    it('should remove saved game from localStorage', () => {
      mockLocalStorage[SAVE_KEY] = JSON.stringify({
        version: SAVE_VERSION,
        timestamp: Date.now(),
        state: {},
      });

      deleteSavedGame();

      expect(localStorage.removeItem).toHaveBeenCalledWith(SAVE_KEY);
      expect(mockLocalStorage[SAVE_KEY]).toBeUndefined();
    });

    it('should not throw when no saved game exists', () => {
      expect(() => deleteSavedGame()).not.toThrow();
    });

    it('should log error when removeItem throws', () => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('Storage error');
      });

      deleteSavedGame();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to delete saved game:',
        expect.any(Error)
      );
    });
  });

  describe('save and load roundtrip', () => {
    it('should preserve all state through save/load cycle', () => {
      const mockState = createMockState();
      mockState.portfolio.cash = 50000;
      mockState.portfolio.holdings = [
        { symbol: 'AAPL', shares: 100, avgBuyPrice: 150 },
        { symbol: 'GOOGL', shares: 50, avgBuyPrice: 100 },
      ];
      mockState.settings.isPaused = true;
      mockState.settings.speedMultiplier = 2;

      saveGame(mockState);
      const loaded = loadGame();

      expect(loaded?.portfolio.cash).toBe(50000);
      expect(loaded?.portfolio.holdings).toEqual([
        { symbol: 'AAPL', shares: 100, avgBuyPrice: 150 },
        { symbol: 'GOOGL', shares: 50, avgBuyPrice: 100 },
      ]);
      expect(loaded?.settings.isPaused).toBe(true);
      expect(loaded?.settings.speedMultiplier).toBe(2);
    });

    it('should handle multiple save/load cycles', () => {
      const mockState = createMockState();

      // First save
      mockState.portfolio.cash = 10000;
      saveGame(mockState);
      expect(loadGame()?.portfolio.cash).toBe(10000);

      // Second save with different value
      mockState.portfolio.cash = 20000;
      saveGame(mockState);
      expect(loadGame()?.portfolio.cash).toBe(20000);

      // Delete and verify
      deleteSavedGame();
      expect(loadGame()).toBeNull();
      expect(hasSavedGame()).toBe(false);
    });
  });
});

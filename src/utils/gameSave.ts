/**
 * Game Save/Load Utility
 *
 * Handles persisting and restoring game state to/from localStorage.
 * Saves all relevant Redux state slices needed to resume a game.
 */

import type { RootState } from '../store';

const SAVE_KEY = 'stockExchange_savedGame';
const SAVE_VERSION = 3; // Bumped for shortPositions, float, orderBook addition

interface SavedGameState {
  version: number;
  timestamp: number;
  state: {
    stocks: RootState['stocks'];
    portfolio: RootState['portfolio'];
    virtualPlayers: RootState['virtualPlayers'];
    settings: Partial<RootState['settings']>;
    pendingOrders: RootState['pendingOrders'];
    tradeHistory: RootState['tradeHistory'];
    marketMaker: RootState['marketMaker'];
    sector: RootState['sector'];
    loans: RootState['loans'];
    gameSession: RootState['gameSession'];
    marketPhase: RootState['marketPhase'];
    shortPositions: RootState['shortPositions'];
    float: RootState['float'];
    orderBook: RootState['orderBook'];
  };
}

/**
 * Check if a saved game exists in localStorage
 */
export const hasSavedGame = (): boolean => {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (!saved) return false;

    const parsed = JSON.parse(saved) as SavedGameState;
    return parsed.version === SAVE_VERSION && !!parsed.state;
  } catch {
    return false;
  }
};

/**
 * Get saved game metadata without loading the full state
 */
export const getSavedGameInfo = (): { timestamp: number } | null => {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (!saved) return null;

    const parsed = JSON.parse(saved) as SavedGameState;
    if (parsed.version !== SAVE_VERSION) return null;

    return { timestamp: parsed.timestamp };
  } catch {
    return null;
  }
};

/**
 * Save current game state to localStorage
 */
export const saveGame = (state: RootState): boolean => {
  try {
    const savedState: SavedGameState = {
      version: SAVE_VERSION,
      timestamp: Date.now(),
      state: {
        stocks: state.stocks,
        portfolio: state.portfolio,
        virtualPlayers: state.virtualPlayers,
        settings: {
          // Only save game-relevant settings, not UI preferences
          gameMode: state.settings.gameMode,
          updateInterval: state.settings.updateInterval,
          virtualPlayerCount: state.settings.virtualPlayerCount,
          initialCash: state.settings.initialCash,
          speedMultiplier: state.settings.speedMultiplier,
          isPaused: state.settings.isPaused,
          countdown: state.settings.countdown,
          // Language and theme are stored separately and persist across games
        },
        pendingOrders: state.pendingOrders,
        tradeHistory: state.tradeHistory,
        marketMaker: state.marketMaker,
        sector: state.sector,
        loans: state.loans,
        gameSession: state.gameSession,
        marketPhase: state.marketPhase,
        shortPositions: state.shortPositions,
        float: state.float,
        orderBook: state.orderBook,
      },
    };

    localStorage.setItem(SAVE_KEY, JSON.stringify(savedState));
    return true;
  } catch (error) {
    console.error('Failed to save game:', error);
    return false;
  }
};

/**
 * Load saved game state from localStorage
 */
export const loadGame = (): SavedGameState['state'] | null => {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (!saved) return null;

    const parsed = JSON.parse(saved) as SavedGameState;
    if (parsed.version !== SAVE_VERSION) {
      console.warn('Saved game version mismatch, cannot load');
      return null;
    }

    return parsed.state;
  } catch (error) {
    console.error('Failed to load game:', error);
    return null;
  }
};

/**
 * Delete saved game from localStorage
 */
export const deleteSavedGame = (): void => {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (error) {
    console.error('Failed to delete saved game:', error);
  }
};

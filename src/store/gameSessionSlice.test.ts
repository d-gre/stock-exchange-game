import { describe, it, expect } from 'vitest';
import gameSessionReducer, {
  setGameDuration,
  incrementCycle,
  recordTrade,
  updateMaxLoanUtilization,
  endGame,
  showEndScreenPreview,
  hideEndScreenPreview,
  continueGame,
  resetGameSession,
  selectGameDuration,
  selectCurrentCycle,
  selectRemainingCycles,
  selectGameProgress,
  selectIsGameEnded,
  selectEndScreenPreview,
  selectIsTimedGame,
  GAME_DURATION_OPTIONS,
  type EndGameStats,
} from './gameSessionSlice';
import type { RootState } from './index';

describe('gameSessionSlice', () => {
  const initialState = {
    gameDuration: null,
    currentCycle: 0,
    isGameEnded: false,
    endGameStats: null,
    endScreenPreview: false,
    totalTradesExecuted: 0,
    maxLoanUtilization: 0,
  };

  describe('reducers', () => {
    it('should return initial state', () => {
      const state = gameSessionReducer(undefined, { type: 'unknown' });
      expect(state).toEqual(initialState);
    });

    it('should set game duration', () => {
      const state = gameSessionReducer(initialState, setGameDuration(60));
      expect(state.gameDuration).toBe(60);
    });

    it('should set game duration to null for unlimited', () => {
      const stateWithDuration = { ...initialState, gameDuration: 60 };
      const state = gameSessionReducer(stateWithDuration, setGameDuration(null));
      expect(state.gameDuration).toBeNull();
    });

    it('should increment cycle', () => {
      const state = gameSessionReducer(initialState, incrementCycle());
      expect(state.currentCycle).toBe(1);
    });

    it('should record trade', () => {
      const state = gameSessionReducer(initialState, recordTrade());
      expect(state.totalTradesExecuted).toBe(1);
    });

    it('should update max loan utilization when higher', () => {
      const state = gameSessionReducer(initialState, updateMaxLoanUtilization(0.5));
      expect(state.maxLoanUtilization).toBe(0.5);
    });

    it('should not update max loan utilization when lower', () => {
      const stateWithUtilization = { ...initialState, maxLoanUtilization: 0.7 };
      const state = gameSessionReducer(stateWithUtilization, updateMaxLoanUtilization(0.3));
      expect(state.maxLoanUtilization).toBe(0.7);
    });

    it('should end game with stats', () => {
      const endStats: EndGameStats = {
        playerRanking: 1,
        playerNetWorth: 150000,
        playerProfit: 50000,
        playerRiskLevel: 'moderate',
        allPlayersRanked: [],
      };
      const state = gameSessionReducer(initialState, endGame(endStats));
      expect(state.isGameEnded).toBe(true);
      expect(state.endGameStats).toEqual(endStats);
    });

    it('should clear endScreenPreview when game ends', () => {
      const previewState = { ...initialState, endScreenPreview: true };
      const endStats: EndGameStats = {
        playerRanking: 1,
        playerNetWorth: 150000,
        playerProfit: 50000,
        playerRiskLevel: 'moderate',
        allPlayersRanked: [],
      };
      const state = gameSessionReducer(previewState, endGame(endStats));
      expect(state.endScreenPreview).toBe(false);
      expect(state.isGameEnded).toBe(true);
    });

    describe('endScreenPreview', () => {
      const previewStats: EndGameStats = {
        playerRanking: 2,
        playerNetWorth: 120000,
        playerProfit: 20000,
        playerRiskLevel: 'conservative',
        allPlayersRanked: [],
      };

      it('should show endscreen preview with stats', () => {
        const state = gameSessionReducer(initialState, showEndScreenPreview(previewStats));
        expect(state.endScreenPreview).toBe(true);
        expect(state.endGameStats).toEqual(previewStats);
        expect(state.isGameEnded).toBe(false);
      });

      it('should hide endscreen preview and clear stats', () => {
        const previewState = {
          ...initialState,
          endScreenPreview: true,
          endGameStats: previewStats,
        };
        const state = gameSessionReducer(previewState, hideEndScreenPreview());
        expect(state.endScreenPreview).toBe(false);
        expect(state.endGameStats).toBeNull();
      });

      it('should clear preview on resetGameSession', () => {
        const previewState = {
          ...initialState,
          endScreenPreview: true,
          endGameStats: previewStats,
          currentCycle: 30,
        };
        const state = gameSessionReducer(previewState, resetGameSession());
        expect(state.endScreenPreview).toBe(false);
        expect(state.endGameStats).toBeNull();
      });
    });

    it('should reset game session', () => {
      const modifiedState = {
        gameDuration: 60,
        currentCycle: 30,
        isGameEnded: true,
        endGameStats: { playerRanking: 1 } as EndGameStats,
        endScreenPreview: false,
        totalTradesExecuted: 10,
        maxLoanUtilization: 0.8,
      };
      const state = gameSessionReducer(modifiedState, resetGameSession());
      expect(state).toEqual(initialState);
    });

    describe('continueGame', () => {
      it('should continue game with additional cycles', () => {
        const endedState = {
          ...initialState,
          gameDuration: 60,
          currentCycle: 60,
          isGameEnded: true,
          endGameStats: { playerRanking: 1 } as EndGameStats,
        };
        const state = gameSessionReducer(endedState, continueGame(60));
        expect(state.gameDuration).toBe(120); // 60 current + 60 additional
        expect(state.isGameEnded).toBe(false);
        expect(state.endGameStats).toBeNull();
      });

      it('should continue game with unlimited mode', () => {
        const endedState = {
          ...initialState,
          gameDuration: 60,
          currentCycle: 60,
          isGameEnded: true,
          endGameStats: { playerRanking: 1 } as EndGameStats,
        };
        const state = gameSessionReducer(endedState, continueGame(null));
        expect(state.gameDuration).toBeNull();
        expect(state.isGameEnded).toBe(false);
        expect(state.endGameStats).toBeNull();
      });

      it('should preserve current cycle count', () => {
        const endedState = {
          ...initialState,
          gameDuration: 60,
          currentCycle: 60,
          isGameEnded: true,
          endGameStats: { playerRanking: 1 } as EndGameStats,
        };
        const state = gameSessionReducer(endedState, continueGame(120));
        expect(state.currentCycle).toBe(60);
        expect(state.gameDuration).toBe(180); // 60 + 120
      });
    });
  });

  describe('selectors', () => {
    const createMockState = (overrides: {
      gameDuration?: number | null;
      currentCycle?: number;
      isGameEnded?: boolean;
      endGameStats?: EndGameStats | null;
      endScreenPreview?: boolean;
      totalTradesExecuted?: number;
      maxLoanUtilization?: number;
    } = {}): RootState => ({
      gameSession: { ...initialState, ...overrides },
    } as RootState);

    it('should select game duration', () => {
      const state = createMockState({ gameDuration: 120 });
      expect(selectGameDuration(state)).toBe(120);
    });

    it('should select current cycle', () => {
      const state = createMockState({ currentCycle: 45 });
      expect(selectCurrentCycle(state)).toBe(45);
    });

    it('should select remaining cycles for timed game', () => {
      const state = createMockState({ gameDuration: 60, currentCycle: 20 });
      expect(selectRemainingCycles(state)).toBe(40);
    });

    it('should return null for remaining cycles in unlimited game', () => {
      const state = createMockState({ gameDuration: null, currentCycle: 20 });
      expect(selectRemainingCycles(state)).toBeNull();
    });

    it('should select game progress for timed game', () => {
      const state = createMockState({ gameDuration: 100, currentCycle: 50 });
      expect(selectGameProgress(state)).toBe(0.5);
    });

    it('should return null for game progress in unlimited game', () => {
      const state = createMockState({ gameDuration: null, currentCycle: 50 });
      expect(selectGameProgress(state)).toBeNull();
    });

    it('should select is game ended', () => {
      const state = createMockState({ isGameEnded: true });
      expect(selectIsGameEnded(state)).toBe(true);
    });

    it('should select endscreen preview', () => {
      const previewState = createMockState({ endScreenPreview: true });
      expect(selectEndScreenPreview(previewState)).toBe(true);

      const noPreviewState = createMockState({ endScreenPreview: false });
      expect(selectEndScreenPreview(noPreviewState)).toBe(false);
    });

    it('should select is timed game', () => {
      const timedState = createMockState({ gameDuration: 60 });
      expect(selectIsTimedGame(timedState)).toBe(true);

      const unlimitedState = createMockState({ gameDuration: null });
      expect(selectIsTimedGame(unlimitedState)).toBe(false);
    });
  });

  describe('GAME_DURATION_OPTIONS', () => {
    it('should have correct number of options', () => {
      expect(GAME_DURATION_OPTIONS).toHaveLength(5);
    });

    it('should have correct cycle counts with unlimited last (visually first in upward dropdown)', () => {
      expect(GAME_DURATION_OPTIONS[0].cycles).toBe(360);
      expect(GAME_DURATION_OPTIONS[1].cycles).toBe(240);
      expect(GAME_DURATION_OPTIONS[2].cycles).toBe(120);
      expect(GAME_DURATION_OPTIONS[3].cycles).toBe(60);
      expect(GAME_DURATION_OPTIONS[4].cycles).toBeNull();
    });

    it('should have translation keys for all options', () => {
      GAME_DURATION_OPTIONS.forEach(option => {
        expect(option.labelKey).toMatch(/^gameStart\.duration/);
      });
    });
  });
});

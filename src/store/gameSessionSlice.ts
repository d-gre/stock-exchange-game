import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './index';

export type RiskLevel = 'conservative' | 'moderate' | 'aggressive';

export interface PlayerEndStats {
  id: string;
  name: string;
  netWorth: number;
  profit: number;
  riskLevel: RiskLevel;
  isHuman: boolean;
}

export interface EndGameStats {
  playerRanking: number;
  playerNetWorth: number;
  playerProfit: number;
  playerRiskLevel: RiskLevel;
  allPlayersRanked: PlayerEndStats[];
}

export interface GameDurationOption {
  cycles: number | null; // null = unlimited
  labelKey: string; // i18n key
}

export const GAME_DURATION_OPTIONS: GameDurationOption[] = [
  { cycles: 360, labelKey: 'gameStart.duration30min' },
  { cycles: 240, labelKey: 'gameStart.duration20min' },
  { cycles: 120, labelKey: 'gameStart.duration10min' },
  { cycles: 60, labelKey: 'gameStart.duration5min' },
  { cycles: null, labelKey: 'gameStart.durationUnlimited' },
];

interface GameSessionState {
  gameDuration: number | null; // null = unlimited, otherwise number of cycles
  currentCycle: number;
  isGameEnded: boolean;
  endGameStats: EndGameStats | null;
  endScreenPreview: boolean; // true when endscreen is shown via Alt+R hotkey
  // For risk calculation
  totalTradesExecuted: number;
  maxLoanUtilization: number; // highest loan-to-value ratio during game
}

const initialState: GameSessionState = {
  gameDuration: null,
  currentCycle: 0,
  isGameEnded: false,
  endGameStats: null,
  endScreenPreview: false,
  totalTradesExecuted: 0,
  maxLoanUtilization: 0,
};

const gameSessionSlice = createSlice({
  name: 'gameSession',
  initialState,
  reducers: {
    setGameDuration: (state, action: PayloadAction<number | null>) => {
      state.gameDuration = action.payload;
    },
    incrementCycle: (state) => {
      state.currentCycle += 1;
    },
    recordTrade: (state) => {
      state.totalTradesExecuted += 1;
    },
    updateMaxLoanUtilization: (state, action: PayloadAction<number>) => {
      if (action.payload > state.maxLoanUtilization) {
        state.maxLoanUtilization = action.payload;
      }
    },
    endGame: (state, action: PayloadAction<EndGameStats>) => {
      state.isGameEnded = true;
      state.endGameStats = action.payload;
      state.endScreenPreview = false;
    },
    showEndScreenPreview: (state, action: PayloadAction<EndGameStats>) => {
      state.endScreenPreview = true;
      state.endGameStats = action.payload;
    },
    hideEndScreenPreview: (state) => {
      state.endScreenPreview = false;
      state.endGameStats = null;
    },
    /**
     * Continue game after it ended - sets new duration and clears end state
     * @param cycles - Additional cycles to play (null = unlimited)
     */
    continueGame: (state, action: PayloadAction<number | null>) => {
      const additionalCycles = action.payload;
      if (additionalCycles === null) {
        // Unlimited mode
        state.gameDuration = null;
      } else {
        // Add additional cycles to current cycle count
        state.gameDuration = state.currentCycle + additionalCycles;
      }
      state.isGameEnded = false;
      state.endGameStats = null;
    },
    resetGameSession: (state) => {
      state.gameDuration = null;
      state.currentCycle = 0;
      state.isGameEnded = false;
      state.endGameStats = null;
      state.endScreenPreview = false;
      state.totalTradesExecuted = 0;
      state.maxLoanUtilization = 0;
    },
    /**
     * Restore game session state from saved game
     */
    restoreGameSession: (_state, action: PayloadAction<GameSessionState>) => {
      return action.payload;
    },
  },
});

export const {
  setGameDuration,
  incrementCycle,
  recordTrade,
  updateMaxLoanUtilization,
  endGame,
  showEndScreenPreview,
  hideEndScreenPreview,
  continueGame,
  resetGameSession,
  restoreGameSession,
} = gameSessionSlice.actions;

// Selectors
export const selectGameDuration = (state: RootState) => state.gameSession.gameDuration;
export const selectCurrentCycle = (state: RootState) => state.gameSession.currentCycle;
export const selectRemainingCycles = (state: RootState) => {
  const { gameDuration, currentCycle } = state.gameSession;
  if (gameDuration === null) return null;
  return Math.max(0, gameDuration - currentCycle);
};
export const selectGameProgress = (state: RootState) => {
  const { gameDuration, currentCycle } = state.gameSession;
  if (gameDuration === null) return null;
  return Math.min(1, currentCycle / gameDuration);
};
export const selectIsGameEnded = (state: RootState) => state.gameSession.isGameEnded;
export const selectEndGameStats = (state: RootState) => state.gameSession.endGameStats;
export const selectEndScreenPreview = (state: RootState) => state.gameSession.endScreenPreview;
export const selectIsTimedGame = (state: RootState) => state.gameSession.gameDuration !== null;

export default gameSessionSlice.reducer;

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { CONFIG } from '../config';
import type { GameMode } from '../types';
import { getStoredLanguage, type Language } from '../i18n';

export type SpeedMultiplier = 1 | 2 | 3;

interface SettingsState {
  updateInterval: number; // in seconds (base interval)
  countdown: number;
  isPaused: boolean;
  virtualPlayerCount: number;
  gameMode: GameMode;
  speedMultiplier: SpeedMultiplier; // 1 = normal, 2 = fast, 3 = very fast
  language: Language;
  initialCash: number; // Player's starting capital (for virtual player scaling)
}

const initialState: SettingsState = {
  updateInterval: CONFIG.updateInterval / 1000,
  countdown: CONFIG.updateInterval / 1000,
  isPaused: false,
  virtualPlayerCount: CONFIG.virtualPlayerCount,
  gameMode: CONFIG.defaultGameMode,
  speedMultiplier: 1,
  language: getStoredLanguage(),
  initialCash: CONFIG.initialCash,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setUpdateInterval: (state, action: PayloadAction<number>) => {
      state.updateInterval = action.payload;
      state.countdown = Math.ceil(action.payload / state.speedMultiplier);
    },
    decrementCountdown: (state) => {
      if (!state.isPaused && state.countdown > 0) {
        state.countdown = state.countdown - 1;
      }
    },
    resetCountdown: (state) => {
      state.countdown = Math.ceil(state.updateInterval / state.speedMultiplier);
    },
    togglePause: (state) => {
      state.isPaused = !state.isPaused;
    },
    setVirtualPlayerCount: (state, action: PayloadAction<number>) => {
      state.virtualPlayerCount = action.payload;
    },
    setGameMode: (state, action: PayloadAction<GameMode>) => {
      state.gameMode = action.payload;
    },
    setSpeedMultiplier: (state, action: PayloadAction<SpeedMultiplier>) => {
      state.speedMultiplier = action.payload;
      // Adjust countdown proportionally
      const effectiveInterval = state.updateInterval / action.payload;
      state.countdown = Math.ceil(effectiveInterval);
    },
    setLanguage: (state, action: PayloadAction<Language>) => {
      state.language = action.payload;
    },
    setInitialCash: (state, action: PayloadAction<number>) => {
      state.initialCash = action.payload;
    },
  },
});

export const { setUpdateInterval, decrementCountdown, resetCountdown, togglePause, setVirtualPlayerCount, setGameMode, setSpeedMultiplier, setLanguage, setInitialCash } = settingsSlice.actions;
export default settingsSlice.reducer;

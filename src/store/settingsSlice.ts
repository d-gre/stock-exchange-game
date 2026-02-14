import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { CONFIG } from '../config';
import type { GameMode } from '../types';
import { getStoredLanguage, type Language } from '../i18n';

export type SpeedMultiplier = 1 | 2 | 3;

interface SettingsState {
  updateInterval: number; // in seconds (base interval)
  countdown: number; // UI display value (updated by useGameCycle)
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
    /**
     * Set countdown to a specific value (used by useGameCycle for synchronized updates)
     */
    setCountdown: (state, action: PayloadAction<number>) => {
      state.countdown = action.payload;
    },
    /**
     * @deprecated Use setCountdown instead - kept for backwards compatibility
     */
    decrementCountdown: (state) => {
      if (!state.isPaused && state.countdown > 0) {
        state.countdown = state.countdown - 1;
      }
    },
    /**
     * Reset countdown to full interval (used after cycle completion)
     */
    resetCountdown: (state) => {
      state.countdown = Math.ceil(state.updateInterval / state.speedMultiplier);
    },
    togglePause: (state) => {
      state.isPaused = !state.isPaused;
    },
    setPaused: (state, action: PayloadAction<boolean>) => {
      state.isPaused = action.payload;
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
    /**
     * Restore settings from saved game (partial - doesn't restore language/theme)
     */
    restoreSettings: (state, action: PayloadAction<Partial<SettingsState>>) => {
      // Only restore game-relevant settings, keep language as is
      if (action.payload.gameMode !== undefined) state.gameMode = action.payload.gameMode;
      if (action.payload.updateInterval !== undefined) state.updateInterval = action.payload.updateInterval;
      if (action.payload.virtualPlayerCount !== undefined) state.virtualPlayerCount = action.payload.virtualPlayerCount;
      if (action.payload.initialCash !== undefined) state.initialCash = action.payload.initialCash;
      if (action.payload.speedMultiplier !== undefined) state.speedMultiplier = action.payload.speedMultiplier;
      if (action.payload.isPaused !== undefined) state.isPaused = action.payload.isPaused;
      if (action.payload.countdown !== undefined) state.countdown = action.payload.countdown;
    },
  },
});

export const { setUpdateInterval, setCountdown, decrementCountdown, resetCountdown, togglePause, setPaused, setVirtualPlayerCount, setGameMode, setSpeedMultiplier, setLanguage, setInitialCash, restoreSettings } = settingsSlice.actions;
export default settingsSlice.reducer;

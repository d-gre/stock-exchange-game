import { describe, it, expect } from 'vitest';
import settingsReducer, { setUpdateInterval, decrementCountdown, resetCountdown, togglePause, setVirtualPlayerCount, setGameMode, setSpeedMultiplier, setLanguage } from './settingsSlice';

describe('settingsSlice', () => {
  const createInitialState = (overrides = {}) => ({
    updateInterval: 30,
    countdown: 15,
    isPaused: false,
    virtualPlayerCount: 5,
    gameMode: 'sandbox' as const,
    speedMultiplier: 1 as const,
    language: 'de' as const,
    initialCash: 100000,
    ...overrides,
  });

  describe('setUpdateInterval', () => {
    it('should update interval and reset countdown', () => {
      const initialState = createInitialState();

      const newState = settingsReducer(initialState, setUpdateInterval(60));

      expect(newState.updateInterval).toBe(60);
      expect(newState.countdown).toBe(60);
    });

    it('should reset countdown adjusted for speedMultiplier', () => {
      const initialState = createInitialState({ speedMultiplier: 2 });

      const newState = settingsReducer(initialState, setUpdateInterval(60));

      expect(newState.updateInterval).toBe(60);
      expect(newState.countdown).toBe(30); // 60 / 2 = 30
    });
  });

  describe('decrementCountdown', () => {
    it('should decrement countdown by 1', () => {
      const initialState = createInitialState();

      const newState = settingsReducer(initialState, decrementCountdown());

      expect(newState.countdown).toBe(14);
    });

    it('should not decrement below 0', () => {
      const initialState = createInitialState({ countdown: 0 });

      const newState = settingsReducer(initialState, decrementCountdown());

      expect(newState.countdown).toBe(0);
    });

    it('should not decrement countdown when paused', () => {
      const initialState = createInitialState({ isPaused: true });

      const newState = settingsReducer(initialState, decrementCountdown());

      expect(newState.countdown).toBe(15);
    });
  });

  describe('resetCountdown', () => {
    it('should reset countdown to updateInterval', () => {
      const initialState = createInitialState({ countdown: 5 });

      const newState = settingsReducer(initialState, resetCountdown());

      expect(newState.countdown).toBe(30);
    });

    it('should reset countdown adjusted for speedMultiplier', () => {
      const initialState = createInitialState({ countdown: 5, speedMultiplier: 2 });

      const newState = settingsReducer(initialState, resetCountdown());

      expect(newState.countdown).toBe(15); // 30 / 2 = 15
    });

    it('should reset countdown for 3x speed', () => {
      const initialState = createInitialState({ countdown: 5, speedMultiplier: 3 });

      const newState = settingsReducer(initialState, resetCountdown());

      expect(newState.countdown).toBe(10); // 30 / 3 = 10
    });
  });

  describe('togglePause', () => {
    it('should set isPaused to true when currently false', () => {
      const initialState = createInitialState();

      const newState = settingsReducer(initialState, togglePause());

      expect(newState.isPaused).toBe(true);
    });

    it('should set isPaused to false when currently true', () => {
      const initialState = createInitialState({ isPaused: true });

      const newState = settingsReducer(initialState, togglePause());

      expect(newState.isPaused).toBe(false);
    });

    it('should not affect countdown or updateInterval', () => {
      const initialState = createInitialState();

      const newState = settingsReducer(initialState, togglePause());

      expect(newState.updateInterval).toBe(30);
      expect(newState.countdown).toBe(15);
    });
  });

  describe('setVirtualPlayerCount', () => {
    it('should update virtualPlayerCount', () => {
      const initialState = createInitialState();

      const newState = settingsReducer(initialState, setVirtualPlayerCount(10));

      expect(newState.virtualPlayerCount).toBe(10);
    });

    it('should allow setting to 0', () => {
      const initialState = createInitialState();

      const newState = settingsReducer(initialState, setVirtualPlayerCount(0));

      expect(newState.virtualPlayerCount).toBe(0);
    });
  });

  describe('setGameMode', () => {
    it('should update gameMode', () => {
      const initialState = createInitialState();

      const newState = settingsReducer(initialState, setGameMode('realLife'));

      expect(newState.gameMode).toBe('realLife');
    });

    it('should allow setting to hardLife', () => {
      const initialState = createInitialState();

      const newState = settingsReducer(initialState, setGameMode('hardLife'));

      expect(newState.gameMode).toBe('hardLife');
    });
  });

  describe('setSpeedMultiplier', () => {
    it('should set speedMultiplier to 2', () => {
      const initialState = createInitialState();

      const newState = settingsReducer(initialState, setSpeedMultiplier(2));

      expect(newState.speedMultiplier).toBe(2);
    });

    it('should set speedMultiplier to 3', () => {
      const initialState = createInitialState();

      const newState = settingsReducer(initialState, setSpeedMultiplier(3));

      expect(newState.speedMultiplier).toBe(3);
    });

    it('should reset speedMultiplier to 1 (normal)', () => {
      const initialState = createInitialState({ speedMultiplier: 2 });

      const newState = settingsReducer(initialState, setSpeedMultiplier(1));

      expect(newState.speedMultiplier).toBe(1);
    });

    it('should adjust countdown when setting to 2x speed', () => {
      const initialState = createInitialState({ updateInterval: 30 });

      const newState = settingsReducer(initialState, setSpeedMultiplier(2));

      expect(newState.countdown).toBe(15); // 30 / 2 = 15
    });

    it('should adjust countdown when setting to 3x speed', () => {
      const initialState = createInitialState({ updateInterval: 30 });

      const newState = settingsReducer(initialState, setSpeedMultiplier(3));

      expect(newState.countdown).toBe(10); // 30 / 3 = 10
    });

    it('should adjust countdown when returning to normal speed', () => {
      const initialState = createInitialState({ updateInterval: 30, speedMultiplier: 3 });

      const newState = settingsReducer(initialState, setSpeedMultiplier(1));

      expect(newState.countdown).toBe(30); // 30 / 1 = 30
    });
  });

  describe('setLanguage', () => {
    it('should set language to English', () => {
      const initialState = createInitialState();

      const newState = settingsReducer(initialState, setLanguage('en'));

      expect(newState.language).toBe('en');
    });

    it('should set language to Japanese', () => {
      const initialState = createInitialState();

      const newState = settingsReducer(initialState, setLanguage('ja'));

      expect(newState.language).toBe('ja');
    });

    it('should set language to Latin', () => {
      const initialState = createInitialState();

      const newState = settingsReducer(initialState, setLanguage('la'));

      expect(newState.language).toBe('la');
    });

    it('should set language back to German', () => {
      const initialState = createInitialState({ language: 'en' });

      const newState = settingsReducer(initialState, setLanguage('de'));

      expect(newState.language).toBe('de');
    });
  });
});

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import React from 'react';
import { useEndScreenPreview } from './useEndScreenPreview';
import gameSessionReducer, { type EndGameStats } from '../store/gameSessionSlice';

const mockStats: EndGameStats = {
  playerRanking: 1,
  playerNetWorth: 150000,
  playerProfit: 50000,
  playerRiskLevel: 'moderate',
  allPlayersRanked: [
    { id: 'player', name: 'You', netWorth: 150000, profit: 50000, riskLevel: 'moderate', isHuman: true },
  ],
};

const createTestStore = (overrides: {
  isGameEnded?: boolean;
  endScreenPreview?: boolean;
  endGameStats?: EndGameStats | null;
} = {}) => {
  return configureStore({
    reducer: {
      gameSession: gameSessionReducer,
    },
    preloadedState: {
      gameSession: {
        gameDuration: null,
        currentCycle: 10,
        isGameEnded: overrides.isGameEnded ?? false,
        endGameStats: overrides.endGameStats ?? null,
        endScreenPreview: overrides.endScreenPreview ?? false,
        totalTradesExecuted: 5,
        maxLoanUtilization: 0.3,
      },
    },
  });
};

const createWrapper = (store: ReturnType<typeof createTestStore>) => {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(Provider, { store, children });
  };
};

const fireAltR = () => {
  const event = new KeyboardEvent('keydown', {
    key: 'r',
    altKey: true,
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(event);
};

describe('useEndScreenPreview', () => {
  it('should show preview on Alt+R when not in preview and game not ended', () => {
    const store = createTestStore();
    const calculateEndGameStats = vi.fn(() => mockStats);

    renderHook(() => useEndScreenPreview(calculateEndGameStats), {
      wrapper: createWrapper(store),
    });

    act(() => {
      fireAltR();
    });

    const state = store.getState();
    expect(calculateEndGameStats).toHaveBeenCalledOnce();
    expect(state.gameSession.endScreenPreview).toBe(true);
    expect(state.gameSession.endGameStats).toEqual(mockStats);
  });

  it('should hide preview on Alt+R when already in preview', () => {
    const store = createTestStore({ endScreenPreview: true, endGameStats: mockStats });
    const calculateEndGameStats = vi.fn(() => mockStats);

    renderHook(() => useEndScreenPreview(calculateEndGameStats), {
      wrapper: createWrapper(store),
    });

    act(() => {
      fireAltR();
    });

    const state = store.getState();
    expect(calculateEndGameStats).not.toHaveBeenCalled();
    expect(state.gameSession.endScreenPreview).toBe(false);
    expect(state.gameSession.endGameStats).toBeNull();
  });

  it('should toggle preview off and on with consecutive Alt+R presses', () => {
    const store = createTestStore();
    const calculateEndGameStats = vi.fn(() => mockStats);

    renderHook(() => useEndScreenPreview(calculateEndGameStats), {
      wrapper: createWrapper(store),
    });

    // First press: show preview
    act(() => {
      fireAltR();
    });
    expect(store.getState().gameSession.endScreenPreview).toBe(true);

    // Second press: hide preview
    act(() => {
      fireAltR();
    });
    expect(store.getState().gameSession.endScreenPreview).toBe(false);
  });

  it('should do nothing on Alt+R when game has ended', () => {
    const store = createTestStore({ isGameEnded: true });
    const calculateEndGameStats = vi.fn(() => mockStats);

    renderHook(() => useEndScreenPreview(calculateEndGameStats), {
      wrapper: createWrapper(store),
    });

    act(() => {
      fireAltR();
    });

    const state = store.getState();
    expect(calculateEndGameStats).not.toHaveBeenCalled();
    expect(state.gameSession.endScreenPreview).toBe(false);
  });

  it('should not react to R without Alt modifier', () => {
    const store = createTestStore();
    const calculateEndGameStats = vi.fn(() => mockStats);

    renderHook(() => useEndScreenPreview(calculateEndGameStats), {
      wrapper: createWrapper(store),
    });

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'r',
        altKey: false,
        bubbles: true,
      });
      document.dispatchEvent(event);
    });

    expect(calculateEndGameStats).not.toHaveBeenCalled();
    expect(store.getState().gameSession.endScreenPreview).toBe(false);
  });

  it('should not react to Alt with a different key', () => {
    const store = createTestStore();
    const calculateEndGameStats = vi.fn(() => mockStats);

    renderHook(() => useEndScreenPreview(calculateEndGameStats), {
      wrapper: createWrapper(store),
    });

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'x',
        altKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);
    });

    expect(calculateEndGameStats).not.toHaveBeenCalled();
    expect(store.getState().gameSession.endScreenPreview).toBe(false);
  });

  it('should handle uppercase R (e.g. CapsLock)', () => {
    const store = createTestStore();
    const calculateEndGameStats = vi.fn(() => mockStats);

    renderHook(() => useEndScreenPreview(calculateEndGameStats), {
      wrapper: createWrapper(store),
    });

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'R',
        altKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event);
    });

    expect(calculateEndGameStats).toHaveBeenCalledOnce();
    expect(store.getState().gameSession.endScreenPreview).toBe(true);
  });

  it('should remove event listener on unmount', () => {
    const store = createTestStore();
    const calculateEndGameStats = vi.fn(() => mockStats);

    const { unmount } = renderHook(() => useEndScreenPreview(calculateEndGameStats), {
      wrapper: createWrapper(store),
    });

    unmount();

    act(() => {
      fireAltR();
    });

    expect(calculateEndGameStats).not.toHaveBeenCalled();
    expect(store.getState().gameSession.endScreenPreview).toBe(false);
  });
});

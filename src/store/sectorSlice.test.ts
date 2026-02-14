import { describe, it, expect } from 'vitest';
import sectorReducer, { updateSectorState, resetSectorState, selectSectorInfluences, selectSectorMomentum, selectSectorInfluence } from './sectorSlice';
import type { Stock } from '../types';

describe('sectorSlice', () => {
  const createMockStocks = (): Stock[] => [
    {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      sector: 'tech',
      currentPrice: 100,
      change: 2,
      changePercent: 2.0,
      priceHistory: [{ time: 1, open: 98, high: 102, low: 97, close: 100 }],
      marketCapBillions: 3000,
    },
    {
      symbol: 'MSFT',
      name: 'Microsoft Corp.',
      sector: 'tech',
      currentPrice: 200,
      change: 3,
      changePercent: 1.5,
      priceHistory: [{ time: 1, open: 197, high: 201, low: 196, close: 200 }],
      marketCapBillions: 3000,
    },
    {
      symbol: 'JPM',
      name: 'JPMorgan Chase',
      sector: 'finance',
      currentPrice: 150,
      change: -1,
      changePercent: -0.67,
      priceHistory: [{ time: 1, open: 151, high: 152, low: 149, close: 150 }],
      marketCapBillions: 600,
    },
    {
      symbol: 'BA',
      name: 'Boeing Co.',
      sector: 'industrial',
      currentPrice: 250,
      change: 0,
      changePercent: 0.0,
      priceHistory: [{ time: 1, open: 250, high: 252, low: 248, close: 250 }],
      marketCapBillions: 150,
    },
    {
      symbol: 'XOM',
      name: 'Exxon Mobil',
      sector: 'commodities',
      currentPrice: 110,
      change: 1,
      changePercent: 0.92,
      priceHistory: [{ time: 1, open: 109, high: 111, low: 108, close: 110 }],
      marketCapBillions: 450,
    },
  ];

  describe('initial state', () => {
    it('should have neutral sector momentum', () => {
      const state = sectorReducer(undefined, { type: '@@INIT' });
      expect(state.sectorMomentum.tech.momentum).toBe(0);
      expect(state.sectorMomentum.finance.momentum).toBe(0);
      expect(state.sectorMomentum.industrial.momentum).toBe(0);
      expect(state.sectorMomentum.commodities.momentum).toBe(0);
    });

    it('should have zero sector influences', () => {
      const state = sectorReducer(undefined, { type: '@@INIT' });
      expect(state.sectorInfluences.tech).toBe(0);
      expect(state.sectorInfluences.finance).toBe(0);
      expect(state.sectorInfluences.industrial).toBe(0);
      expect(state.sectorInfluences.commodities).toBe(0);
    });
  });

  describe('updateSectorState', () => {
    it('should update sector momentum based on stock performance', () => {
      const initialState = sectorReducer(undefined, { type: '@@INIT' });
      const stocks = createMockStocks();

      const newState = sectorReducer(initialState, updateSectorState(stocks));

      // Tech had positive performance (2% and 1.5% avg = 1.75%)
      // Momentum should be slightly positive
      expect(newState.sectorMomentum.tech.momentum).not.toBe(0);
    });

    it('should update lastUpdate timestamp', () => {
      const initialState = sectorReducer(undefined, { type: '@@INIT' });
      const oldTimestamp = initialState.lastUpdate;
      const stocks = createMockStocks();

      const newState = sectorReducer(initialState, updateSectorState(stocks));

      expect(newState.lastUpdate).toBeGreaterThanOrEqual(oldTimestamp);
    });

    it('should calculate sector influences from momentum', () => {
      let state = sectorReducer(undefined, { type: '@@INIT' });
      const stocks = createMockStocks();

      // Run several updates to build momentum
      for (let i = 0; i < 5; i++) {
        state = sectorReducer(state, updateSectorState(stocks));
      }

      // Influences should be calculated from momentum
      expect(typeof state.sectorInfluences.tech).toBe('number');
      expect(typeof state.sectorInfluences.finance).toBe('number');
    });
  });

  describe('resetSectorState', () => {
    it('should reset momentum to initial values', () => {
      let state = sectorReducer(undefined, { type: '@@INIT' });
      const stocks = createMockStocks();

      // Build up some momentum
      for (let i = 0; i < 5; i++) {
        state = sectorReducer(state, updateSectorState(stocks));
      }

      // Reset
      state = sectorReducer(state, resetSectorState());

      expect(state.sectorMomentum.tech.momentum).toBe(0);
      expect(state.sectorMomentum.finance.momentum).toBe(0);
      expect(state.sectorMomentum.industrial.momentum).toBe(0);
      expect(state.sectorMomentum.commodities.momentum).toBe(0);
    });

    it('should reset influences to zero', () => {
      let state = sectorReducer(undefined, { type: '@@INIT' });
      const stocks = createMockStocks();

      for (let i = 0; i < 5; i++) {
        state = sectorReducer(state, updateSectorState(stocks));
      }

      state = sectorReducer(state, resetSectorState());

      expect(state.sectorInfluences.tech).toBe(0);
      expect(state.sectorInfluences.finance).toBe(0);
      expect(state.sectorInfluences.industrial).toBe(0);
      expect(state.sectorInfluences.commodities).toBe(0);
    });
  });

  describe('selectors', () => {
    // Helper to create a minimal state for selector testing
    const createSelectorTestState = () =>
      ({ sector: sectorReducer(undefined, { type: '@@INIT' }) }) as unknown as Parameters<typeof selectSectorInfluences>[0];

    it('selectSectorInfluences should return influences', () => {
      const state = createSelectorTestState();
      const influences = selectSectorInfluences(state);

      expect(influences).toHaveProperty('tech');
      expect(influences).toHaveProperty('finance');
      expect(influences).toHaveProperty('industrial');
      expect(influences).toHaveProperty('commodities');
    });

    it('selectSectorMomentum should return momentum state', () => {
      const state = createSelectorTestState();
      const momentum = selectSectorMomentum(state);

      expect(momentum.tech).toHaveProperty('momentum');
      expect(momentum.tech).toHaveProperty('lastPerformance');
    });

    it('selectSectorInfluence should return influence for a specific sector', () => {
      const state = createSelectorTestState();
      const techInfluence = selectSectorInfluence('tech')(state);
      const financeInfluence = selectSectorInfluence('finance')(state);

      expect(typeof techInfluence).toBe('number');
      expect(typeof financeInfluence).toBe('number');
    });
  });
});

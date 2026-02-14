import { describe, it, expect } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import marketMakerReducer, {
  initializeInventory,
  executeTrade,
  executeVirtualTrade,
  rebalanceInventory,
  resetInventory,
  calculateSpreadMultiplier,
  selectMarketMakerInventory,
  selectSpreadMultiplier,
  selectInventoryLevel,
  selectAllInventoryLevels,
} from './marketMakerSlice';
import { MARKET_MAKER_CONFIG } from '../config';

const createTestStore = () =>
  configureStore({
    reducer: { marketMaker: marketMakerReducer },
  });

describe('marketMakerSlice', () => {
  describe('calculateSpreadMultiplier', () => {
    const baseInventory = 100000;

    it('should return 1.0 at base inventory level', () => {
      expect(calculateSpreadMultiplier(100000, baseInventory)).toBe(1.0);
    });

    it('should return maxSpreadMultiplier at minInventoryThreshold', () => {
      const minInventory = baseInventory * MARKET_MAKER_CONFIG.minInventoryThreshold;
      expect(calculateSpreadMultiplier(minInventory, baseInventory)).toBe(
        MARKET_MAKER_CONFIG.maxSpreadMultiplier
      );
    });

    it('should return minSpreadMultiplier at maxInventoryThreshold', () => {
      const maxInventory = baseInventory * MARKET_MAKER_CONFIG.maxInventoryThreshold;
      expect(calculateSpreadMultiplier(maxInventory, baseInventory)).toBe(
        MARKET_MAKER_CONFIG.minSpreadMultiplier
      );
    });

    it('should return higher spread when inventory is low', () => {
      const lowInventory = baseInventory * 0.5;
      const multiplier = calculateSpreadMultiplier(lowInventory, baseInventory);
      expect(multiplier).toBeGreaterThan(1.0);
    });

    it('should return lower spread when inventory is high', () => {
      const highInventory = baseInventory * 1.5;
      const multiplier = calculateSpreadMultiplier(highInventory, baseInventory);
      expect(multiplier).toBeLessThan(1.0);
    });

    it('should clamp to maxSpreadMultiplier below minInventoryThreshold', () => {
      const veryLowInventory = baseInventory * 0.05; // 5%
      expect(calculateSpreadMultiplier(veryLowInventory, baseInventory)).toBe(
        MARKET_MAKER_CONFIG.maxSpreadMultiplier
      );
    });

    it('should clamp to minSpreadMultiplier above maxInventoryThreshold', () => {
      const veryHighInventory = baseInventory * 2.5; // 250%
      expect(calculateSpreadMultiplier(veryHighInventory, baseInventory)).toBe(
        MARKET_MAKER_CONFIG.minSpreadMultiplier
      );
    });
  });

  describe('initializeInventory', () => {
    it('should initialize inventory for given symbols', () => {
      const store = createTestStore();
      store.dispatch(initializeInventory(['AAPL', 'GOOGL', 'MSFT']));

      const state = store.getState().marketMaker;
      expect(Object.keys(state.inventory)).toHaveLength(3);
      expect(state.inventory['AAPL']).toBeDefined();
      expect(state.inventory['GOOGL']).toBeDefined();
      expect(state.inventory['MSFT']).toBeDefined();
    });

    it('should set correct initial values', () => {
      const store = createTestStore();
      store.dispatch(initializeInventory(['AAPL']));

      const mmState = store.getState().marketMaker.inventory['AAPL'];
      expect(mmState.symbol).toBe('AAPL');
      expect(mmState.inventory).toBe(MARKET_MAKER_CONFIG.baseInventoryPerStock);
      expect(mmState.baseInventory).toBe(MARKET_MAKER_CONFIG.baseInventoryPerStock);
      expect(mmState.spreadMultiplier).toBe(1.0);
    });
  });

  describe('executeTrade', () => {
    it('should decrease inventory on player buy', () => {
      const store = createTestStore();
      store.dispatch(initializeInventory(['AAPL']));
      const initialInventory = store.getState().marketMaker.inventory['AAPL'].inventory;

      store.dispatch(executeTrade({ symbol: 'AAPL', type: 'buy', shares: 100 }));

      const newInventory = store.getState().marketMaker.inventory['AAPL'].inventory;
      expect(newInventory).toBe(initialInventory - 100);
    });

    it('should increase inventory on player sell', () => {
      const store = createTestStore();
      store.dispatch(initializeInventory(['AAPL']));
      const initialInventory = store.getState().marketMaker.inventory['AAPL'].inventory;

      store.dispatch(executeTrade({ symbol: 'AAPL', type: 'sell', shares: 100 }));

      const newInventory = store.getState().marketMaker.inventory['AAPL'].inventory;
      expect(newInventory).toBe(initialInventory + 100);
    });

    it('should update spreadMultiplier after buy', () => {
      const store = createTestStore();
      store.dispatch(initializeInventory(['AAPL']));

      // Buy a large amount to significantly decrease inventory
      store.dispatch(executeTrade({ symbol: 'AAPL', type: 'buy', shares: 50000 }));

      const mmState = store.getState().marketMaker.inventory['AAPL'];
      expect(mmState.spreadMultiplier).toBeGreaterThan(1.0);
    });

    it('should update spreadMultiplier after sell', () => {
      const store = createTestStore();
      store.dispatch(initializeInventory(['AAPL']));

      // Sell a large amount to significantly increase inventory
      store.dispatch(executeTrade({ symbol: 'AAPL', type: 'sell', shares: 50000 }));

      const mmState = store.getState().marketMaker.inventory['AAPL'];
      expect(mmState.spreadMultiplier).toBeLessThan(1.0);
    });

    it('should not go below 0 inventory', () => {
      const store = createTestStore();
      store.dispatch(initializeInventory(['AAPL']));

      // Try to buy more than available
      store.dispatch(executeTrade({ symbol: 'AAPL', type: 'buy', shares: 200000 }));

      const mmState = store.getState().marketMaker.inventory['AAPL'];
      expect(mmState.inventory).toBe(0);
    });

    it('should do nothing for unknown symbol', () => {
      const store = createTestStore();
      store.dispatch(initializeInventory(['AAPL']));

      store.dispatch(executeTrade({ symbol: 'UNKNOWN', type: 'buy', shares: 100 }));

      // Should not throw, and AAPL should be unchanged
      const mmState = store.getState().marketMaker.inventory['AAPL'];
      expect(mmState.inventory).toBe(MARKET_MAKER_CONFIG.baseInventoryPerStock);
    });
  });

  describe('executeVirtualTrade', () => {
    it('should have reduced effect (50%) compared to regular trade', () => {
      const store = createTestStore();
      store.dispatch(initializeInventory(['AAPL']));
      const initialInventory = store.getState().marketMaker.inventory['AAPL'].inventory;

      store.dispatch(executeVirtualTrade({ symbol: 'AAPL', type: 'buy', shares: 100 }));

      const newInventory = store.getState().marketMaker.inventory['AAPL'].inventory;
      // Virtual trade effect is 50%, so 100 shares -> 50 effective
      expect(newInventory).toBe(initialInventory - 50);
    });

    it('should floor the effective shares', () => {
      const store = createTestStore();
      store.dispatch(initializeInventory(['AAPL']));
      const initialInventory = store.getState().marketMaker.inventory['AAPL'].inventory;

      store.dispatch(executeVirtualTrade({ symbol: 'AAPL', type: 'buy', shares: 11 }));

      const newInventory = store.getState().marketMaker.inventory['AAPL'].inventory;
      // 11 * 0.5 = 5.5 -> floored to 5
      expect(newInventory).toBe(initialInventory - 5);
    });
  });

  describe('rebalanceInventory', () => {
    it('should move inventory towards base level', () => {
      const store = createTestStore();
      store.dispatch(initializeInventory(['AAPL']));

      // First decrease inventory
      store.dispatch(executeTrade({ symbol: 'AAPL', type: 'buy', shares: 20000 }));
      const depletedInventory = store.getState().marketMaker.inventory['AAPL'].inventory;

      // Then rebalance
      store.dispatch(rebalanceInventory());

      const rebalancedInventory = store.getState().marketMaker.inventory['AAPL'].inventory;
      expect(rebalancedInventory).toBeGreaterThan(depletedInventory);
    });

    it('should reduce inventory when above base level', () => {
      const store = createTestStore();
      store.dispatch(initializeInventory(['AAPL']));

      // First increase inventory
      store.dispatch(executeTrade({ symbol: 'AAPL', type: 'sell', shares: 20000 }));
      const excessInventory = store.getState().marketMaker.inventory['AAPL'].inventory;

      // Then rebalance
      store.dispatch(rebalanceInventory());

      const rebalancedInventory = store.getState().marketMaker.inventory['AAPL'].inventory;
      expect(rebalancedInventory).toBeLessThan(excessInventory);
    });

    it('should update spreadMultiplier after rebalancing', () => {
      const store = createTestStore();
      store.dispatch(initializeInventory(['AAPL']));

      // Deplete inventory significantly
      store.dispatch(executeTrade({ symbol: 'AAPL', type: 'buy', shares: 50000 }));
      const highSpread = store.getState().marketMaker.inventory['AAPL'].spreadMultiplier;

      // Rebalance
      store.dispatch(rebalanceInventory());

      const newSpread = store.getState().marketMaker.inventory['AAPL'].spreadMultiplier;
      expect(newSpread).toBeLessThan(highSpread);
    });
  });

  describe('resetInventory', () => {
    it('should reset all inventory to base level', () => {
      const store = createTestStore();
      store.dispatch(initializeInventory(['AAPL', 'GOOGL']));

      // Modify inventories
      store.dispatch(executeTrade({ symbol: 'AAPL', type: 'buy', shares: 30000 }));
      store.dispatch(executeTrade({ symbol: 'GOOGL', type: 'sell', shares: 20000 }));

      // Reset
      store.dispatch(resetInventory());

      const state = store.getState().marketMaker;
      expect(state.inventory['AAPL'].inventory).toBe(MARKET_MAKER_CONFIG.baseInventoryPerStock);
      expect(state.inventory['GOOGL'].inventory).toBe(MARKET_MAKER_CONFIG.baseInventoryPerStock);
      expect(state.inventory['AAPL'].spreadMultiplier).toBe(1.0);
      expect(state.inventory['GOOGL'].spreadMultiplier).toBe(1.0);
    });
  });

  describe('selectors', () => {
    it('selectMarketMakerInventory should return inventory', () => {
      const store = createTestStore();
      store.dispatch(initializeInventory(['AAPL']));

      const inventory = selectMarketMakerInventory(store.getState());
      expect(inventory['AAPL']).toBeDefined();
    });

    it('selectSpreadMultiplier should return spread for symbol', () => {
      const store = createTestStore();
      store.dispatch(initializeInventory(['AAPL']));

      const spread = selectSpreadMultiplier(store.getState(), 'AAPL');
      expect(spread).toBe(1.0);
    });

    it('selectSpreadMultiplier should return 1.0 for unknown symbol', () => {
      const store = createTestStore();
      store.dispatch(initializeInventory(['AAPL']));

      const spread = selectSpreadMultiplier(store.getState(), 'UNKNOWN');
      expect(spread).toBe(1.0);
    });

    it('selectInventoryLevel should return ratio', () => {
      const store = createTestStore();
      store.dispatch(initializeInventory(['AAPL']));

      const level = selectInventoryLevel(store.getState(), 'AAPL');
      expect(level).toBe(1.0);

      store.dispatch(executeTrade({ symbol: 'AAPL', type: 'buy', shares: 50000 }));

      const newLevel = selectInventoryLevel(store.getState(), 'AAPL');
      expect(newLevel).toBe(0.5);
    });

    it('selectAllInventoryLevels should return all levels', () => {
      const store = createTestStore();
      store.dispatch(initializeInventory(['AAPL', 'GOOGL']));
      store.dispatch(executeTrade({ symbol: 'AAPL', type: 'buy', shares: 50000 }));

      const levels = selectAllInventoryLevels(store.getState());
      expect(levels['AAPL'].level).toBe(0.5);
      expect(levels['AAPL'].spreadMultiplier).toBeGreaterThan(1.0);
      expect(levels['GOOGL'].level).toBe(1.0);
      expect(levels['GOOGL'].spreadMultiplier).toBe(1.0);
    });
  });
});

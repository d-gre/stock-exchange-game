import { describe, it, expect } from 'vitest';
import reducer, {
  initializeFloats,
  transferShares,
  reserveShares,
  releaseReservedShares,
  applyStockSplitToFloat,
  restoreFloats,
  resetFloats,
  calculateFloatShares,
  selectAvailableForPurchase,
  selectIsLowFloat,
  selectFloatUtilization,
  selectFloatBySymbol,
  selectFloatSummary,
  selectAllFloats,
} from './floatSlice';
import { createMockStock, createMockVirtualPlayer } from '../test/utils/mockFactories';

describe('floatSlice', () => {
  const initialState = { floats: {} };

  describe('initializeFloats', () => {
    it('should initialize floats for all stocks', () => {
      const stocks = [
        createMockStock({ symbol: 'AAPL', floatShares: 1000, currentPrice: 150 }),
        createMockStock({ symbol: 'GOOGL', floatShares: 800, currentPrice: 100 }),
      ];
      const playerHoldings = [{ symbol: 'AAPL', shares: 50, avgBuyPrice: 145 }];
      const virtualPlayers = [
        createMockVirtualPlayer({
          portfolio: {
            cash: 10000,
            holdings: [{ symbol: 'AAPL', shares: 100, avgBuyPrice: 140 }],
          },
        }),
      ];

      const state = reducer(initialState, initializeFloats({ stocks, playerHoldings, virtualPlayers }));

      // AAPL: 1000 total, 50 player, 100 VP = 850 MM
      expect(state.floats['AAPL'].totalFloat).toBe(1000);
      expect(state.floats['AAPL'].playerHeldShares).toBe(50);
      expect(state.floats['AAPL'].vpHeldShares).toBe(100);
      expect(state.floats['AAPL'].mmHeldShares).toBe(850);

      // GOOGL: 800 total, 0 player, 0 VP = 800 MM
      expect(state.floats['GOOGL'].totalFloat).toBe(800);
      expect(state.floats['GOOGL'].mmHeldShares).toBe(800);
    });
  });

  describe('transferShares', () => {
    it('should transfer shares from MM to player', () => {
      const state = {
        floats: {
          AAPL: {
            symbol: 'AAPL',
            totalFloat: 1000,
            mmHeldShares: 500,
            playerHeldShares: 100,
            vpHeldShares: 400,
            reservedShares: 0,
          },
        },
      };

      const newState = reducer(
        state,
        transferShares({ symbol: 'AAPL', from: 'mm', to: 'player', shares: 50 })
      );

      expect(newState.floats['AAPL'].mmHeldShares).toBe(450);
      expect(newState.floats['AAPL'].playerHeldShares).toBe(150);
    });

    it('should transfer shares from player to VP', () => {
      const state = {
        floats: {
          AAPL: {
            symbol: 'AAPL',
            totalFloat: 1000,
            mmHeldShares: 500,
            playerHeldShares: 100,
            vpHeldShares: 400,
            reservedShares: 0,
          },
        },
      };

      const newState = reducer(
        state,
        transferShares({ symbol: 'AAPL', from: 'player', to: 'vp', shares: 30 })
      );

      expect(newState.floats['AAPL'].playerHeldShares).toBe(70);
      expect(newState.floats['AAPL'].vpHeldShares).toBe(430);
    });

    it('should not go below 0 when transferring', () => {
      const state = {
        floats: {
          AAPL: {
            symbol: 'AAPL',
            totalFloat: 1000,
            mmHeldShares: 10,
            playerHeldShares: 100,
            vpHeldShares: 890,
            reservedShares: 0,
          },
        },
      };

      const newState = reducer(
        state,
        transferShares({ symbol: 'AAPL', from: 'mm', to: 'player', shares: 50 })
      );

      expect(newState.floats['AAPL'].mmHeldShares).toBe(0);
      expect(newState.floats['AAPL'].playerHeldShares).toBe(150);
    });
  });

  describe('reserveShares', () => {
    it('should reserve shares', () => {
      const state = {
        floats: {
          AAPL: {
            symbol: 'AAPL',
            totalFloat: 1000,
            mmHeldShares: 500,
            playerHeldShares: 100,
            vpHeldShares: 400,
            reservedShares: 0,
          },
        },
      };

      const newState = reducer(state, reserveShares({ symbol: 'AAPL', shares: 25 }));

      expect(newState.floats['AAPL'].reservedShares).toBe(25);
    });
  });

  describe('releaseReservedShares', () => {
    it('should release reserved shares', () => {
      const state = {
        floats: {
          AAPL: {
            symbol: 'AAPL',
            totalFloat: 1000,
            mmHeldShares: 500,
            playerHeldShares: 100,
            vpHeldShares: 400,
            reservedShares: 50,
          },
        },
      };

      const newState = reducer(state, releaseReservedShares({ symbol: 'AAPL', shares: 25 }));

      expect(newState.floats['AAPL'].reservedShares).toBe(25);
    });
  });

  describe('applyStockSplitToFloat', () => {
    it('should multiply all shares by split ratio', () => {
      const state = {
        floats: {
          AAPL: {
            symbol: 'AAPL',
            totalFloat: 1000,
            mmHeldShares: 500,
            playerHeldShares: 100,
            vpHeldShares: 400,
            reservedShares: 10,
          },
        },
      };

      const newState = reducer(state, applyStockSplitToFloat({ symbol: 'AAPL', ratio: 2 }));

      expect(newState.floats['AAPL'].totalFloat).toBe(2000);
      expect(newState.floats['AAPL'].mmHeldShares).toBe(1000);
      expect(newState.floats['AAPL'].playerHeldShares).toBe(200);
      expect(newState.floats['AAPL'].vpHeldShares).toBe(800);
      expect(newState.floats['AAPL'].reservedShares).toBe(20);
    });
  });

  describe('selectors', () => {
    const state = {
      float: {
        floats: {
          AAPL: {
            symbol: 'AAPL',
            totalFloat: 1000,
            mmHeldShares: 500,
            playerHeldShares: 100,
            vpHeldShares: 400,
            reservedShares: 0,
          },
          LOW: {
            symbol: 'LOW',
            totalFloat: 1000,
            mmHeldShares: 50, // 5% - below 10% warning threshold
            playerHeldShares: 450,
            vpHeldShares: 500,
            reservedShares: 0,
          },
        },
      },
    };

    it('selectAvailableForPurchase should return MM held shares', () => {
      expect(selectAvailableForPurchase(state, 'AAPL')).toBe(500);
    });

    it('selectIsLowFloat should detect low float', () => {
      expect(selectIsLowFloat(state, 'AAPL')).toBe(false);
      expect(selectIsLowFloat(state, 'LOW')).toBe(true);
    });

    it('selectFloatUtilization should calculate correctly', () => {
      // (100 + 400) / 1000 = 0.5
      expect(selectFloatUtilization(state, 'AAPL')).toBe(0.5);
      // (450 + 500) / 1000 = 0.95
      expect(selectFloatUtilization(state, 'LOW')).toBe(0.95);
    });

    it('selectFloatBySymbol should return float for symbol', () => {
      const float = selectFloatBySymbol(state, 'AAPL');
      expect(float?.symbol).toBe('AAPL');
      expect(float?.totalFloat).toBe(1000);
    });

    it('selectFloatBySymbol should return undefined for unknown symbol', () => {
      expect(selectFloatBySymbol(state, 'UNKNOWN')).toBeUndefined();
    });

    it('selectAllFloats should return all floats', () => {
      const floats = selectAllFloats(state);
      expect(Object.keys(floats)).toEqual(['AAPL', 'LOW']);
    });

    it('selectFloatSummary should return summary for all floats', () => {
      const summary = selectFloatSummary(state);
      expect(summary['AAPL']).toEqual({
        available: 500,
        total: 1000,
        utilization: 0.5,
      });
      expect(summary['LOW']).toEqual({
        available: 50,
        total: 1000,
        utilization: 0.95,
      });
    });

    it('selectAvailableForPurchase should return 0 for unknown symbol', () => {
      expect(selectAvailableForPurchase(state, 'UNKNOWN')).toBe(0);
    });

    it('selectIsLowFloat should return false for unknown symbol', () => {
      expect(selectIsLowFloat(state, 'UNKNOWN')).toBe(false);
    });

    it('selectFloatUtilization should return 0 for unknown symbol', () => {
      expect(selectFloatUtilization(state, 'UNKNOWN')).toBe(0);
    });

    it('selectIsLowFloat should return false for zero totalFloat', () => {
      const zeroState = {
        float: {
          floats: {
            ZERO: {
              symbol: 'ZERO',
              totalFloat: 0,
              mmHeldShares: 0,
              playerHeldShares: 0,
              vpHeldShares: 0,
              reservedShares: 0,
            },
          },
        },
      };
      expect(selectIsLowFloat(zeroState, 'ZERO')).toBe(false);
    });

    it('selectFloatUtilization should return 0 for zero totalFloat', () => {
      const zeroState = {
        float: {
          floats: {
            ZERO: {
              symbol: 'ZERO',
              totalFloat: 0,
              mmHeldShares: 0,
              playerHeldShares: 0,
              vpHeldShares: 0,
              reservedShares: 0,
            },
          },
        },
      };
      expect(selectFloatUtilization(zeroState, 'ZERO')).toBe(0);
    });
  });

  describe('calculateFloatShares', () => {
    it('should calculate float shares from market cap and price', () => {
      // 100B market cap / $100 price = 1B shares
      // * 0.20 (20% float) / 1000 (scale factor) = 200,000
      const result = calculateFloatShares(100, 100);
      expect(result).toBe(200000);
    });

    it('should floor the result', () => {
      const result = calculateFloatShares(10, 150);
      // 10B / 150 = 66.67M * 0.20 / 1000 = 13333.33 -> 13333
      expect(result).toBe(13333);
    });
  });

  describe('transferShares - additional cases', () => {
    it('should transfer shares from VP to MM', () => {
      const state = {
        floats: {
          AAPL: {
            symbol: 'AAPL',
            totalFloat: 1000,
            mmHeldShares: 500,
            playerHeldShares: 100,
            vpHeldShares: 400,
            reservedShares: 0,
          },
        },
      };

      const newState = reducer(
        state,
        transferShares({ symbol: 'AAPL', from: 'vp', to: 'mm', shares: 50 })
      );

      expect(newState.floats['AAPL'].vpHeldShares).toBe(350);
      expect(newState.floats['AAPL'].mmHeldShares).toBe(550);
    });

    it('should transfer shares from MM to VP', () => {
      const state = {
        floats: {
          AAPL: {
            symbol: 'AAPL',
            totalFloat: 1000,
            mmHeldShares: 500,
            playerHeldShares: 100,
            vpHeldShares: 400,
            reservedShares: 0,
          },
        },
      };

      const newState = reducer(
        state,
        transferShares({ symbol: 'AAPL', from: 'mm', to: 'vp', shares: 100 })
      );

      expect(newState.floats['AAPL'].mmHeldShares).toBe(400);
      expect(newState.floats['AAPL'].vpHeldShares).toBe(500);
    });

    it('should not transfer if symbol does not exist', () => {
      const state = { floats: {} };
      const newState = reducer(
        state,
        transferShares({ symbol: 'AAPL', from: 'mm', to: 'player', shares: 50 })
      );
      expect(newState).toEqual(state);
    });

    it('should not transfer if shares is 0 or negative', () => {
      const state = {
        floats: {
          AAPL: {
            symbol: 'AAPL',
            totalFloat: 1000,
            mmHeldShares: 500,
            playerHeldShares: 100,
            vpHeldShares: 400,
            reservedShares: 0,
          },
        },
      };

      const newState = reducer(
        state,
        transferShares({ symbol: 'AAPL', from: 'mm', to: 'player', shares: 0 })
      );
      expect(newState.floats['AAPL'].mmHeldShares).toBe(500);

      const newState2 = reducer(
        state,
        transferShares({ symbol: 'AAPL', from: 'mm', to: 'player', shares: -10 })
      );
      expect(newState2.floats['AAPL'].mmHeldShares).toBe(500);
    });
  });

  describe('reserveShares - edge cases', () => {
    it('should not reserve for unknown symbol', () => {
      const state = { floats: {} };
      const newState = reducer(state, reserveShares({ symbol: 'AAPL', shares: 25 }));
      expect(newState).toEqual(state);
    });

    it('should not reserve negative shares', () => {
      const state = {
        floats: {
          AAPL: {
            symbol: 'AAPL',
            totalFloat: 1000,
            mmHeldShares: 500,
            playerHeldShares: 100,
            vpHeldShares: 400,
            reservedShares: 0,
          },
        },
      };
      const newState = reducer(state, reserveShares({ symbol: 'AAPL', shares: -10 }));
      expect(newState.floats['AAPL'].reservedShares).toBe(0);
    });
  });

  describe('releaseReservedShares - edge cases', () => {
    it('should not release for unknown symbol', () => {
      const state = { floats: {} };
      const newState = reducer(state, releaseReservedShares({ symbol: 'AAPL', shares: 25 }));
      expect(newState).toEqual(state);
    });

    it('should not go below 0 when releasing', () => {
      const state = {
        floats: {
          AAPL: {
            symbol: 'AAPL',
            totalFloat: 1000,
            mmHeldShares: 500,
            playerHeldShares: 100,
            vpHeldShares: 400,
            reservedShares: 10,
          },
        },
      };
      const newState = reducer(state, releaseReservedShares({ symbol: 'AAPL', shares: 50 }));
      expect(newState.floats['AAPL'].reservedShares).toBe(0);
    });
  });

  describe('applyStockSplitToFloat - edge cases', () => {
    it('should not apply split to unknown symbol', () => {
      const state = { floats: {} };
      const newState = reducer(state, applyStockSplitToFloat({ symbol: 'AAPL', ratio: 2 }));
      expect(newState).toEqual(state);
    });
  });

  describe('restoreFloats', () => {
    it('should restore floats from saved state', () => {
      const savedState = {
        floats: {
          AAPL: {
            symbol: 'AAPL',
            totalFloat: 2000,
            mmHeldShares: 1000,
            playerHeldShares: 500,
            vpHeldShares: 500,
            reservedShares: 50,
          },
        },
      };

      const newState = reducer(initialState, restoreFloats(savedState));
      expect(newState).toEqual(savedState);
    });
  });

  describe('resetFloats', () => {
    it('should reset floats to initial state', () => {
      const state = {
        floats: {
          AAPL: {
            symbol: 'AAPL',
            totalFloat: 1000,
            mmHeldShares: 500,
            playerHeldShares: 100,
            vpHeldShares: 400,
            reservedShares: 0,
          },
        },
      };

      const newState = reducer(state, resetFloats());
      expect(newState).toEqual({ floats: {} });
    });
  });

  describe('initializeFloats - edge cases', () => {
    it('should calculate float from market cap if floatShares not provided', () => {
      const stocks = [
        createMockStock({ symbol: 'AAPL', floatShares: undefined, marketCapBillions: 100, currentPrice: 100 }),
      ];

      const state = reducer(initialState, initializeFloats({ stocks, playerHoldings: [], virtualPlayers: [] }));

      // 100B / 100 = 1B shares * 0.20 / 1000 = 200,000
      expect(state.floats['AAPL'].totalFloat).toBe(200000);
    });

    it('should aggregate holdings from multiple VPs', () => {
      const stocks = [
        createMockStock({ symbol: 'AAPL', floatShares: 1000, currentPrice: 150 }),
      ];
      const virtualPlayers = [
        createMockVirtualPlayer({
          id: 'bot-1',
          portfolio: { cash: 10000, holdings: [{ symbol: 'AAPL', shares: 50, avgBuyPrice: 140 }] },
        }),
        createMockVirtualPlayer({
          id: 'bot-2',
          portfolio: { cash: 10000, holdings: [{ symbol: 'AAPL', shares: 30, avgBuyPrice: 145 }] },
        }),
      ];

      const state = reducer(initialState, initializeFloats({ stocks, playerHoldings: [], virtualPlayers }));

      expect(state.floats['AAPL'].vpHeldShares).toBe(80); // 50 + 30
      expect(state.floats['AAPL'].mmHeldShares).toBe(920); // 1000 - 80
    });
  });
});

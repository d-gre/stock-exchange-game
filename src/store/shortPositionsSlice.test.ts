import { describe, it, expect } from 'vitest';
import reducer, {
  openShortPosition,
  closeShortPosition,
  chargeBorrowFees,
  updateMarginCallStatuses,
  markForForcedCover,
  addCollateral,
  applyStockSplitToShorts,
  resetShortPositions,
  restoreShortPositions,
  calculatePositionValue,
  calculateRequiredMargin,
  calculateShortProfitLoss,
  determineBorrowStatus,
  calculateBorrowFee,
  isInMarginCall,
  selectAllShortPositions,
  selectShortPositionBySymbol,
  selectTotalShortExposure,
  selectTotalLockedCollateral,
  selectTotalShortProfitLoss,
  selectShortPositionsWithPL,
  selectMarginCallStatuses,
  selectPositionsInMarginCall,
  selectPositionsForForcedCover,
  selectShortStatistics,
  selectBorrowStatus,
  selectTotalShortInterestBySymbol,
  selectCanShortSymbol,
  selectShortMarginInfo,
} from './shortPositionsSlice';
import { LOAN_CONFIG, SHORT_SELLING_CONFIG } from '../config';
import { createMockStock } from '../test/utils/mockFactories';
import type { ShortPosition, StockFloat } from '../types';

describe('shortPositionsSlice', () => {
  const initialState = {
    positions: [],
    totalBorrowFeesPaid: 0,
    marginCallsReceived: 0,
    forcedCoversExecuted: 0,
    marginCallStatuses: [],
  };

  // ============================================================================
  // HELPER FUNCTIONS TESTS
  // ============================================================================

  describe('helper functions', () => {
    describe('calculatePositionValue', () => {
      it('should calculate position value correctly', () => {
        expect(calculatePositionValue(100, 50)).toBe(5000);
        expect(calculatePositionValue(0, 50)).toBe(0);
        expect(calculatePositionValue(100, 0)).toBe(0);
      });
    });

    describe('calculateRequiredMargin', () => {
      it('should calculate required margin correctly', () => {
        // 100 shares * $50 * 1.5 (150%) = $7500
        expect(calculateRequiredMargin(100, 50, 1.5)).toBe(7500);
        // 100 shares * $50 * 1.25 (125%) = $6250
        expect(calculateRequiredMargin(100, 50, 1.25)).toBe(6250);
      });
    });

    describe('calculateShortProfitLoss', () => {
      it('should calculate profit when price drops', () => {
        // Entry $100, Current $80, 10 shares = ($100-$80)*10 = $200 profit
        expect(calculateShortProfitLoss(100, 80, 10)).toBe(200);
      });

      it('should calculate loss when price rises', () => {
        // Entry $100, Current $120, 10 shares = ($100-$120)*10 = -$200 loss
        expect(calculateShortProfitLoss(100, 120, 10)).toBe(-200);
      });

      it('should return 0 when price unchanged', () => {
        expect(calculateShortProfitLoss(100, 100, 10)).toBe(0);
      });
    });

    describe('determineBorrowStatus', () => {
      it('should return easy when short interest is low', () => {
        // 100 shorts / 1000 float = 10% < 50% threshold
        expect(determineBorrowStatus(100, 1000)).toBe('easy');
      });

      it('should return hard when short interest is high', () => {
        // 600 shorts / 1000 float = 60% >= 50% threshold
        expect(determineBorrowStatus(600, 1000)).toBe('hard');
      });

      it('should return hard when float is 0', () => {
        expect(determineBorrowStatus(100, 0)).toBe('hard');
      });

      it('should return hard at exactly threshold', () => {
        // 500 shorts / 1000 float = 50% = threshold
        expect(determineBorrowStatus(500, 1000)).toBe('hard');
      });
    });

    describe('calculateBorrowFee', () => {
      it('should calculate base fee for easy-to-borrow', () => {
        // $10000 * 0.001 = $10
        expect(calculateBorrowFee(10000, 'easy')).toBe(10);
      });

      it('should calculate higher fee for hard-to-borrow', () => {
        // $10000 * 0.001 * 3 = $30
        expect(calculateBorrowFee(10000, 'hard')).toBe(30);
      });
    });

    describe('isInMarginCall', () => {
      it('should return true when effective collateral below maintenance', () => {
        // Collateral: $7000, P/L: -$2000 (loss), Required: $6000
        // Effective: $7000 - $2000 = $5000 < $6000
        expect(isInMarginCall(7000, -2000, 6000)).toBe(true);
      });

      it('should return false when effective collateral above maintenance', () => {
        // Collateral: $7000, P/L: $1000 (profit), Required: $6000
        // Effective: $7000 + $1000 = $8000 > $6000
        expect(isInMarginCall(7000, 1000, 6000)).toBe(false);
      });

      it('should return false when exactly at maintenance', () => {
        // Collateral: $6000, P/L: $0, Required: $6000
        expect(isInMarginCall(6000, 0, 6000)).toBe(false);
      });
    });
  });

  // ============================================================================
  // REDUCER TESTS
  // ============================================================================

  describe('openShortPosition', () => {
    it('should create a new short position', () => {
      const state = reducer(
        initialState,
        openShortPosition({
          symbol: 'AAPL',
          shares: 100,
          entryPrice: 150,
          collateralLocked: 22500, // 150%
        })
      );

      expect(state.positions).toHaveLength(1);
      expect(state.positions[0].symbol).toBe('AAPL');
      expect(state.positions[0].shares).toBe(100);
      expect(state.positions[0].entryPrice).toBe(150);
      expect(state.positions[0].collateralLocked).toBe(22500);
      expect(state.positions[0].totalBorrowFeesPaid).toBe(0);
    });

    it('should average into existing position', () => {
      const existingState = {
        ...initialState,
        positions: [{
          symbol: 'AAPL',
          shares: 100,
          entryPrice: 150,
          openedAt: Date.now(),
          collateralLocked: 22500,
          totalBorrowFeesPaid: 10,
        }],
      };

      const state = reducer(
        existingState,
        openShortPosition({
          symbol: 'AAPL',
          shares: 100,
          entryPrice: 160,
          collateralLocked: 24000,
        })
      );

      expect(state.positions).toHaveLength(1);
      expect(state.positions[0].shares).toBe(200);
      // Average: (100*150 + 100*160) / 200 = 155
      expect(state.positions[0].entryPrice).toBe(155);
      expect(state.positions[0].collateralLocked).toBe(46500);
      // Fees should be preserved
      expect(state.positions[0].totalBorrowFeesPaid).toBe(10);
    });
  });

  describe('closeShortPosition', () => {
    it('should close position fully', () => {
      const existingState = {
        ...initialState,
        positions: [{
          symbol: 'AAPL',
          shares: 100,
          entryPrice: 150,
          openedAt: Date.now(),
          collateralLocked: 22500,
          totalBorrowFeesPaid: 10,
        }],
      };

      const state = reducer(
        existingState,
        closeShortPosition({
          symbol: 'AAPL',
          shares: 100,
          exitPrice: 140,
        })
      );

      expect(state.positions).toHaveLength(0);
    });

    it('should close position partially', () => {
      const existingState = {
        ...initialState,
        positions: [{
          symbol: 'AAPL',
          shares: 100,
          entryPrice: 150,
          openedAt: Date.now(),
          collateralLocked: 22500,
          totalBorrowFeesPaid: 10,
        }],
      };

      const state = reducer(
        existingState,
        closeShortPosition({
          symbol: 'AAPL',
          shares: 50,
          exitPrice: 140,
        })
      );

      expect(state.positions).toHaveLength(1);
      expect(state.positions[0].shares).toBe(50);
      // Collateral should be proportionally released: 22500 * 0.5 = 11250
      expect(state.positions[0].collateralLocked).toBe(11250);
    });

    it('should do nothing for non-existent position', () => {
      const state = reducer(
        initialState,
        closeShortPosition({
          symbol: 'AAPL',
          shares: 100,
          exitPrice: 140,
        })
      );

      expect(state).toEqual(initialState);
    });

    it('should remove from margin call status when fully closed', () => {
      const existingState = {
        ...initialState,
        positions: [{
          symbol: 'AAPL',
          shares: 100,
          entryPrice: 150,
          openedAt: Date.now(),
          collateralLocked: 22500,
          totalBorrowFeesPaid: 0,
        }],
        marginCallStatuses: [{ symbol: 'AAPL', cyclesRemaining: 2 }],
      };

      const state = reducer(
        existingState,
        closeShortPosition({
          symbol: 'AAPL',
          shares: 100,
          exitPrice: 140,
        })
      );

      expect(state.positions).toHaveLength(0);
      expect(state.marginCallStatuses).toHaveLength(0);
    });
  });

  describe('chargeBorrowFees', () => {
    it('should charge borrow fees for all positions', () => {
      const existingState = {
        ...initialState,
        positions: [{
          symbol: 'AAPL',
          shares: 100,
          entryPrice: 150,
          openedAt: Date.now(),
          collateralLocked: 22500,
          totalBorrowFeesPaid: 0,
        }],
      };

      const state = reducer(
        existingState,
        chargeBorrowFees({
          prices: { AAPL: 150 },
          floats: {
            AAPL: {
              symbol: 'AAPL',
              totalFloat: 10000,
              mmHeldShares: 5000,
              playerHeldShares: 100,
              vpHeldShares: 4900,
              reservedShares: 0,
            },
          },
          totalShortsBySymbol: { AAPL: 100 },
        })
      );

      // Position value: 100 * 150 = 15000
      // Easy to borrow (100/10000 = 1%)
      // Fee: 15000 * 0.001 = 15
      expect(state.positions[0].totalBorrowFeesPaid).toBe(15);
      expect(state.totalBorrowFeesPaid).toBe(15);
    });

    it('should charge higher fees for hard-to-borrow stocks', () => {
      const existingState = {
        ...initialState,
        positions: [{
          symbol: 'AAPL',
          shares: 100,
          entryPrice: 150,
          openedAt: Date.now(),
          collateralLocked: 22500,
          totalBorrowFeesPaid: 0,
        }],
      };

      const state = reducer(
        existingState,
        chargeBorrowFees({
          prices: { AAPL: 150 },
          floats: {
            AAPL: {
              symbol: 'AAPL',
              totalFloat: 1000,
              mmHeldShares: 100,
              playerHeldShares: 100,
              vpHeldShares: 800,
              reservedShares: 0,
            },
          },
          totalShortsBySymbol: { AAPL: 600 }, // 60% of float shorted
        })
      );

      // Hard to borrow (600/1000 = 60% >= 50%)
      // Fee: 15000 * 0.001 * 3 = 45
      expect(state.positions[0].totalBorrowFeesPaid).toBe(45);
    });
  });

  describe('updateMarginCallStatuses', () => {
    it('should add margin call status when position is under-collateralized', () => {
      const existingState = {
        ...initialState,
        positions: [{
          symbol: 'AAPL',
          shares: 100,
          entryPrice: 100, // Entry at $100
          openedAt: Date.now(),
          collateralLocked: 15000, // 150% of $10000
          totalBorrowFeesPaid: 0,
        }],
      };

      // Price went up to $150 - big loss!
      // Position value: 100 * 150 = 15000
      // Required maintenance: 15000 * 1.25 = 18750
      // Unrealized P/L: (100 - 150) * 100 = -5000
      // Effective collateral: 15000 - 5000 = 10000 < 18750 = MARGIN CALL!
      const state = reducer(
        existingState,
        updateMarginCallStatuses({ prices: { AAPL: 150 } })
      );

      expect(state.marginCallStatuses).toHaveLength(1);
      expect(state.marginCallStatuses[0].symbol).toBe('AAPL');
      expect(state.marginCallStatuses[0].cyclesRemaining).toBe(5); // Grace period
      expect(state.marginCallsReceived).toBe(1);
    });

    it('should decrement cycles for existing margin call', () => {
      const existingState = {
        ...initialState,
        positions: [{
          symbol: 'AAPL',
          shares: 100,
          entryPrice: 100,
          openedAt: Date.now(),
          collateralLocked: 15000,
          totalBorrowFeesPaid: 0,
        }],
        marginCallStatuses: [{ symbol: 'AAPL', cyclesRemaining: 3 }],
        marginCallsReceived: 1,
      };

      const state = reducer(
        existingState,
        updateMarginCallStatuses({ prices: { AAPL: 150 } })
      );

      expect(state.marginCallStatuses[0].cyclesRemaining).toBe(2);
      // Should not increment marginCallsReceived again
      expect(state.marginCallsReceived).toBe(1);
    });

    it('should remove margin call status when position recovers', () => {
      const existingState = {
        ...initialState,
        positions: [{
          symbol: 'AAPL',
          shares: 100,
          entryPrice: 100,
          openedAt: Date.now(),
          collateralLocked: 15000,
          totalBorrowFeesPaid: 0,
        }],
        marginCallStatuses: [{ symbol: 'AAPL', cyclesRemaining: 2 }],
      };

      // Price went down to $80 - profit!
      // Position value: 100 * 80 = 8000
      // Required maintenance: 8000 * 1.25 = 10000
      // Unrealized P/L: (100 - 80) * 100 = 2000
      // Effective collateral: 15000 + 2000 = 17000 > 10000 = NO MARGIN CALL
      const state = reducer(
        existingState,
        updateMarginCallStatuses({ prices: { AAPL: 80 } })
      );

      expect(state.marginCallStatuses).toHaveLength(0);
    });
  });

  describe('markForForcedCover', () => {
    it('should increment forced covers counter for exhausted grace periods', () => {
      const existingState = {
        ...initialState,
        positions: [{
          symbol: 'AAPL',
          shares: 100,
          entryPrice: 100,
          openedAt: Date.now(),
          collateralLocked: 15000,
          totalBorrowFeesPaid: 0,
        }],
        marginCallStatuses: [{ symbol: 'AAPL', cyclesRemaining: 0 }],
      };

      const state = reducer(existingState, markForForcedCover());

      expect(state.forcedCoversExecuted).toBe(1);
    });
  });

  describe('addCollateral', () => {
    it('should add collateral to position', () => {
      const existingState = {
        ...initialState,
        positions: [{
          symbol: 'AAPL',
          shares: 100,
          entryPrice: 100,
          openedAt: Date.now(),
          collateralLocked: 15000,
          totalBorrowFeesPaid: 0,
        }],
      };

      const state = reducer(
        existingState,
        addCollateral({ symbol: 'AAPL', amount: 5000 })
      );

      expect(state.positions[0].collateralLocked).toBe(20000);
    });

    it('should do nothing for non-existent position', () => {
      const state = reducer(
        initialState,
        addCollateral({ symbol: 'AAPL', amount: 5000 })
      );

      expect(state).toEqual(initialState);
    });
  });

  describe('applyStockSplitToShorts', () => {
    it('should adjust shares and entry price for stock split', () => {
      const existingState = {
        ...initialState,
        positions: [{
          symbol: 'AAPL',
          shares: 100,
          entryPrice: 300,
          openedAt: Date.now(),
          collateralLocked: 45000,
          totalBorrowFeesPaid: 0,
        }],
      };

      const state = reducer(
        existingState,
        applyStockSplitToShorts({ symbol: 'AAPL', ratio: 3 })
      );

      expect(state.positions[0].shares).toBe(300);
      expect(state.positions[0].entryPrice).toBe(100);
      // Collateral stays the same
      expect(state.positions[0].collateralLocked).toBe(45000);
    });
  });

  describe('resetShortPositions', () => {
    it('should reset to initial state', () => {
      const existingState = {
        positions: [{
          symbol: 'AAPL',
          shares: 100,
          entryPrice: 150,
          openedAt: Date.now(),
          collateralLocked: 22500,
          totalBorrowFeesPaid: 50,
        }],
        totalBorrowFeesPaid: 100,
        marginCallsReceived: 2,
        forcedCoversExecuted: 1,
        marginCallStatuses: [{ symbol: 'AAPL', cyclesRemaining: 1 }],
      };

      const state = reducer(existingState, resetShortPositions());

      expect(state).toEqual(initialState);
    });
  });

  describe('restoreShortPositions', () => {
    it('should restore state from saved data', () => {
      const savedState = {
        positions: [{
          symbol: 'AAPL',
          shares: 100,
          entryPrice: 150,
          openedAt: Date.now(),
          collateralLocked: 22500,
          totalBorrowFeesPaid: 50,
        }],
        totalBorrowFeesPaid: 100,
        marginCallsReceived: 2,
        forcedCoversExecuted: 1,
        marginCallStatuses: [{ symbol: 'AAPL', cyclesRemaining: 1 }],
      };

      const state = reducer(initialState, restoreShortPositions(savedState));

      expect(state).toEqual(savedState);
    });
  });

  // ============================================================================
  // SELECTOR TESTS
  // ============================================================================

  describe('selectors', () => {
    const mockPosition: ShortPosition = {
      symbol: 'AAPL',
      shares: 100,
      entryPrice: 150,
      openedAt: Date.now(),
      collateralLocked: 22500,
      totalBorrowFeesPaid: 10,
    };

    const mockFloat: StockFloat = {
      symbol: 'AAPL',
      totalFloat: 10000,
      mmHeldShares: 5000,
      playerHeldShares: 100,
      vpHeldShares: 4900,
      reservedShares: 0,
    };

    const mockState = {
      shortPositions: {
        positions: [mockPosition],
        totalBorrowFeesPaid: 10,
        marginCallsReceived: 0,
        forcedCoversExecuted: 0,
        marginCallStatuses: [],
      },
      stocks: {
        items: [createMockStock({ symbol: 'AAPL', currentPrice: 140 })],
      },
      float: {
        floats: { AAPL: mockFloat },
      },
      loans: {
        loans: [],
      },
      portfolio: {
        cash: 100000,
      },
    };

    describe('selectAllShortPositions', () => {
      it('should return all positions', () => {
        expect(selectAllShortPositions(mockState)).toEqual([mockPosition]);
      });
    });

    describe('selectShortPositionBySymbol', () => {
      it('should return position for symbol', () => {
        expect(selectShortPositionBySymbol(mockState, 'AAPL')).toEqual(mockPosition);
      });

      it('should return undefined for unknown symbol', () => {
        expect(selectShortPositionBySymbol(mockState, 'UNKNOWN')).toBeUndefined();
      });
    });

    describe('selectTotalShortExposure', () => {
      it('should calculate total exposure at current prices', () => {
        // 100 shares * $140 = $14000
        expect(selectTotalShortExposure(mockState)).toBe(14000);
      });
    });

    describe('selectTotalLockedCollateral', () => {
      it('should sum all locked collateral', () => {
        expect(selectTotalLockedCollateral(mockState)).toBe(22500);
      });
    });

    describe('selectTotalShortProfitLoss', () => {
      it('should calculate total unrealized P/L', () => {
        // Entry: $150, Current: $140, 100 shares
        // P/L: (150 - 140) * 100 = $1000 profit
        expect(selectTotalShortProfitLoss(mockState)).toBe(1000);
      });
    });

    describe('selectShortPositionsWithPL', () => {
      it('should return positions with P/L calculations', () => {
        const result = selectShortPositionsWithPL(mockState);

        expect(result).toHaveLength(1);
        expect(result[0].currentPrice).toBe(140);
        expect(result[0].unrealizedPL).toBe(1000);
        expect(result[0].currentValue).toBe(14000);
        // P/L %: 1000 / (100 * 150) = 6.67%
        expect(result[0].unrealizedPLPercent).toBeCloseTo(6.67, 1);
      });
    });

    describe('selectMarginCallStatuses', () => {
      it('should return margin call statuses', () => {
        const stateWithMarginCall = {
          ...mockState,
          shortPositions: {
            ...mockState.shortPositions,
            marginCallStatuses: [{ symbol: 'AAPL', cyclesRemaining: 2 }],
          },
        };

        expect(selectMarginCallStatuses(stateWithMarginCall)).toHaveLength(1);
      });
    });

    describe('selectPositionsInMarginCall', () => {
      it('should return symbols in margin call', () => {
        const stateWithMarginCall = {
          ...mockState,
          shortPositions: {
            ...mockState.shortPositions,
            marginCallStatuses: [{ symbol: 'AAPL', cyclesRemaining: 2 }],
          },
        };

        expect(selectPositionsInMarginCall(stateWithMarginCall)).toEqual(['AAPL']);
      });
    });

    describe('selectPositionsForForcedCover', () => {
      it('should return symbols needing forced cover', () => {
        const stateWithExpiredMarginCall = {
          ...mockState,
          shortPositions: {
            ...mockState.shortPositions,
            marginCallStatuses: [
              { symbol: 'AAPL', cyclesRemaining: 0 },
              { symbol: 'GOOGL', cyclesRemaining: 2 },
            ],
          },
        };

        expect(selectPositionsForForcedCover(stateWithExpiredMarginCall)).toEqual(['AAPL']);
      });
    });

    describe('selectShortStatistics', () => {
      it('should return statistics', () => {
        const stats = selectShortStatistics(mockState);

        expect(stats.totalBorrowFeesPaid).toBe(10);
        expect(stats.marginCallsReceived).toBe(0);
        expect(stats.forcedCoversExecuted).toBe(0);
        expect(stats.openPositionsCount).toBe(1);
      });
    });

    describe('selectBorrowStatus', () => {
      it('should return easy for low short interest', () => {
        expect(selectBorrowStatus(mockState, 'AAPL')).toBe('easy');
      });

      it('should return easy for unknown symbol', () => {
        expect(selectBorrowStatus(mockState, 'UNKNOWN')).toBe('easy');
      });
    });

    describe('selectTotalShortInterestBySymbol', () => {
      it('should aggregate short interest by symbol', () => {
        const multiPositionState = {
          ...mockState,
          shortPositions: {
            ...mockState.shortPositions,
            positions: [
              mockPosition,
              { ...mockPosition, symbol: 'GOOGL', shares: 50 },
            ],
          },
        };

        const result = selectTotalShortInterestBySymbol(multiPositionState);
        expect(result).toEqual({ AAPL: 100, GOOGL: 50 });
      });
    });

    describe('selectCanShortSymbol', () => {
      it('should allow shorting when within limits', () => {
        const result = selectCanShortSymbol(mockState, 'AAPL');

        expect(result.canShort).toBe(true);
        // Max: 10000 * 0.5 = 5000, Current: 100, Available: 4900
        expect(result.availableShares).toBe(4900);
      });

      it('should return no_float_info for unknown symbol', () => {
        const result = selectCanShortSymbol(mockState, 'UNKNOWN');

        expect(result.canShort).toBe(false);
        expect(result.reason).toBe('no_float_info');
      });

      it('should return max_short_reached when limit hit', () => {
        const stateAtLimit = {
          ...mockState,
          shortPositions: {
            ...mockState.shortPositions,
            positions: [{ ...mockPosition, shares: 5000 }], // 50% of float
          },
        };

        const result = selectCanShortSymbol(stateAtLimit, 'AAPL');

        expect(result.canShort).toBe(false);
        expect(result.reason).toBe('max_short_reached');
      });
    });

    describe('selectShortMarginInfo', () => {
      it('should include base collateral in available margin calculation', () => {
        const initialCash = 100000;
        const baseCollateral = initialCash * LOAN_CONFIG.baseCollateralPercent; // 25000

        // State with no holdings but with base collateral
        const stateWithBaseCollateral = {
          shortPositions: {
            positions: [],
            totalBorrowFeesPaid: 0,
            marginCallsReceived: 0,
            forcedCoversExecuted: 0,
            marginCallStatuses: [],
          },
          stocks: {
            items: [createMockStock({ symbol: 'AAPL', currentPrice: 100 })],
          },
          float: {
            floats: {},
          },
          loans: {
            loans: [],
          },
          portfolio: {
            cash: initialCash,
            holdings: [],
          },
          pendingOrders: {
            orders: [],
          },
          settings: {
            initialCash,
          },
        };

        // Credit line info based on base collateral only (no stock holdings)
        // recommendedCreditLine = floor(baseCollateral / 1000) * 1000 = 25000
        // maxCreditLine = 25000 * 2.5 = 62500
        // availableCredit = 62500 - 0 (no debt) = 62500
        const creditLineInfo = {
          recommendedCreditLine: Math.floor(baseCollateral / 1000) * 1000,
          maxCreditLine: Math.floor(baseCollateral / 1000) * 1000 * LOAN_CONFIG.maxCreditLineMultiplier,
          currentDebt: 0,
          availableCredit: Math.floor(baseCollateral / 1000) * 1000 * LOAN_CONFIG.maxCreditLineMultiplier,
          utilizationRatio: 0,
          utilizationVsRecommended: 0,
          activeLoansCount: 0,
          collateralBreakdown: {
            largeCapStocks: 0,
            smallCapStocks: 0,
            baseCollateral,
            total: baseCollateral,
          },
        };

        const result = selectShortMarginInfo(stateWithBaseCollateral, creditLineInfo);

        // Available margin should equal available credit (no positions locked)
        expect(result.availableMargin).toBe(creditLineInfo.availableCredit);
        expect(result.availableMargin).toBe(62500);
        expect(result.totalCollateralLocked).toBe(0);
        expect(result.totalMarginRequired).toBe(0);
      });

      it('should reduce available margin by locked collateral from existing positions', () => {
        const initialCash = 100000;
        const baseCollateral = initialCash * LOAN_CONFIG.baseCollateralPercent; // 25000
        const lockedCollateral = 15000; // Existing short position

        const stateWithPosition = {
          shortPositions: {
            positions: [{
              symbol: 'AAPL',
              shares: 100,
              entryPrice: 100,
              openedAt: Date.now(),
              collateralLocked: lockedCollateral,
              totalBorrowFeesPaid: 0,
            }],
            totalBorrowFeesPaid: 0,
            marginCallsReceived: 0,
            forcedCoversExecuted: 0,
            marginCallStatuses: [],
          },
          stocks: {
            items: [createMockStock({ symbol: 'AAPL', currentPrice: 100 })],
          },
          float: {
            floats: {},
          },
          loans: {
            loans: [],
          },
          portfolio: {
            cash: initialCash - lockedCollateral, // Cash reduced by locked collateral
            holdings: [],
          },
          pendingOrders: {
            orders: [],
          },
          settings: {
            initialCash,
          },
        };

        const creditLineInfo = {
          recommendedCreditLine: 25000,
          maxCreditLine: 62500,
          currentDebt: 0,
          availableCredit: 62500,
          utilizationRatio: 0,
          utilizationVsRecommended: 0,
          activeLoansCount: 0,
          collateralBreakdown: {
            largeCapStocks: 0,
            smallCapStocks: 0,
            baseCollateral,
            total: baseCollateral,
          },
        };

        const result = selectShortMarginInfo(stateWithPosition, creditLineInfo);

        // Available margin = availableCredit - totalCollateralLocked
        // = 62500 - 15000 = 47500
        expect(result.totalCollateralLocked).toBe(lockedCollateral);
        expect(result.availableMargin).toBe(62500 - lockedCollateral);
        expect(result.availableMargin).toBe(47500);
      });

      it('should allow short selling with only base collateral (no stock holdings)', () => {
        const initialCash = 100000;
        const baseCollateral = initialCash * LOAN_CONFIG.baseCollateralPercent; // 25000

        // maxCreditLine based on base collateral = 62500
        // With initial margin of 150%, player can short up to:
        // maxShortValue = availableMargin / initialMarginPercent = 62500 / 1.5 = 41666.67
        const creditLineInfo = {
          recommendedCreditLine: 25000,
          maxCreditLine: 62500,
          currentDebt: 0,
          availableCredit: 62500,
          utilizationRatio: 0,
          utilizationVsRecommended: 0,
          activeLoansCount: 0,
          collateralBreakdown: {
            largeCapStocks: 0,
            smallCapStocks: 0,
            baseCollateral,
            total: baseCollateral,
          },
        };

        const stateNoHoldings = {
          shortPositions: {
            positions: [],
            totalBorrowFeesPaid: 0,
            marginCallsReceived: 0,
            forcedCoversExecuted: 0,
            marginCallStatuses: [],
          },
          stocks: {
            items: [createMockStock({ symbol: 'AAPL', currentPrice: 100 })],
          },
          float: {
            floats: {},
          },
          loans: {
            loans: [],
          },
          portfolio: {
            cash: initialCash,
            holdings: [], // No stock holdings!
          },
          pendingOrders: {
            orders: [],
          },
          settings: {
            initialCash,
          },
        };

        const result = selectShortMarginInfo(stateNoHoldings, creditLineInfo);

        // Player should have available margin from base collateral alone
        expect(result.availableMargin).toBeGreaterThan(0);

        // Calculate maximum short position value possible
        const maxShortValue = result.availableMargin / SHORT_SELLING_CONFIG.initialMarginPercent;
        expect(maxShortValue).toBeCloseTo(41666.67, 0);
      });
    });
  });
});

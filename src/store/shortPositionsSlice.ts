import { createSlice, createSelector } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { ShortPosition, Stock, StockFloat, BorrowStatus, ShortMarginInfo, CreditLineInfo } from '../types';
import { SHORT_SELLING_CONFIG } from '../config';

// ============================================================================
// STATE INTERFACE
// ============================================================================

/**
 * Margin call status for a position.
 */
interface MarginCallStatus {
  /** Symbol of the position in margin call */
  symbol: string;
  /** Cycles remaining before forced cover */
  cyclesRemaining: number;
}

interface ShortPositionsState {
  /** All open short positions */
  positions: ShortPosition[];
  /** Total borrow fees paid across all positions (for statistics) */
  totalBorrowFeesPaid: number;
  /** Number of margin calls received (for statistics) */
  marginCallsReceived: number;
  /** Number of forced covers executed (for statistics) */
  forcedCoversExecuted: number;
  /** Positions currently in margin call with grace period countdown */
  marginCallStatuses: MarginCallStatus[];
}

const initialState: ShortPositionsState = {
  positions: [],
  totalBorrowFeesPaid: 0,
  marginCallsReceived: 0,
  forcedCoversExecuted: 0,
  marginCallStatuses: [],
};

// ============================================================================
// HELPER FUNCTIONS (exported for testing)
// ============================================================================

/**
 * Calculates the current value of a short position.
 * Position value = shares * current price
 */
export const calculatePositionValue = (
  shares: number,
  currentPrice: number
): number => {
  return shares * currentPrice;
};

/**
 * Calculates the required margin for a short position.
 * Required margin = position value * margin percent
 */
export const calculateRequiredMargin = (
  shares: number,
  currentPrice: number,
  marginPercent: number
): number => {
  return calculatePositionValue(shares, currentPrice) * marginPercent;
};

/**
 * Calculates unrealized P/L for a short position.
 * Profit = (entry price - current price) * shares
 * Positive = profit (price went down), Negative = loss (price went up)
 */
export const calculateShortProfitLoss = (
  entryPrice: number,
  currentPrice: number,
  shares: number
): number => {
  return (entryPrice - currentPrice) * shares;
};

/**
 * Determines the borrow status based on short interest vs float.
 */
export const determineBorrowStatus = (
  totalShortShares: number,
  floatShares: number
): BorrowStatus => {
  if (floatShares === 0) return 'hard';
  const shortInterestRatio = totalShortShares / floatShares;
  return shortInterestRatio >= SHORT_SELLING_CONFIG.hardToBorrowThreshold ? 'hard' : 'easy';
};

/**
 * Calculates the borrow fee for a position for one cycle.
 */
export const calculateBorrowFee = (
  positionValue: number,
  borrowStatus: BorrowStatus
): number => {
  const baseFee = positionValue * SHORT_SELLING_CONFIG.baseBorrowFeePerCycle;
  return borrowStatus === 'hard'
    ? baseFee * SHORT_SELLING_CONFIG.hardToBorrowFeeMultiplier
    : baseFee;
};

/**
 * Checks if a position is in margin call territory.
 * Returns true if collateral < required maintenance margin.
 */
export const isInMarginCall = (
  collateralLocked: number,
  unrealizedPL: number,
  requiredMaintenanceMargin: number
): boolean => {
  const effectiveCollateral = collateralLocked + unrealizedPL;
  return effectiveCollateral < requiredMaintenanceMargin;
};

// ============================================================================
// SLICE DEFINITION
// ============================================================================

const shortPositionsSlice = createSlice({
  name: 'shortPositions',
  initialState,
  reducers: {
    /**
     * Open a new short position.
     * Called when a short sell order is executed.
     */
    openShortPosition: (state, action: PayloadAction<{
      symbol: string;
      shares: number;
      entryPrice: number;
      collateralLocked: number;
    }>) => {
      const { symbol, shares, entryPrice, collateralLocked } = action.payload;

      // Check if position for this symbol already exists
      const existingPosition = state.positions.find(p => p.symbol === symbol);

      if (existingPosition) {
        // Average into existing position
        const totalShares = existingPosition.shares + shares;
        const totalValue = (existingPosition.shares * existingPosition.entryPrice) +
                          (shares * entryPrice);
        existingPosition.entryPrice = totalValue / totalShares;
        existingPosition.shares = totalShares;
        existingPosition.collateralLocked += collateralLocked;
      } else {
        // Create new position
        const newPosition: ShortPosition = {
          symbol,
          shares,
          entryPrice,
          openedAt: Date.now(),
          collateralLocked,
          totalBorrowFeesPaid: 0,
        };
        state.positions.push(newPosition);
      }
    },

    /**
     * Close (cover) a short position partially or fully.
     * Called when a buy-to-cover order is executed.
     */
    closeShortPosition: (state, action: PayloadAction<{
      symbol: string;
      shares: number;
      exitPrice: number;
    }>) => {
      const { symbol, shares, exitPrice: _exitPrice } = action.payload;
      const position = state.positions.find(p => p.symbol === symbol);

      if (!position) return;

      const sharesToClose = Math.min(shares, position.shares);
      const closeRatio = sharesToClose / position.shares;

      // Release proportional collateral
      const collateralToRelease = position.collateralLocked * closeRatio;
      position.collateralLocked -= collateralToRelease;

      // Update position
      position.shares -= sharesToClose;

      // Remove position if fully closed
      if (position.shares <= 0) {
        state.positions = state.positions.filter(p => p.symbol !== symbol);
        // Also remove from margin call status if present
        state.marginCallStatuses = state.marginCallStatuses.filter(m => m.symbol !== symbol);
      }

      // Note: Realized P/L is calculated and handled by the caller
      // P/L = (entryPrice - exitPrice) * sharesToClose - fees
    },

    /**
     * Charge borrow fees for all positions (called per cycle).
     */
    chargeBorrowFees: (state, action: PayloadAction<{
      /** Current prices by symbol */
      prices: Record<string, number>;
      /** Float info by symbol for determining borrow status */
      floats: Record<string, StockFloat>;
      /** Total short shares by symbol (including VPs) */
      totalShortsBySymbol: Record<string, number>;
    }>) => {
      const { prices, floats, totalShortsBySymbol } = action.payload;

      for (const position of state.positions) {
        const currentPrice = prices[position.symbol];
        if (currentPrice === undefined) continue;

        const positionValue = calculatePositionValue(position.shares, currentPrice);
        const floatInfo = floats[position.symbol];
        const totalShorts = totalShortsBySymbol[position.symbol] ?? position.shares;

        const borrowStatus = floatInfo
          ? determineBorrowStatus(totalShorts, floatInfo.totalFloat)
          : 'easy';

        const fee = calculateBorrowFee(positionValue, borrowStatus);

        position.totalBorrowFeesPaid += fee;
        state.totalBorrowFeesPaid += fee;

        // Note: The actual cash deduction is handled by the game loop
        // which dispatches deductCash after getting the total fee
      }
    },

    /**
     * Update margin call statuses based on current prices.
     */
    updateMarginCallStatuses: (state, action: PayloadAction<{
      prices: Record<string, number>;
    }>) => {
      const { prices } = action.payload;
      const { maintenanceMarginPercent, marginCallGraceCycles } = SHORT_SELLING_CONFIG;

      for (const position of state.positions) {
        const currentPrice = prices[position.symbol];
        if (currentPrice === undefined) continue;

        const requiredMargin = calculateRequiredMargin(
          position.shares,
          currentPrice,
          maintenanceMarginPercent
        );
        const unrealizedPL = calculateShortProfitLoss(
          position.entryPrice,
          currentPrice,
          position.shares
        );

        const inMarginCall = isInMarginCall(
          position.collateralLocked,
          unrealizedPL,
          requiredMargin
        );

        const existingStatus = state.marginCallStatuses.find(m => m.symbol === position.symbol);

        if (inMarginCall) {
          if (!existingStatus) {
            // New margin call
            state.marginCallStatuses.push({
              symbol: position.symbol,
              cyclesRemaining: marginCallGraceCycles,
            });
            state.marginCallsReceived += 1;
          } else {
            // Existing margin call - decrement cycles
            existingStatus.cyclesRemaining -= 1;
          }
        } else {
          // No longer in margin call - remove status
          if (existingStatus) {
            state.marginCallStatuses = state.marginCallStatuses.filter(
              m => m.symbol !== position.symbol
            );
          }
        }
      }
    },

    /**
     * Execute forced cover for positions that exhausted their margin call grace period.
     * Returns symbols that need forced covering (handled by game loop).
     */
    markForForcedCover: (state) => {
      // Find positions with 0 cycles remaining
      const toForceClose = state.marginCallStatuses.filter(m => m.cyclesRemaining <= 0);

      // Count forced covers (actual closing is done by game loop calling closeShortPosition)
      state.forcedCoversExecuted += toForceClose.length;
    },

    /**
     * Add additional collateral to a position (to avoid margin call).
     */
    addCollateral: (state, action: PayloadAction<{
      symbol: string;
      amount: number;
    }>) => {
      const { symbol, amount } = action.payload;
      const position = state.positions.find(p => p.symbol === symbol);

      if (position) {
        position.collateralLocked += amount;
      }
    },

    /**
     * Adjust positions after a stock split.
     * Shares are multiplied, entry price is divided.
     */
    applyStockSplit: (state, action: PayloadAction<{
      symbol: string;
      ratio: number;
    }>) => {
      const { symbol, ratio } = action.payload;
      const position = state.positions.find(p => p.symbol === symbol);

      if (position) {
        position.shares *= ratio;
        position.entryPrice /= ratio;
        // Collateral stays the same (dollar value doesn't change)
      }
    },

    /**
     * Reset all short positions (for new game).
     */
    resetShortPositions: () => initialState,

    /**
     * Restore short positions from saved game.
     */
    restoreShortPositions: (_state, action: PayloadAction<ShortPositionsState>) => {
      return action.payload;
    },
  },
});

// ============================================================================
// ACTIONS
// ============================================================================

export const {
  openShortPosition,
  closeShortPosition,
  chargeBorrowFees,
  updateMarginCallStatuses,
  markForForcedCover,
  addCollateral,
  applyStockSplit: applyStockSplitToShorts,
  resetShortPositions,
  restoreShortPositions,
} = shortPositionsSlice.actions;

// ============================================================================
// SELECTORS
// ============================================================================

interface RootStateWithShortPositions {
  shortPositions: ShortPositionsState;
  stocks: { items: Stock[] };
  float: { floats: Record<string, StockFloat> };
  loans: { loans: Array<{ balance: number }> };
  portfolio: { cash: number };
}

/** Select all short positions */
export const selectAllShortPositions = (state: RootStateWithShortPositions): ShortPosition[] =>
  state.shortPositions.positions;

/** Select short position by symbol */
export const selectShortPositionBySymbol = (
  state: RootStateWithShortPositions,
  symbol: string
): ShortPosition | undefined =>
  state.shortPositions.positions.find(p => p.symbol === symbol);

/** Select total short exposure (sum of all position values at current prices) */
export const selectTotalShortExposure = createSelector(
  [
    (state: RootStateWithShortPositions) => state.shortPositions.positions,
    (state: RootStateWithShortPositions) => state.stocks.items,
  ],
  (positions, stocks): number => {
    return positions.reduce((total, position) => {
      const stock = stocks.find(s => s.symbol === position.symbol);
      const currentPrice = stock?.currentPrice ?? position.entryPrice;
      return total + calculatePositionValue(position.shares, currentPrice);
    }, 0);
  }
);

/** Select total locked collateral */
export const selectTotalLockedCollateral = (state: RootStateWithShortPositions): number =>
  state.shortPositions.positions.reduce((sum, p) => sum + p.collateralLocked, 0);

/** Select total unrealized P/L for all short positions */
export const selectTotalShortProfitLoss = createSelector(
  [
    (state: RootStateWithShortPositions) => state.shortPositions.positions,
    (state: RootStateWithShortPositions) => state.stocks.items,
  ],
  (positions, stocks): number => {
    return positions.reduce((total, position) => {
      const stock = stocks.find(s => s.symbol === position.symbol);
      const currentPrice = stock?.currentPrice ?? position.entryPrice;
      return total + calculateShortProfitLoss(position.entryPrice, currentPrice, position.shares);
    }, 0);
  }
);

/** Select short positions with their current P/L (memoized) */
export const selectShortPositionsWithPL = createSelector(
  [
    (state: RootStateWithShortPositions) => state.shortPositions.positions,
    (state: RootStateWithShortPositions) => state.stocks.items,
  ],
  (positions, stocks): Array<ShortPosition & {
    currentPrice: number;
    unrealizedPL: number;
    unrealizedPLPercent: number;
    currentValue: number;
  }> => {
    return positions.map(position => {
      const stock = stocks.find(s => s.symbol === position.symbol);
      const currentPrice = stock?.currentPrice ?? position.entryPrice;
      const unrealizedPL = calculateShortProfitLoss(position.entryPrice, currentPrice, position.shares);
      const entryValue = position.shares * position.entryPrice;
      const unrealizedPLPercent = entryValue > 0 ? (unrealizedPL / entryValue) * 100 : 0;
      const currentValue = calculatePositionValue(position.shares, currentPrice);

      return {
        ...position,
        currentPrice,
        unrealizedPL,
        unrealizedPLPercent,
        currentValue,
      };
    });
  }
);

/** Select margin call statuses */
export const selectMarginCallStatuses = (state: RootStateWithShortPositions): MarginCallStatus[] =>
  state.shortPositions.marginCallStatuses;

/** Select positions that are in margin call */
export const selectPositionsInMarginCall = createSelector(
  [(state: RootStateWithShortPositions) => state.shortPositions.marginCallStatuses],
  (statuses): string[] => statuses.map(s => s.symbol)
);

/** Select positions that need forced covering (grace period exhausted) */
export const selectPositionsForForcedCover = createSelector(
  [(state: RootStateWithShortPositions) => state.shortPositions.marginCallStatuses],
  (statuses): string[] => statuses.filter(s => s.cyclesRemaining <= 0).map(s => s.symbol)
);

/** Select short selling statistics */
export const selectShortStatistics = (state: RootStateWithShortPositions) => ({
  totalBorrowFeesPaid: state.shortPositions.totalBorrowFeesPaid,
  marginCallsReceived: state.shortPositions.marginCallsReceived,
  forcedCoversExecuted: state.shortPositions.forcedCoversExecuted,
  openPositionsCount: state.shortPositions.positions.length,
});

/** Select borrow status for a specific symbol */
export const selectBorrowStatus = createSelector(
  [
    (state: RootStateWithShortPositions) => state.shortPositions.positions,
    (state: RootStateWithShortPositions) => state.float.floats,
    (_state: RootStateWithShortPositions, symbol: string) => symbol,
  ],
  (positions, floats, symbol): BorrowStatus => {
    const floatInfo = floats[symbol];
    if (!floatInfo) return 'easy';

    // Sum all short positions for this symbol
    const totalShorts = positions
      .filter(p => p.symbol === symbol)
      .reduce((sum, p) => sum + p.shares, 0);

    return determineBorrowStatus(totalShorts, floatInfo.totalFloat);
  }
);

/** Select total short interest by symbol (for float tracking) */
export const selectTotalShortInterestBySymbol = createSelector(
  [(state: RootStateWithShortPositions) => state.shortPositions.positions],
  (positions): Record<string, number> => {
    const result: Record<string, number> = {};
    for (const position of positions) {
      result[position.symbol] = (result[position.symbol] ?? 0) + position.shares;
    }
    return result;
  }
);

/** Check if short selling is available for a symbol (based on float availability) */
export const selectCanShortSymbol = createSelector(
  [
    (state: RootStateWithShortPositions) => state.shortPositions.positions,
    (state: RootStateWithShortPositions) => state.float.floats,
    (_state: RootStateWithShortPositions, symbol: string) => symbol,
  ],
  (positions, floats, symbol): { canShort: boolean; reason?: string; availableShares: number } => {
    if (!SHORT_SELLING_CONFIG.enabled) {
      return { canShort: false, reason: 'disabled', availableShares: 0 };
    }

    const floatInfo = floats[symbol];
    if (!floatInfo) {
      return { canShort: false, reason: 'no_float_info', availableShares: 0 };
    }

    const totalShorts = positions
      .filter(p => p.symbol === symbol)
      .reduce((sum, p) => sum + p.shares, 0);

    const maxShortable = floatInfo.totalFloat * SHORT_SELLING_CONFIG.maxShortPercentOfFloat;
    const availableShares = Math.max(0, maxShortable - totalShorts);

    if (availableShares <= 0) {
      return { canShort: false, reason: 'max_short_reached', availableShares: 0 };
    }

    return { canShort: true, availableShares };
  }
);

/**
 * Select margin info for short positions.
 * Uses the credit line (Option B) as the source for margin.
 *
 * Available margin = (max credit line - current debt) - locked collateral
 */
export const selectShortMarginInfo = createSelector(
  [
    (state: RootStateWithShortPositions) => state.shortPositions.positions,
    (state: RootStateWithShortPositions) => state.stocks.items,
    (_state: RootStateWithShortPositions, creditLineInfo: CreditLineInfo) => creditLineInfo,
  ],
  (positions, stocks, creditLineInfo): ShortMarginInfo => {
    const { maintenanceMarginPercent } = SHORT_SELLING_CONFIG;

    // Calculate total margin required at current prices
    let totalMarginRequired = 0;
    const positionsAtRisk: string[] = [];
    const positionsInMarginCall: string[] = [];

    for (const position of positions) {
      const stock = stocks.find(s => s.symbol === position.symbol);
      const currentPrice = stock?.currentPrice ?? position.entryPrice;
      const positionValue = calculatePositionValue(position.shares, currentPrice);
      const requiredMargin = positionValue * maintenanceMarginPercent;

      totalMarginRequired += requiredMargin;

      // Check P/L to determine risk status
      const unrealizedPL = calculateShortProfitLoss(position.entryPrice, currentPrice, position.shares);
      const effectiveCollateral = position.collateralLocked + unrealizedPL;

      if (effectiveCollateral < requiredMargin) {
        positionsInMarginCall.push(position.symbol);
      } else if (effectiveCollateral < requiredMargin * 1.1) {
        // Within 10% of margin call
        positionsAtRisk.push(position.symbol);
      }
    }

    const totalCollateralLocked = positions.reduce((sum, p) => sum + p.collateralLocked, 0);

    // Available margin from credit line (Option B)
    // The credit line provides the margin for short selling
    const availableMargin = Math.max(0, creditLineInfo.availableCredit - totalCollateralLocked);

    const marginUtilization = creditLineInfo.maxCreditLine > 0
      ? totalCollateralLocked / creditLineInfo.maxCreditLine
      : 0;

    return {
      totalMarginRequired,
      totalCollateralLocked,
      availableMargin,
      marginUtilization,
      positionsAtRisk,
      positionsInMarginCall,
    };
  }
);

/**
 * Calculate the required margin for opening a new short position.
 */
export const calculateInitialMargin = (shares: number, price: number): number => {
  return calculateRequiredMargin(shares, price, SHORT_SELLING_CONFIG.initialMarginPercent);
};

export default shortPositionsSlice.reducer;

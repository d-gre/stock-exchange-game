import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { CompletedTrade, RiskProfileAnalysis, RiskProfileCategory } from '../types';
import type { RootState } from './index';
import { CONFIG } from '../config';

interface TradeHistoryState {
  trades: CompletedTrade[];
  /** Cumulative portfolio value over time (for chart) */
  portfolioValueHistory: Array<{
    timestamp: number;
    value: number;
    realizedProfitLoss: number;
  }>;
}

const initialState: TradeHistoryState = {
  trades: [],
  portfolioValueHistory: [{
    timestamp: Date.now(),
    value: CONFIG.initialCash,
    realizedProfitLoss: 0,
  }],
};

const tradeHistorySlice = createSlice({
  name: 'tradeHistory',
  initialState,
  reducers: {
    addCompletedTrade: (state, action: PayloadAction<CompletedTrade>) => {
      state.trades.unshift(action.payload);
      // Limit to last 100 trades
      if (state.trades.length > 100) {
        state.trades = state.trades.slice(0, 100);
      }
    },
    updatePortfolioValueHistory: (state, action: PayloadAction<{
      portfolioValue: number;
      realizedProfitLoss: number;
    }>) => {
      // Timestamp must be strictly ascending (at least 1ms after last entry)
      const lastEntry = state.portfolioValueHistory[state.portfolioValueHistory.length - 1];
      const now = Date.now();
      const timestamp = lastEntry ? Math.max(now, lastEntry.timestamp + 1) : now;

      state.portfolioValueHistory.push({
        timestamp,
        value: action.payload.portfolioValue,
        realizedProfitLoss: action.payload.realizedProfitLoss,
      });
      // Limit to last 100 data points
      if (state.portfolioValueHistory.length > 100) {
        state.portfolioValueHistory = state.portfolioValueHistory.slice(-100);
      }
    },
    resetTradeHistory: (state) => {
      state.trades = [];
      state.portfolioValueHistory = [{
        timestamp: Date.now(),
        value: CONFIG.initialCash,
        realizedProfitLoss: 0,
      }];
    },
  },
});

// Selectors
export const selectAllTrades = (state: RootState): CompletedTrade[] => state.tradeHistory.trades;

export const selectPortfolioValueHistory = (state: RootState) => state.tradeHistory.portfolioValueHistory;

export const selectTotalRealizedProfitLoss = (state: RootState): number => {
  return state.tradeHistory.trades
    .filter(t => t.type === 'sell' && t.realizedProfitLoss !== undefined)
    .reduce((sum, t) => sum + (t.realizedProfitLoss ?? 0), 0);
};

/**
 * Calculates the player's risk profile based on their trading behavior.
 * Comparable to virtual player risk profiles (-100 to +100).
 */
export const selectRiskProfile = (state: RootState): RiskProfileAnalysis | null => {
  const trades = state.tradeHistory.trades;

  if (trades.length < 2) {
    return null; // Not enough data
  }

  // All sells with realized P/L
  const sellTrades = trades.filter(t => t.type === 'sell' && t.realizedProfitLoss !== undefined);
  const buyTrades = trades.filter(t => t.type === 'buy');

  // Win/loss statistics
  const winningTrades = sellTrades.filter(t => (t.realizedProfitLoss ?? 0) > 0);
  const losingTrades = sellTrades.filter(t => (t.realizedProfitLoss ?? 0) < 0);

  const avgWin = winningTrades.length > 0
    ? winningTrades.reduce((sum, t) => sum + (t.realizedProfitLoss ?? 0), 0) / winningTrades.length
    : 0;

  const avgLoss = losingTrades.length > 0
    ? Math.abs(losingTrades.reduce((sum, t) => sum + (t.realizedProfitLoss ?? 0), 0) / losingTrades.length)
    : 0;

  const winLossRatio = losingTrades.length > 0
    ? winningTrades.length / losingTrades.length
    : winningTrades.length > 0 ? Infinity : 0;

  // Total realized P/L
  const totalRealizedProfitLoss = sellTrades.reduce((sum, t) => sum + (t.realizedProfitLoss ?? 0), 0);

  // Average position size (as % of initial portfolio)
  const avgPositionSize = buyTrades.length > 0
    ? buyTrades.reduce((sum, t) => sum + t.totalAmount, 0) / buyTrades.length
    : 0;
  const avgPositionSizePercent = (avgPositionSize / CONFIG.initialCash) * 100;

  // Average holding duration (approximated by time difference between trades)
  let avgHoldingDuration = 0;
  if (trades.length > 1) {
    const sortedTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    let totalDuration = 0;
    let durationCount = 0;

    // For each symbol: time between buy and sell
    const symbols = [...new Set(trades.map(t => t.symbol))];
    for (const symbol of symbols) {
      const symbolTrades = sortedTrades.filter(t => t.symbol === symbol);
      for (let i = 1; i < symbolTrades.length; i++) {
        if (symbolTrades[i].type === 'sell' && symbolTrades[i - 1].type === 'buy') {
          totalDuration += symbolTrades[i].timestamp - symbolTrades[i - 1].timestamp;
          durationCount++;
        }
      }
    }
    avgHoldingDuration = durationCount > 0 ? totalDuration / durationCount / 1000 : 0;
  }

  // Calculate risk score (-100 to +100)
  // Factors:
  // 1. Position size: large positions = more risk-seeking
  // 2. Trading frequency: many trades = more risk-seeking
  // 3. Holding duration: short = more risk-seeking (day trading)
  // 4. Loss tolerance: holding during losses = more risk-seeking

  let riskScore = 0;

  // Position size (0-40 points for risk-seeking)
  // <10% = conservative (-20), 10-30% = neutral (0), >30% = risk-seeking (+20)
  if (avgPositionSizePercent < 10) {
    riskScore -= 20;
  } else if (avgPositionSizePercent > 30) {
    riskScore += Math.min(40, (avgPositionSizePercent - 30));
  }

  // Trading frequency (0-30 points)
  // more than 10 trades = active, more than 20 = very active
  const tradeFrequencyScore = Math.min(30, trades.length * 1.5);
  riskScore += tradeFrequencyScore;

  // Holding duration (short holding = more risk-seeking)
  // < 30 seconds = +20, < 2 minutes = +10, > 10 minutes = -10
  if (avgHoldingDuration > 0) {
    if (avgHoldingDuration < 30) {
      riskScore += 20;
    } else if (avgHoldingDuration < 120) {
      riskScore += 10;
    } else if (avgHoldingDuration > 600) {
      riskScore -= 10;
    }
  }

  // Loss tolerance: If many losses were realized, more risk-averse (stop-loss mentality)
  // But if large losses were held, more risk-seeking
  if (sellTrades.length > 0) {
    const avgLossPercent = losingTrades.length > 0
      ? losingTrades.reduce((sum, t) => {
          const lossPercent = t.avgBuyPrice ? (t.realizedProfitLoss ?? 0) / (t.avgBuyPrice * t.shares) * 100 : 0;
          return sum + Math.abs(lossPercent);
        }, 0) / losingTrades.length
      : 0;

    // Accepting large losses = risk-seeking
    if (avgLossPercent > 10) {
      riskScore += 15;
    } else if (avgLossPercent < 5 && losingTrades.length > 0) {
      riskScore -= 10; // Quick stop-losses = conservative
    }
  }

  // Limit score to -100 to +100
  riskScore = Math.max(-100, Math.min(100, riskScore));

  // Determine category
  let category: RiskProfileCategory;
  if (riskScore <= -34) {
    category = 'conservative';
  } else if (riskScore >= 34) {
    category = 'aggressive';
  } else {
    category = 'moderate';
  }

  return {
    riskScore: Math.round(riskScore),
    category,
    avgPositionSizePercent,
    avgHoldingDuration,
    totalTrades: trades.length,
    winLossRatio,
    avgWin,
    avgLoss,
    totalRealizedProfitLoss,
  };
};

export const { addCompletedTrade, updatePortfolioValueHistory, resetTradeHistory } = tradeHistorySlice.actions;
export default tradeHistorySlice.reducer;

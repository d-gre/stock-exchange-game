import type { Stock, VirtualPlayer, BuyDecisionFactors, SellDecisionFactors, PortfolioItem, Loan, CreditLineInfo, MarketPhase, TraderType, ShortPosition, StockFloat } from '../types';
import { CONFIG, LOAN_CONFIG, SHORT_SELLING_CONFIG } from '../config';
import { INITIAL_STOCKS } from './stockData';
import { calculateCollateralValue, calculateInterestRate } from '../store/loansSlice';
import {
  calculateShortProfitLoss,
  determineBorrowStatus,
  calculateBorrowFee,
  calculatePositionValue,
} from '../store/shortPositionsSlice';
import {
  getVPTradeChanceModifier,
  shouldVPPreferStableStocks,
} from './marketPhaseLogic';
import { assignTraderType, getDefaultParams } from './traderStrategies';

// ============================================================================
// VP LOAN DECISION HELPERS
// ============================================================================

/**
 * Generates a unique loan ID for VP loans
 */
const generateVPLoanId = (playerId: string): string =>
  `vp_loan_${playerId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

/**
 * Calculate credit line info for a virtual player.
 * Same logic as player loans - no cheating!
 *
 * Includes base collateral from starting capital (25% by default).
 * Base collateral improves creditworthiness but does NOT count toward net worth.
 */
export const calculateVPCreditLine = (
  player: VirtualPlayer,
  stocks: Stock[]
): CreditLineInfo => {
  // Calculate base collateral from VP's starting capital
  const vpInitialCash = player.initialCash ?? player.portfolio.cash;
  const baseCollateral = vpInitialCash * LOAN_CONFIG.baseCollateralPercent;

  const collateralBreakdown = calculateCollateralValue(
    player.portfolio.cash,
    player.portfolio.holdings,
    stocks,
    baseCollateral
  );

  const currentDebt = player.loans.reduce((sum, loan) => sum + loan.balance, 0);

  // Recommended credit line: stock collateral rounded down to nearest $1,000
  const recommendedCreditLine = Math.floor(collateralBreakdown.total / 1000) * 1000;

  // Maximum credit line: recommended × multiplier
  const maxCreditLine = recommendedCreditLine * LOAN_CONFIG.maxCreditLineMultiplier;

  const availableCredit = Math.max(0, maxCreditLine - currentDebt);
  const utilizationRatio = maxCreditLine > 0 ? currentDebt / maxCreditLine : 0;
  const utilizationVsRecommended = recommendedCreditLine > 0 ? currentDebt / recommendedCreditLine : 0;

  return {
    recommendedCreditLine,
    maxCreditLine,
    currentDebt,
    availableCredit,
    utilizationRatio,
    utilizationVsRecommended,
    activeLoansCount: player.loans.length,
    collateralBreakdown: {
      largeCapStocks: collateralBreakdown.largeCapStocks,
      smallCapStocks: collateralBreakdown.smallCapStocks,
      baseCollateral: collateralBreakdown.baseCollateral,
      total: collateralBreakdown.total,
    },
  };
};

/**
 * Calculate interest rate for a virtual player loan.
 * Uses the VP's risk tolerance as a proxy for risk profile.
 */
export const calculateVPInterestRate = (
  player: VirtualPlayer,
  creditLineInfo: CreditLineInfo
): number => {
  // VPs don't track realized P/L the same way - use 0 (neutral)
  const totalRealizedProfitLoss = 0;

  // Use transaction count as trade count
  const totalTrades = player.transactions.length;

  const breakdown = calculateInterestRate(
    player.settings.riskTolerance,
    totalRealizedProfitLoss,
    creditLineInfo.utilizationRatio,
    player.loans.length,
    totalTrades
  );

  return breakdown.effectiveRate;
};

/**
 * Determines if a VP should consider taking a loan.
 *
 * Decision factors:
 * - Risk tolerance: Risk-seeking VPs (>0) are more likely to use leverage
 * - Available credit: Must have credit available
 * - Current utilization: Don't over-leverage
 * - Loan slots: Max 3 loans like players
 */
export const shouldVPConsiderLoan = (
  player: VirtualPlayer,
  creditLineInfo: CreditLineInfo
): boolean => {
  // Check if VP loans are enabled
  if (!CONFIG.virtualPlayerLoansEnabled) return false;

  // Must have available credit
  if (creditLineInfo.availableCredit <= 0) return false;

  // Must have loan slots available (max 3)
  if (player.loans.length >= LOAN_CONFIG.maxLoans) return false;

  // Must have minimum collateral
  if (creditLineInfo.collateralBreakdown.total < LOAN_CONFIG.minCollateralForLoan) return false;

  // Risk-based decision:
  // - Risk-averse (-100 to -34): 5% chance to consider loan
  // - Neutral (-33 to +33): 15% chance
  // - Risk-seeking (+34 to +100): 35% chance
  const riskTolerance = player.settings.riskTolerance;
  let loanConsiderationChance: number;

  if (riskTolerance <= -34) {
    // Conservative: very unlikely to take loans
    loanConsiderationChance = 0.05;
  } else if (riskTolerance >= 34) {
    // Aggressive: more likely to use leverage
    loanConsiderationChance = 0.35;
  } else {
    // Neutral: moderate chance
    loanConsiderationChance = 0.15;
  }

  // Reduce chance based on current utilization
  // High utilization = less likely to take more debt
  const utilizationPenalty = creditLineInfo.utilizationRatio * 0.5;
  loanConsiderationChance *= (1 - utilizationPenalty);

  return Math.random() < loanConsiderationChance;
};

/**
 * Calculate how much a VP should borrow.
 *
 * Decision factors:
 * - Risk tolerance: Risk-seeking borrow more (40-80% of available)
 * - Current utilization: Already leveraged = borrow less
 * - Minimum useful amount: At least $1,000
 */
export const calculateVPLoanAmount = (
  player: VirtualPlayer,
  creditLineInfo: CreditLineInfo
): number => {
  const riskTolerance = player.settings.riskTolerance;
  const normalizedRisk = (riskTolerance + 100) / 200; // 0 to 1

  // Base borrow percentage: 20% (risk-averse) to 60% (risk-seeking) of available credit
  const basePercentage = 0.20 + normalizedRisk * 0.40;

  // Add some randomness (+/- 10%)
  const randomVariation = (Math.random() - 0.5) * 0.20;
  const borrowPercentage = Math.max(0.10, Math.min(0.80, basePercentage + randomVariation));

  // Calculate amount
  let amount = creditLineInfo.availableCredit * borrowPercentage;

  // Round to nearest $100
  amount = Math.floor(amount / 100) * 100;

  // Minimum $1,000 loan
  if (amount < 1000) return 0;

  // Don't exceed recommended credit line for conservative VPs
  if (riskTolerance < 0 && amount > creditLineInfo.recommendedCreditLine * 0.5) {
    amount = Math.floor(creditLineInfo.recommendedCreditLine * 0.5 / 100) * 100;
  }

  return amount;
};

/**
 * Determines if a VP should repay a loan.
 *
 * Decision factors:
 * - Cash available: Must have excess cash
 * - Risk tolerance: Risk-averse prefer to be debt-free
 * - Interest rate: Higher rate = more urgent to repay
 */
export const shouldVPRepayLoan = (
  player: VirtualPlayer,
  stocks: Stock[]
): { shouldRepay: boolean; loanId: string | null; amount: number } => {
  // No loans to repay
  if (player.loans.length === 0) {
    return { shouldRepay: false, loanId: null, amount: 0 };
  }

  const riskTolerance = player.settings.riskTolerance;
  const totalDebt = player.loans.reduce((sum, loan) => sum + loan.balance, 0);

  // Calculate portfolio value
  const stockValue = player.portfolio.holdings.reduce((sum, holding) => {
    const stock = stocks.find(s => s.symbol === holding.symbol);
    return sum + (stock ? stock.currentPrice * holding.shares : 0);
  }, 0);

  const totalAssets = player.portfolio.cash + stockValue;
  const debtToAssetRatio = totalDebt / totalAssets;

  // Risk-based repayment decision:
  // - Risk-averse: repay if >20% of cash is excess OR debt-to-asset ratio > 20%
  // - Neutral: repay if >40% of cash is excess OR debt-to-asset ratio > 35%
  // - Risk-seeking: repay if >60% of cash is excess OR debt-to-asset ratio > 50%

  let repayChance: number;
  let repayThreshold: number;

  if (riskTolerance <= -34) {
    // Conservative: eager to be debt-free
    repayChance = 0.30;
    repayThreshold = 0.20;
  } else if (riskTolerance >= 34) {
    // Aggressive: comfortable with debt
    repayChance = 0.08;
    repayThreshold = 0.50;
  } else {
    // Neutral
    repayChance = 0.15;
    repayThreshold = 0.35;
  }

  // Increase repay chance if debt-to-asset ratio is high
  if (debtToAssetRatio > repayThreshold) {
    repayChance += 0.20;
  }

  // Check if should repay
  if (Math.random() > repayChance) {
    return { shouldRepay: false, loanId: null, amount: 0 };
  }

  // Find the best loan to repay (highest interest rate)
  const sortedLoans = [...player.loans].sort((a, b) => b.interestRate - a.interestRate);
  const loanToRepay = sortedLoans[0];

  // Calculate repayment amount
  // Keep enough cash for potential trades (at least 30% of current cash)
  const maxRepayment = player.portfolio.cash * 0.70;

  // Calculate repayment with fee
  const repaymentFee = LOAN_CONFIG.repaymentFeePercent;
  const maxPrincipalRepayment = maxRepayment / (1 + repaymentFee);

  // Repay either full balance or what we can afford
  let repaymentAmount = Math.min(loanToRepay.balance, maxPrincipalRepayment);

  // Minimum repayment of $100
  if (repaymentAmount < 100) {
    return { shouldRepay: false, loanId: null, amount: 0 };
  }

  // Round to nearest $100
  repaymentAmount = Math.floor(repaymentAmount / 100) * 100;

  return {
    shouldRepay: true,
    loanId: loanToRepay.id,
    amount: repaymentAmount,
  };
};

/**
 * Creates a loan for a virtual player.
 * Returns the loan object to be added to the player's state.
 */
export const createVPLoan = (
  player: VirtualPlayer,
  amount: number,
  interestRate: number,
  durationCycles: number = LOAN_CONFIG.defaultLoanDurationCycles
): Loan => {
  // Calculate loan number based on existing loans + 1
  const loanNumber = player.loans.length + 1;
  return {
    id: generateVPLoanId(player.id),
    loanNumber,
    principal: amount,
    balance: amount,
    interestRate,
    createdAt: Date.now(),
    totalInterestPaid: 0,
    durationCycles,
    remainingCycles: durationCycles,
    isOverdue: false,
    overdueForCycles: 0,
  };
};

/** VP loan decision for the slice to process */
export interface VPLoanDecision {
  playerId: string;
  type: 'take' | 'repay';
  loan?: Loan;
  loanId?: string;
  amount?: number;
}

/**
 * Processes loan decisions for all virtual players.
 * Called during trade execution to allow VPs to take or repay loans.
 *
 * This is intentionally separate from trading so loan decisions can be
 * made independently and dispatched by the slice.
 */
export const processVPLoanDecisions = (
  players: VirtualPlayer[],
  stocks: Stock[]
): VPLoanDecision[] => {
  // Skip if VP loans are disabled
  if (!CONFIG.virtualPlayerLoansEnabled) return [];

  const loanDecisions: VPLoanDecision[] = [];

  for (const player of players) {
    // First, check if VP should repay a loan
    const repayDecision = shouldVPRepayLoan(player, stocks);
    if (repayDecision.shouldRepay && repayDecision.loanId) {
      loanDecisions.push({
        playerId: player.id,
        type: 'repay',
        loanId: repayDecision.loanId,
        amount: repayDecision.amount,
      });
      continue; // Don't take and repay in same cycle
    }

    // Then, check if VP should take a new loan
    const creditLine = calculateVPCreditLine(player, stocks);

    if (shouldVPConsiderLoan(player, creditLine)) {
      const loanAmount = calculateVPLoanAmount(player, creditLine);

      if (loanAmount > 0) {
        const interestRate = calculateVPInterestRate(player, creditLine);
        const loan = createVPLoan(player, loanAmount, interestRate);

        loanDecisions.push({
          playerId: player.id,
          type: 'take',
          loan,
        });
      }
    }
  }

  return loanDecisions;
};

// ============================================================================
// VP SHORT SELLING HELPERS
// ============================================================================

/**
 * Calculate the total short exposure for a VP.
 */
const calculateVPShortExposure = (
  player: VirtualPlayer,
  stocks: Stock[]
): number => {
  const positions = player.shortPositions ?? [];
  return positions.reduce((total, position) => {
    const stock = stocks.find(s => s.symbol === position.symbol);
    const currentPrice = stock?.currentPrice ?? position.entryPrice;
    return total + calculatePositionValue(position.shares, currentPrice);
  }, 0);
};

/**
 * Calculate the total locked collateral for a VP's shorts.
 */
const calculateVPLockedCollateral = (player: VirtualPlayer): number => {
  const positions = player.shortPositions ?? [];
  return positions.reduce((sum, p) => sum + p.collateralLocked, 0);
};

/**
 * Determines if a VP should consider short selling.
 *
 * Decision factors:
 * - Risk tolerance: Risk-seeking VPs are more likely to short
 * - Available margin: Must have credit available for margin
 * - Existing short exposure: Don't over-leverage
 */
export const shouldVPConsiderShort = (
  player: VirtualPlayer,
  creditLineInfo: CreditLineInfo,
  stocks: Stock[]
): boolean => {
  // Check if short selling is enabled globally
  if (!SHORT_SELLING_CONFIG.enabled) return false;

  // Must have available credit for margin
  const lockedCollateral = calculateVPLockedCollateral(player);
  const availableMargin = creditLineInfo.availableCredit - lockedCollateral;
  if (availableMargin < 500) return false; // Need at least $500 margin

  // Risk-based decision:
  // - Risk-averse (-100 to -34): 2% chance to consider short
  // - Neutral (-33 to +33): 8% chance
  // - Risk-seeking (+34 to +100): 20% chance
  const riskTolerance = player.settings.riskTolerance;
  let shortConsiderationChance: number;

  if (riskTolerance <= -34) {
    // Conservative: very unlikely to short
    shortConsiderationChance = 0.02;
  } else if (riskTolerance >= 34) {
    // Aggressive: more likely to short
    shortConsiderationChance = 0.20;
  } else {
    // Neutral: low chance
    shortConsiderationChance = 0.08;
  }

  // Reduce chance based on existing short exposure
  const shortExposure = calculateVPShortExposure(player, stocks);
  const portfolioValue = player.portfolio.cash +
    player.portfolio.holdings.reduce((sum, h) => {
      const stock = stocks.find(s => s.symbol === h.symbol);
      return sum + (stock ? stock.currentPrice * h.shares : 0);
    }, 0);

  // If short exposure > 30% of portfolio, reduce chance significantly
  if (portfolioValue > 0) {
    const exposureRatio = shortExposure / portfolioValue;
    if (exposureRatio > 0.3) {
      shortConsiderationChance *= 0.2;
    } else if (exposureRatio > 0.15) {
      shortConsiderationChance *= 0.5;
    }
  }

  return Math.random() < shortConsiderationChance;
};

/**
 * Determines if a VP should consider covering (closing) short positions.
 *
 * Decision factors:
 * - Current P/L on position
 * - Risk tolerance
 * - Position duration
 */
export const shouldVPConsiderCover = (
  player: VirtualPlayer,
  stocks: Stock[]
): { shouldCover: boolean; symbol: string | null; reason: 'profit' | 'loss' | 'margin' | null } => {
  const positions = player.shortPositions ?? [];
  if (positions.length === 0) {
    return { shouldCover: false, symbol: null, reason: null };
  }

  const riskTolerance = player.settings.riskTolerance;
  const normalizedRisk = riskTolerance / 100;

  for (const position of positions) {
    const stock = stocks.find(s => s.symbol === position.symbol);
    if (!stock) continue;

    const unrealizedPL = calculateShortProfitLoss(position.entryPrice, stock.currentPrice, position.shares);
    const plPercent = (unrealizedPL / (position.shares * position.entryPrice)) * 100;

    // Check margin call risk (price went up too much)
    const positionValue = calculatePositionValue(position.shares, stock.currentPrice);
    const requiredMargin = positionValue * SHORT_SELLING_CONFIG.maintenanceMarginPercent;
    const effectiveCollateral = position.collateralLocked + unrealizedPL;

    if (effectiveCollateral < requiredMargin * 1.1) {
      // Close to margin call - high chance to cover
      if (Math.random() < 0.5) {
        return { shouldCover: true, symbol: position.symbol, reason: 'margin' };
      }
    }

    // Profit taking: Risk-seeking take profits at lower thresholds
    // Risk-averse: 15%+ profit → 30% chance to cover
    // Risk-seeking: 8%+ profit → 25% chance to cover
    const profitThreshold = 15 - normalizedRisk * 7; // 8% to 15%
    if (plPercent > profitThreshold) {
      const coverChance = 0.25 + (1 - normalizedRisk) * 0.05; // 25-30%
      if (Math.random() < coverChance) {
        return { shouldCover: true, symbol: position.symbol, reason: 'profit' };
      }
    }

    // Stop loss: Risk-averse cut losses faster
    // Risk-averse: -10% loss → 40% chance to cover
    // Risk-seeking: -20% loss → 20% chance to cover
    const lossThreshold = -10 - normalizedRisk * 10; // -10% to -20%
    if (plPercent < lossThreshold) {
      const coverChance = 0.40 - normalizedRisk * 0.20; // 20-40%
      if (Math.random() < coverChance) {
        return { shouldCover: true, symbol: position.symbol, reason: 'loss' };
      }
    }
  }

  return { shouldCover: false, symbol: null, reason: null };
};

/**
 * Selects a stock to short based on VP's risk profile.
 * Risk-seeking VPs prefer volatile stocks with downward trend.
 */
export const selectStockToShort = (
  player: VirtualPlayer,
  stocks: Stock[],
  floats: Record<string, StockFloat>,
  allVPShortsBySymbol: Record<string, number>,
  creditLineInfo: CreditLineInfo
): { symbol: string; shares: number; collateral: number } | null => {
  const riskTolerance = player.settings.riskTolerance;
  const lockedCollateral = calculateVPLockedCollateral(player);
  const availableMargin = creditLineInfo.availableCredit - lockedCollateral;

  // Filter stocks that can be shorted
  const shortableStocks = stocks.filter(stock => {
    const floatInfo = floats[stock.symbol];
    if (!floatInfo) return false;

    const totalShorts = allVPShortsBySymbol[stock.symbol] ?? 0;
    const maxShortable = floatInfo.totalFloat * SHORT_SELLING_CONFIG.maxShortPercentOfFloat;
    const availableShares = maxShortable - totalShorts;

    // Must have shares available and we shouldn't already have a position
    const existingPosition = player.shortPositions?.find(p => p.symbol === stock.symbol);
    return availableShares > 0 && !existingPosition;
  });

  if (shortableStocks.length === 0) return null;

  // Score each stock for shorting potential
  const scoredStocks = shortableStocks.map(stock => {
    const volatility = calculateVolatility(stock.priceHistory);
    const trend = calculateTrend(stock.priceHistory);
    let score = 50;

    // Risk-seekers prefer volatile stocks for shorting
    const volatilityImpact = volatility * 100 * (1 + riskTolerance / 100);
    score += volatilityImpact;

    // Downward trend is good for shorting (negative trend = positive score)
    // Risk-averse only short in clear downtrends
    // Risk-seekers might short even in uptrends ("contrarian")
    const trendWeight = 100 - riskTolerance * 0.5; // 50 to 150
    score -= trend * trendWeight;

    // Random factor
    score += (Math.random() - 0.5) * 20;

    return { stock, score, volatility, trend };
  });

  // Weighted random selection from top scored stocks
  const selectedEntry = selectWeightedRandom(scoredStocks);

  // Calculate position size based on available margin
  const { initialMarginPercent } = SHORT_SELLING_CONFIG;
  const maxPositionValue = availableMargin / initialMarginPercent;
  const maxShares = Math.floor(maxPositionValue / selectedEntry.stock.currentPrice);

  if (maxShares <= 0) return null;

  // Position sizing: risk-averse short less
  const normalizedRisk = (riskTolerance + 100) / 200;
  const sizeMultiplier = 0.15 + normalizedRisk * 0.25; // 15-40% of max
  const targetShares = Math.max(1, Math.floor(maxShares * sizeMultiplier));

  // Check against float availability
  const floatInfo = floats[selectedEntry.stock.symbol];
  const totalShorts = allVPShortsBySymbol[selectedEntry.stock.symbol] ?? 0;
  const availableShares = (floatInfo?.totalFloat ?? 0) * SHORT_SELLING_CONFIG.maxShortPercentOfFloat - totalShorts;
  const shares = Math.min(targetShares, Math.floor(availableShares));

  if (shares <= 0) return null;

  // Calculate required collateral
  const positionValue = shares * selectedEntry.stock.currentPrice;
  const collateral = positionValue * initialMarginPercent;

  return {
    symbol: selectedEntry.stock.symbol,
    shares,
    collateral,
  };
};

/** VP short trade decision */
export interface VPShortTradeDecision {
  playerId: string;
  type: 'shortSell' | 'buyToCover';
  symbol: string;
  shares: number;
  price: number;
  collateral?: number;
}

/**
 * Processes short selling decisions for all virtual players.
 */
export const processVPShortDecisions = (
  players: VirtualPlayer[],
  stocks: Stock[],
  floats: Record<string, StockFloat>
): VPShortTradeDecision[] => {
  if (!SHORT_SELLING_CONFIG.enabled) return [];

  const decisions: VPShortTradeDecision[] = [];

  // Calculate total shorts by symbol across all VPs
  const allVPShortsBySymbol: Record<string, number> = {};
  for (const player of players) {
    for (const position of player.shortPositions ?? []) {
      allVPShortsBySymbol[position.symbol] = (allVPShortsBySymbol[position.symbol] ?? 0) + position.shares;
    }
  }

  for (const player of players) {
    // First check if VP should cover any existing positions
    const coverDecision = shouldVPConsiderCover(player, stocks);
    if (coverDecision.shouldCover && coverDecision.symbol) {
      const position = player.shortPositions?.find(p => p.symbol === coverDecision.symbol);
      const stock = stocks.find(s => s.symbol === coverDecision.symbol);
      if (position && stock) {
        // Cover entire position
        decisions.push({
          playerId: player.id,
          type: 'buyToCover',
          symbol: coverDecision.symbol,
          shares: position.shares,
          price: stock.currentPrice,
        });
        continue; // Don't open new shorts in the same cycle
      }
    }

    // Then check if VP should open a new short position
    const creditLine = calculateVPCreditLine(player, stocks);
    if (shouldVPConsiderShort(player, creditLine, stocks)) {
      const shortDecision = selectStockToShort(
        player,
        stocks,
        floats,
        allVPShortsBySymbol,
        creditLine
      );

      if (shortDecision) {
        const stock = stocks.find(s => s.symbol === shortDecision.symbol);
        if (stock) {
          decisions.push({
            playerId: player.id,
            type: 'shortSell',
            symbol: shortDecision.symbol,
            shares: shortDecision.shares,
            price: stock.currentPrice,
            collateral: shortDecision.collateral,
          });

          // Update tracking for this cycle
          allVPShortsBySymbol[shortDecision.symbol] =
            (allVPShortsBySymbol[shortDecision.symbol] ?? 0) + shortDecision.shares;
        }
      }
    }
  }

  return decisions;
};

/**
 * Applies a short sell to a VP's state.
 */
export const applyVPShortSell = (
  player: VirtualPlayer,
  symbol: string,
  shares: number,
  entryPrice: number,
  collateral: number
): VirtualPlayer => {
  const shortPositions = player.shortPositions ?? [];
  const existingPosition = shortPositions.find(p => p.symbol === symbol);

  let updatedPositions: ShortPosition[];
  if (existingPosition) {
    // Average into existing position
    const totalShares = existingPosition.shares + shares;
    const totalValue = (existingPosition.shares * existingPosition.entryPrice) + (shares * entryPrice);
    const newAvgPrice = totalValue / totalShares;

    updatedPositions = shortPositions.map(p =>
      p.symbol === symbol
        ? {
            ...p,
            shares: totalShares,
            entryPrice: newAvgPrice,
            collateralLocked: p.collateralLocked + collateral,
          }
        : p
    );
  } else {
    // Create new position
    const newPosition: ShortPosition = {
      symbol,
      shares,
      entryPrice,
      openedAt: Date.now(),
      collateralLocked: collateral,
      totalBorrowFeesPaid: 0,
    };
    updatedPositions = [...shortPositions, newPosition];
  }

  // Short sell generates cash (minus collateral which is locked)
  const proceeds = shares * entryPrice;

  const newTransaction = {
    id: `${player.id}-short-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    symbol,
    type: 'shortSell' as const,
    shares,
    price: entryPrice,
    timestamp: Date.now(),
  };

  return {
    ...player,
    portfolio: {
      ...player.portfolio,
      cash: player.portfolio.cash + proceeds - collateral,
    },
    shortPositions: updatedPositions,
    transactions: [newTransaction, ...player.transactions].slice(0, MAX_TRANSACTIONS_PER_PLAYER),
  };
};

/**
 * Applies a buy-to-cover to a VP's state.
 */
export const applyVPBuyToCover = (
  player: VirtualPlayer,
  symbol: string,
  shares: number,
  coverPrice: number
): VirtualPlayer => {
  const shortPositions = player.shortPositions ?? [];
  const position = shortPositions.find(p => p.symbol === symbol);
  if (!position) return player;

  const sharesToCover = Math.min(shares, position.shares);
  const closeRatio = sharesToCover / position.shares;
  const collateralToRelease = position.collateralLocked * closeRatio;

  // Cost to buy back shares
  const cost = sharesToCover * coverPrice;

  // Realized P/L = (entry - exit) * shares (included in cash calculation below)

  let updatedPositions: ShortPosition[];
  if (sharesToCover >= position.shares) {
    // Position fully closed
    updatedPositions = shortPositions.filter(p => p.symbol !== symbol);
  } else {
    // Partial close
    updatedPositions = shortPositions.map(p =>
      p.symbol === symbol
        ? {
            ...p,
            shares: p.shares - sharesToCover,
            collateralLocked: p.collateralLocked - collateralToRelease,
          }
        : p
    );
  }

  const newTransaction = {
    id: `${player.id}-cover-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    symbol,
    type: 'buyToCover' as const,
    shares: sharesToCover,
    price: coverPrice,
    timestamp: Date.now(),
  };

  return {
    ...player,
    portfolio: {
      ...player.portfolio,
      // Collateral is released, minus the cost of buying back
      // Cash change = collateralToRelease - cost + realizedPL
      // But realizedPL = (entry - exit) * shares, and we already paid entry when shorting
      // So: Cash = current + collateralToRelease - cost
      cash: player.portfolio.cash + collateralToRelease - cost,
    },
    shortPositions: updatedPositions,
    transactions: [newTransaction, ...player.transactions].slice(0, MAX_TRANSACTIONS_PER_PLAYER),
  };
};

/**
 * Charge borrow fees for all VP short positions.
 */
export const chargeVPBorrowFees = (
  players: VirtualPlayer[],
  stocks: Stock[],
  floats: Record<string, StockFloat>
): VirtualPlayer[] => {
  // Calculate total shorts by symbol across all VPs
  const allVPShortsBySymbol: Record<string, number> = {};
  for (const player of players) {
    for (const position of player.shortPositions ?? []) {
      allVPShortsBySymbol[position.symbol] = (allVPShortsBySymbol[position.symbol] ?? 0) + position.shares;
    }
  }

  return players.map(player => {
    const positions = player.shortPositions ?? [];
    if (positions.length === 0) return player;

    let totalFees = 0;

    const updatedPositions = positions.map(position => {
      const stock = stocks.find(s => s.symbol === position.symbol);
      if (!stock) return position;

      const positionValue = calculatePositionValue(position.shares, stock.currentPrice);
      const floatInfo = floats[position.symbol];
      const totalShorts = allVPShortsBySymbol[position.symbol] ?? position.shares;

      const borrowStatus = floatInfo
        ? determineBorrowStatus(totalShorts, floatInfo.totalFloat)
        : 'easy';

      const fee = calculateBorrowFee(positionValue, borrowStatus);
      totalFees += fee;

      return {
        ...position,
        totalBorrowFeesPaid: position.totalBorrowFeesPaid + fee,
      };
    });

    return {
      ...player,
      portfolio: {
        ...player.portfolio,
        cash: player.portfolio.cash - totalFees,
      },
      shortPositions: updatedPositions,
    };
  });
};

/**
 * 50 investment company names in random order.
 * The order is fixed so that when increasing the player count,
 * no duplicates occur (player N always gets name N).
 */
const PLAYER_NAMES = [
  'Apex Capital',
  'Vanguard Trust',
  'Pinnacle Invest',
  'Quantum Fund',
  'Summit Partners',
  'Atlas Holdings',
  'Meridian Capital',
  'Horizon Ventures',
  'Sterling Assets',
  'Nexus Equity',
  'Vertex Capital',
  'Titan Invest',
  'Crescent Fund',
  'Falcon Partners',
  'Ironwood Capital',
  'Cobalt Ventures',
  'Northstar Fund',
  'Sapphire Trust',
  'Eclipse Capital',
  'Granite Partners',
  'Redstone Invest',
  'Azure Holdings',
  'Blackwood Fund',
  'Citadel Equity',
  'Drake Capital',
  'Emerald Trust',
  'Foxglove Invest',
  'Griffin Partners',
  'Harborview Fund',
  'Ivory Capital',
  'Jasper Holdings',
  'Keystone Trust',
  'Lighthouse Fund',
  'Magellan Invest',
  'Noble Partners',
  'Obsidian Capital',
  'Pacific Ventures',
  'Quartz Holdings',
  'Riverside Trust',
  'Silverlake Fund',
  'Trident Capital',
  'Unity Partners',
  'Venture Prime',
  'Westbrook Invest',
  'Xenon Holdings',
  'Yellowstone Fund',
  'Zenith Capital',
  'Anchor Trust',
  'Beacon Partners',
  'Compass Invest',
];

const MAX_TRANSACTIONS_PER_PLAYER = 10;

/** Generate a random risk tolerance value between -100 and 100 */
const generateRiskTolerance = (): number => {
  return Math.floor(Math.random() * 201) - 100;
};

/** Generate random starting cash for virtual players (between half and double of player's initial cash) */
const generateStartingCash = (playerInitialCash: number = CONFIG.initialCash): number => {
  const min = Math.floor(playerInitialCash / 2);
  const max = playerInitialCash * 2;
  const range = max - min;
  return min + Math.floor(Math.random() * (range + 1));
};

/**
 * Generates random starting holdings for a virtual player.
 * The player invests 30-70% of their starting capital in 1-4 different stocks.
 * Returns the holdings and the remaining cash.
 */
const generateInitialHoldings = (
  startingCash: number,
  riskTolerance: number
): { holdings: PortfolioItem[]; remainingCash: number } => {
  const holdings: PortfolioItem[] = [];

  // Risk-seeking investors invest more (40-70%), risk-averse investors invest less (30-50%)
  const normalizedRisk = (riskTolerance + 100) / 200; // 0 to 1
  const minInvestPercent = 0.30 + normalizedRisk * 0.10; // 30-40%
  const maxInvestPercent = 0.50 + normalizedRisk * 0.20; // 50-70%
  const investPercent = minInvestPercent + Math.random() * (maxInvestPercent - minInvestPercent);

  let investmentBudget = startingCash * investPercent;

  // Random number of different stocks: 1-4
  const numStocks = 1 + Math.floor(Math.random() * 4);

  // Select random stocks (Fisher-Yates shuffle of the first n elements)
  const shuffledStocks = [...INITIAL_STOCKS];
  for (let i = shuffledStocks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledStocks[i], shuffledStocks[j]] = [shuffledStocks[j], shuffledStocks[i]];
  }
  const selectedStocks = shuffledStocks.slice(0, numStocks);

  // Distribute budget among the selected stocks
  for (const stock of selectedStocks) {
    if (investmentBudget <= 0) break;

    // Random portion of the remaining budget for this stock
    const allocationPercent = selectedStocks.indexOf(stock) === selectedStocks.length - 1
      ? 1 // Last stock gets the remainder
      : 0.3 + Math.random() * 0.5; // 30-80% of the remaining budget

    const allocationAmount = investmentBudget * allocationPercent;
    const maxShares = Math.floor(allocationAmount / stock.basePrice);

    if (maxShares > 0) {
      // Random quantity: 50-100% of the maximum possible shares
      const shares = Math.max(1, Math.floor(maxShares * (0.5 + Math.random() * 0.5)));
      const totalCost = shares * stock.basePrice;

      holdings.push({
        symbol: stock.symbol,
        shares,
        avgBuyPrice: stock.basePrice,
      });

      investmentBudget -= totalCost;
    }
  }

  // Calculate remaining cash
  const totalInvested = holdings.reduce((sum, h) => {
    const stockInfo = INITIAL_STOCKS.find(s => s.symbol === h.symbol);
    return sum + (stockInfo ? h.shares * stockInfo.basePrice : 0);
  }, 0);

  return {
    holdings,
    remainingCash: startingCash - totalInvested,
  };
};

export const initializeVirtualPlayers = (
  count: number = CONFIG.virtualPlayerCount,
  playerInitialCash: number = CONFIG.initialCash,
  isTimedGame: boolean = false
): VirtualPlayer[] => {
  const players: VirtualPlayer[] = [];

  for (let i = 0; i < count; i++) {
    // In timed game mode, all VPs get the same starting cash as the player
    // In unlimited mode, VPs get varied starting cash (half to double)
    const startingCash = isTimedGame ? playerInitialCash : generateStartingCash(playerInitialCash);
    const riskTolerance = generateRiskTolerance();
    const { holdings, remainingCash } = generateInitialHoldings(startingCash, riskTolerance);

    // Assign trader type based on configured distribution
    const traderType: TraderType = assignTraderType(i, count);
    const strategyParams = getDefaultParams(traderType);

    players.push({
      id: `bot-${i + 1}`,
      name: PLAYER_NAMES[i] || `Bot ${i + 1}`,
      portfolio: {
        cash: remainingCash,
        holdings,
      },
      transactions: [],
      settings: {
        riskTolerance,
        traderType,
        strategyParams,
      },
      loans: [],
      cyclesSinceInterest: 0,
      initialCash: startingCash, // Track initial cash for end-game comparison
      shortPositions: [],
    });
  }

  return players;
};

/**
 * Resets virtual players for timed game mode after warmup phase.
 * Keeps risk tolerance and trader type but resets cash, holdings, loans to match player start conditions.
 * This ensures fair competition in timed games.
 */
export const resetVirtualPlayersForTimedGame = (
  players: VirtualPlayer[],
  playerInitialCash: number
): VirtualPlayer[] => {
  return players.map(player => ({
    ...player,
    portfolio: {
      cash: playerInitialCash,
      holdings: [],
    },
    transactions: [],
    loans: [],
    cyclesSinceInterest: 0,
    initialCash: playerInitialCash,
    shortPositions: [],
    // Keep settings (riskTolerance, traderType, strategyParams)
  }));
};

interface TradeDecision {
  playerId: string;
  symbol: string;
  type: 'buy' | 'sell';
  shares: number;
  /** Factors that led to the decision */
  decisionFactors: BuyDecisionFactors | SellDecisionFactors;
}

/**
 * Selects an entry from scored items using weighted random selection.
 * Better scores have higher probability of being selected.
 * Takes top 3 items and weights selection by their scores.
 */
const selectWeightedRandom = <T extends { score: number }>(scoredItems: T[]): T => {
  // Sort by score (best first)
  const sorted = [...scoredItems].sort((a, b) => b.score - a.score);

  // Top 3 items to choose from (or fewer if not enough available)
  const topItems = sorted.slice(0, 3);
  const totalScore = topItems.reduce((sum, s) => sum + Math.max(0, s.score), 0);

  let selected = topItems[0];
  if (totalScore <= 0) {
    // All scores negative: random selection
    selected = topItems[Math.floor(Math.random() * topItems.length)];
  } else {
    // Weighted selection
    let random = Math.random() * totalScore;
    for (const entry of topItems) {
      random -= Math.max(0, entry.score);
      if (random <= 0) {
        selected = entry;
        break;
      }
    }
  }

  return selected;
};

/**
 * Creates a buy TradeDecision from a selected stock entry.
 */
const createBuyDecision = (
  playerId: string,
  selectedEntry: { stock: Stock; score: number; volatility: number; trend: number },
  shares: number,
  maxShares: number,
  riskTolerance: number
): TradeDecision => {
  const decisionFactors: BuyDecisionFactors = {
    kind: 'buy',
    volatility: selectedEntry.volatility,
    trend: selectedEntry.trend,
    score: selectedEntry.score,
    riskTolerance,
  };

  return {
    playerId,
    symbol: selectedEntry.stock.symbol,
    type: 'buy',
    shares: Math.min(shares, maxShares),
    decisionFactors,
  };
};

/**
 * Creates a new transaction object for a VP trade.
 */
const createVPTransaction = (
  playerId: string,
  symbol: string,
  type: 'buy' | 'sell',
  shares: number,
  price: number,
  decisionFactors: BuyDecisionFactors | SellDecisionFactors
): VirtualPlayer['transactions'][0] => ({
  id: `${playerId}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
  symbol,
  type,
  shares,
  price,
  timestamp: Date.now(),
  decisionFactors,
});

/**
 * Applies a buy trade to a player's portfolio.
 * Returns the updated player with new cash, holdings, and transaction.
 */
const applyBuyToPlayer = (
  player: VirtualPlayer,
  symbol: string,
  shares: number,
  price: number,
  transactions: VirtualPlayer['transactions']
): VirtualPlayer => {
  const totalValue = shares * price;
  const existingHolding = player.portfolio.holdings.find(h => h.symbol === symbol);

  if (existingHolding) {
    const newTotalShares = existingHolding.shares + shares;
    const newAvgPrice = (existingHolding.shares * existingHolding.avgBuyPrice + totalValue) / newTotalShares;

    return {
      ...player,
      portfolio: {
        cash: player.portfolio.cash - totalValue,
        holdings: player.portfolio.holdings.map(h =>
          h.symbol === symbol ? { ...h, shares: newTotalShares, avgBuyPrice: newAvgPrice } : h
        ),
      },
      transactions,
    };
  } else {
    return {
      ...player,
      portfolio: {
        cash: player.portfolio.cash - totalValue,
        holdings: [...player.portfolio.holdings, { symbol, shares, avgBuyPrice: price }],
      },
      transactions,
    };
  }
};

/**
 * Applies a sell trade to a player's portfolio.
 * Returns the updated player with new cash, holdings, and transaction.
 */
const applySellToPlayer = (
  player: VirtualPlayer,
  symbol: string,
  shares: number,
  price: number,
  transactions: VirtualPlayer['transactions']
): VirtualPlayer => {
  const totalValue = shares * price;
  const holding = player.portfolio.holdings.find(h => h.symbol === symbol);
  if (!holding) return player;

  const newShares = holding.shares - shares;

  if (newShares === 0) {
    return {
      ...player,
      portfolio: {
        cash: player.portfolio.cash + totalValue,
        holdings: player.portfolio.holdings.filter(h => h.symbol !== symbol),
      },
      transactions,
    };
  } else {
    return {
      ...player,
      portfolio: {
        cash: player.portfolio.cash + totalValue,
        holdings: player.portfolio.holdings.map(h =>
          h.symbol === symbol ? { ...h, shares: newShares } : h
        ),
      },
      transactions,
    };
  }
};

/**
 * Calculates the volatility of a stock based on its price history.
 * Volatility = standard deviation of percentage price changes.
 * Higher values = more fluctuation = riskier.
 */
export const calculateVolatility = (priceHistory: Stock['priceHistory']): number => {
  if (priceHistory.length < 2) return 0;

  // Calculate percentage changes between consecutive candles
  const changes: number[] = [];
  for (let i = 1; i < priceHistory.length; i++) {
    const prevClose = priceHistory[i - 1].close;
    const currClose = priceHistory[i].close;
    if (prevClose > 0) {
      changes.push((currClose - prevClose) / prevClose);
    }
  }

  if (changes.length === 0) return 0;

  // Calculate standard deviation
  const mean = changes.reduce((sum, c) => sum + c, 0) / changes.length;
  const squaredDiffs = changes.map(c => Math.pow(c - mean, 2));
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / changes.length;

  return Math.sqrt(variance);
};

/**
 * Calculates the trend of a stock (momentum).
 * Positive = uptrend, Negative = downtrend.
 * Based on the price change of the last candles.
 */
export const calculateTrend = (priceHistory: Stock['priceHistory']): number => {
  if (priceHistory.length < 2) return 0;

  // Short-term trend: last 5 candles (or fewer)
  const recentHistory = priceHistory.slice(-5);
  const firstPrice = recentHistory[0].close;
  const lastPrice = recentHistory[recentHistory.length - 1].close;

  if (firstPrice === 0) return 0;

  // Percentage change over the period
  return (lastPrice - firstPrice) / firstPrice;
};

/**
 * Evaluates a stock from a player's perspective based on their risk tolerance.
 *
 * Risk-seeking players (+100):
 * - Prefer volatile stocks (more profit potential)
 * - Like to buy during downtrends ("Buy the dip")
 *
 * Risk-averse players (-100):
 * - Prefer stable stocks (less fluctuation)
 * - Only buy during uptrends (safety)
 */
export const scoreStockForPlayer = (
  stock: Stock,
  riskTolerance: number
): number => {
  const volatility = calculateVolatility(stock.priceHistory);
  const trend = calculateTrend(stock.priceHistory);

  // Normalize risk tolerance: -100 to +100 -> -1 to +1
  const normalizedRisk = riskTolerance / 100;

  // Base score
  let score = 50;

  // Volatility influence:
  // Risk-seeking (+1): high volatility is good (+20 at 10% volatility)
  // Risk-averse (-1): high volatility is bad (-20 at 10% volatility)
  const volatilityImpact = volatility * 200 * normalizedRisk;
  score += volatilityImpact;

  // Trend influence:
  // Risk-seeking: also buys falling stocks (trend less important)
  // Risk-averse: strongly prefers rising stocks
  // At normalizedRisk = -1: Trend * 100 (5% increase = +5 points)
  // At normalizedRisk = +1: Trend * 20 (trend less important)
  const trendWeight = 60 - (normalizedRisk * 40); // -1 → 100, 0 → 60, +1 → 20
  score += trend * trendWeight;

  // Random factor for some variation (+/-10 points)
  score += (Math.random() - 0.5) * 20;

  return score;
};

/**
 * Evaluates whether a holding should be sold.
 *
 * Risk-seeking players:
 * - Hold even at losses (hope for recovery)
 * - Tend to sell at profits (take profits)
 *
 * Risk-averse players:
 * - Sell quickly at losses (stop-loss mentality)
 * - Hold winners longer
 */
export const scoreHoldingForSale = (
  stock: Stock,
  avgBuyPrice: number,
  riskTolerance: number
): number => {
  const currentPrice = stock.currentPrice;
  const profitPercent = (currentPrice - avgBuyPrice) / avgBuyPrice;
  const trend = calculateTrend(stock.priceHistory);

  // Normalize risk tolerance
  const normalizedRisk = riskTolerance / 100;

  // Base score (50 = neutral)
  let score = 50;

  // Profit/loss influence:
  // Risk-averse (-1): losses strongly increase sell probability
  // Risk-seeking (+1): losses less dramatic
  if (profitPercent < 0) {
    // At loss:
    // Risk-averse: score increases (wants to sell)
    // Risk-seeking: score stays low (holds)
    const lossImpact = Math.abs(profitPercent) * 100 * (1 - normalizedRisk);
    score += lossImpact;
  } else {
    // At profit:
    // Risk-seeking: score increases slightly (take profits)
    // Risk-averse: score decreases (hold winners)
    const profitImpact = profitPercent * 50 * normalizedRisk;
    score += profitImpact;
  }

  // Trend influence on sell decision:
  // Falling trend increases sell probability (for all)
  if (trend < 0) {
    score += Math.abs(trend) * 30;
  }

  // Random factor
  score += (Math.random() - 0.5) * 20;

  return score;
};

/**
 * Determines the position size based on risk tolerance.
 *
 * Risk tolerance strongly influences how much is bought:
 * - Risk-averse players (-100): buy 15-25% of the maximum possible amount
 * - Neutral players (0): buy 35-50% of the maximum possible amount
 * - Risk-seeking players (+100): buy 55-80% of the maximum possible amount
 *
 * Example with maxAffordable = 100 shares:
 * - Risk-averse (-100): 15-25 shares
 * - Neutral (0): 35-50 shares
 * - Risk-seeking (+100): 55-80 shares
 */
export const calculatePositionSize = (
  maxAffordable: number,
  riskTolerance: number
): number => {
  // Normalize risk tolerance: -100 to +100 -> 0 to 1
  const normalizedRisk = (riskTolerance + 100) / 200;

  // Base percentage: 15% (risk-averse) to 55% (risk-seeking)
  const basePercentage = 0.15 + normalizedRisk * 0.40;

  // Random variation: +0% to +25% additional
  // This gives risk-seeking players room for even larger purchases
  const variation = 1 + Math.random() * 0.25 * (1 + normalizedRisk);

  // Calculate target share count
  const targetShares = Math.floor(maxAffordable * basePercentage * variation);

  // Buy at least 1 share
  return Math.max(1, targetShares);
};

/**
 * Makes a trading decision for a virtual player.
 *
 * The decision is based on:
 * 1. Player's risk tolerance
 * 2. Volatility and trend of stocks
 * 3. Current profits/losses on held positions
 * 4. Current market phase (affects trade probability)
 */
const makeTradeDecision = (
  player: VirtualPlayer,
  stocks: Stock[],
  globalPhase: MarketPhase = 'prosperity'
): TradeDecision | null => {
  const { riskTolerance } = player.settings;
  const normalizedRisk = riskTolerance / 100;

  // === STEP 1: Decide whether to trade at all ===
  // Risk-seeking trade more often (75%), risk-averse trade less often (35%)
  // Apply market phase modifier
  const baseTradeChance = 0.55 + normalizedRisk * 0.20; // 35% to 75%
  const phaseModifier = getVPTradeChanceModifier(riskTolerance, globalPhase);
  const tradeChance = Math.max(0.05, Math.min(0.95, baseTradeChance + phaseModifier));

  if (Math.random() > tradeChance) {
    return null; // No trade this round
  }

  // === STEP 2: Buy or sell? ===
  // Base: 55% buy, 45% sell (when both are possible)
  const hasHoldings = player.portfolio.holdings.length > 0;
  const canAffordAnything = stocks.some(s => s.currentPrice <= player.portfolio.cash);

  if (!hasHoldings && !canAffordAnything) {
    return null; // Can neither buy nor sell
  }

  let shouldBuy: boolean;
  if (!hasHoldings) {
    shouldBuy = true; // Must buy, has nothing to sell
  } else if (!canAffordAnything) {
    shouldBuy = false; // Must sell, cannot afford anything
  } else {
    // Both possible: risk tolerance influences the tendency
    // Risk-seeking: buy more often (75%)
    // Risk-averse: sell more often (40% buy)
    const buyChance = 0.575 + normalizedRisk * 0.175; // 40% to 75%
    shouldBuy = Math.random() < buyChance;
  }

  // === STEP 3: Make concrete decision ===
  if (shouldBuy) {
    return makeBuyDecision(player, stocks, globalPhase);
  } else {
    return makeSellDecision(player, stocks);
  }
};

/**
 * Selects a stock to buy and determines the quantity.
 * Conservative players in downturns prefer stable (low volatility) stocks.
 */
const makeBuyDecision = (
  player: VirtualPlayer,
  stocks: Stock[],
  globalPhase: MarketPhase = 'prosperity'
): TradeDecision | null => {
  const { riskTolerance } = player.settings;
  const preferStable = shouldVPPreferStableStocks(riskTolerance, globalPhase);

  // Only consider affordable stocks
  const affordableStocks = stocks.filter(s => s.currentPrice <= player.portfolio.cash);
  if (affordableStocks.length === 0) return null;

  // Evaluate each stock and store factors
  const scoredStocks = affordableStocks.map(stock => {
    const volatility = calculateVolatility(stock.priceHistory);
    const trend = calculateTrend(stock.priceHistory);
    let score = scoreStockForPlayer(stock, riskTolerance);

    // Conservative players in downturns prefer low-volatility stocks
    if (preferStable) {
      // Penalize high volatility stocks (volatility > 0.03 = high)
      const volatilityPenalty = volatility > 0.03 ? 30 : volatility > 0.02 ? 15 : 0;
      score -= volatilityPenalty;
    }

    return {
      stock,
      score,
      volatility,
      trend,
    };
  });

  // Weighted random selection from top scored stocks
  const selectedEntry = selectWeightedRandom(scoredStocks);

  // Calculate position size
  const maxShares = Math.floor(player.portfolio.cash / selectedEntry.stock.currentPrice);
  const shares = calculatePositionSize(maxShares, riskTolerance);

  return createBuyDecision(player.id, selectedEntry, shares, maxShares, riskTolerance);
};

/**
 * Selects a holding to sell and determines the quantity.
 */
const makeSellDecision = (player: VirtualPlayer, stocks: Stock[]): TradeDecision | null => {
  const { riskTolerance } = player.settings;

  if (player.portfolio.holdings.length === 0) return null;

  // Evaluate each holding and store factors
  const scoredHoldings = player.portfolio.holdings.map(holding => {
    const stock = stocks.find(s => s.symbol === holding.symbol);
    if (!stock) return { holding, score: 0, stock: null, trend: 0, profitPercent: 0 };

    const trend = calculateTrend(stock.priceHistory);
    const profitPercent = (stock.currentPrice - holding.avgBuyPrice) / holding.avgBuyPrice;
    const score = scoreHoldingForSale(stock, holding.avgBuyPrice, riskTolerance);

    return {
      holding,
      stock,
      score,
      trend,
      profitPercent,
    };
  }).filter(h => h.stock !== null);

  if (scoredHoldings.length === 0) return null;

  // Sort by sell score (highest score = most likely to sell)
  scoredHoldings.sort((a, b) => b.score - a.score);

  // Only sell if score is above threshold (40 = rather not sell)
  const topCandidate = scoredHoldings[0];
  if (topCandidate.score < 40) {
    // Nothing worth selling
    return null;
  }

  // Weighted selection from top candidates
  const sellCandidates = scoredHoldings.filter(h => h.score >= 40).slice(0, 3);
  const totalScore = sellCandidates.reduce((sum, h) => sum + h.score, 0);

  let random = Math.random() * totalScore;
  let selectedEntry = sellCandidates[0];
  for (const candidate of sellCandidates) {
    random -= candidate.score;
    if (random <= 0) {
      selectedEntry = candidate;
      break;
    }
  }

  // Sell quantity: risk-averse tend to sell all, risk-seeking sell partially
  const normalizedRisk = riskTolerance / 100;
  const sellPercentage = 0.7 - normalizedRisk * 0.3; // 40% to 100%
  const sharesToSell = Math.max(1, Math.ceil(selectedEntry.holding.shares * sellPercentage));

  // Decision factors for the transaction
  const decisionFactors: SellDecisionFactors = {
    kind: 'sell',
    profitPercent: selectedEntry.profitPercent,
    trend: selectedEntry.trend,
    score: selectedEntry.score,
    riskTolerance,
    avgBuyPrice: selectedEntry.holding.avgBuyPrice,
  };

  return {
    playerId: player.id,
    symbol: selectedEntry.holding.symbol,
    type: 'sell',
    shares: Math.min(sharesToSell, selectedEntry.holding.shares),
    decisionFactors,
  };
};

const applyMarketImpact = (stocks: Stock[], symbol: string, shares: number, isBuy: boolean): Stock[] => {
  const impactFactor = isBuy ? 1 : -1;
  return stocks.map(s => {
    if (s.symbol !== symbol) return s;

    // Reduced impact: 0.01% - 0.05% per share (was 0.1% - 0.5%)
    const baseImpact = 0.0001 + Math.random() * 0.0004;
    // Reduced volume multiplier cap (was 50)
    const volumeMultiplier = Math.min(shares, 20);
    const rawPriceChange = s.currentPrice * baseImpact * volumeMultiplier * impactFactor;

    // Circuit breaker: max ±2% price change per trade
    const maxChange = s.currentPrice * 0.02;
    const priceChange = Math.max(-maxChange, Math.min(maxChange, rawPriceChange));

    const newPrice = Math.max(0.5, s.currentPrice + priceChange);

    const lastCandle = s.priceHistory[s.priceHistory.length - 1];
    const updatedCandle = {
      ...lastCandle,
      close: parseFloat(newPrice.toFixed(2)),
      high: parseFloat(Math.max(lastCandle.high, newPrice).toFixed(2)),
      low: parseFloat(Math.min(lastCandle.low, newPrice).toFixed(2)),
    };

    return {
      ...s,
      currentPrice: parseFloat(newPrice.toFixed(2)),
      priceHistory: [...s.priceHistory.slice(0, -1), updatedCandle],
    };
  });
};

/**
 * Warmup configuration for trade tracking and prioritization
 */
export interface WarmupConfig {
  /** Current trade count per symbol */
  tradeCounts: Record<string, number>;
  /** From this cycle onwards, untraded stocks are prioritized */
  prioritizeAfterCycle: number;
  /** Current warmup cycle */
  currentCycle: number;
  /** Minimum trades per stock to be considered "traded" */
  minTradesRequired: number;
}

/** Trade information for Market Maker integration */
export interface ExecutedTrade {
  symbol: string;
  type: 'buy' | 'sell';
  shares: number;
}

/**
 * Calculates a bonus score for stocks that were traded little during warmup.
 * The fewer trades a stock has, the higher the bonus.
 */
const getUntradedBonus = (
  symbol: string,
  warmupConfig: WarmupConfig | undefined
): number => {
  if (!warmupConfig) return 0;
  if (warmupConfig.currentCycle < warmupConfig.prioritizeAfterCycle) return 0;

  const tradeCount = warmupConfig.tradeCounts[symbol] ?? 0;
  if (tradeCount >= warmupConfig.minTradesRequired) return 0;

  // The fewer trades, the higher the bonus (max 50 points)
  const missingTrades = warmupConfig.minTradesRequired - tradeCount;
  return Math.min(50, missingTrades * 25);
};

/**
 * Selects a stock to buy with optional warmup prioritization.
 */
const makeBuyDecisionWithWarmup = (
  player: VirtualPlayer,
  stocks: Stock[],
  warmupConfig?: WarmupConfig
): TradeDecision | null => {
  const { riskTolerance } = player.settings;

  // Only consider affordable stocks
  const affordableStocks = stocks.filter(s => s.currentPrice <= player.portfolio.cash);
  if (affordableStocks.length === 0) return null;

  // Evaluate each stock and store factors (with warmup bonus)
  const scoredStocks = affordableStocks.map(stock => {
    const volatility = calculateVolatility(stock.priceHistory);
    const trend = calculateTrend(stock.priceHistory);
    const baseScore = scoreStockForPlayer(stock, riskTolerance);
    const untradedBonus = getUntradedBonus(stock.symbol, warmupConfig);
    return {
      stock,
      score: baseScore + untradedBonus,
      volatility,
      trend,
    };
  });

  // Weighted random selection from top scored stocks
  const selectedEntry = selectWeightedRandom(scoredStocks);

  // Calculate position size
  const maxShares = Math.floor(player.portfolio.cash / selectedEntry.stock.currentPrice);
  const shares = calculatePositionSize(maxShares, riskTolerance);

  return createBuyDecision(player.id, selectedEntry, shares, maxShares, riskTolerance);
};

/**
 * Makes a trading decision with optional warmup prioritization.
 */
const makeTradeDecisionWithWarmup = (
  player: VirtualPlayer,
  stocks: Stock[],
  warmupConfig?: WarmupConfig
): TradeDecision | null => {
  const { riskTolerance } = player.settings;
  const normalizedRisk = riskTolerance / 100;

  // Decide whether to trade at all
  const tradeChance = 0.55 + normalizedRisk * 0.20;
  if (Math.random() > tradeChance) {
    return null;
  }

  const hasHoldings = player.portfolio.holdings.length > 0;
  const canAffordAnything = stocks.some(s => s.currentPrice <= player.portfolio.cash);

  if (!hasHoldings && !canAffordAnything) {
    return null;
  }

  let shouldBuy: boolean;
  if (!hasHoldings) {
    shouldBuy = true;
  } else if (!canAffordAnything) {
    shouldBuy = false;
  } else {
    // During warmup: slightly higher buy tendency to trade more stocks
    const buyBoost = warmupConfig ? 0.05 : 0;
    const buyChance = 0.575 + normalizedRisk * 0.175 + buyBoost;
    shouldBuy = Math.random() < buyChance;
  }

  if (shouldBuy) {
    return makeBuyDecisionWithWarmup(player, stocks, warmupConfig);
  } else {
    return makeSellDecision(player, stocks);
  }
};

/**
 * Forces a trade for an untraded stock.
 * Called at the end of warmup for stocks with 0 trades.
 */
const forceTrade = (
  symbol: string,
  players: VirtualPlayer[],
  stocks: Stock[]
): { updatedPlayers: VirtualPlayer[]; updatedStocks: Stock[]; traded: boolean; executedTrade: ExecutedTrade | null } => {
  const stock = stocks.find(s => s.symbol === symbol);
  if (!stock) return { updatedPlayers: players, updatedStocks: stocks, traded: false, executedTrade: null };

  // Find players who can buy this stock
  const eligibleBuyers = players.filter(p => p.portfolio.cash >= stock.currentPrice);

  // Find players who own this stock and can sell
  const eligibleSellers = players.filter(p =>
    p.portfolio.holdings.some(h => h.symbol === symbol && h.shares > 0)
  );

  // Prefer buying, then selling
  if (eligibleBuyers.length > 0) {
    const buyer = eligibleBuyers[Math.floor(Math.random() * eligibleBuyers.length)];
    const maxShares = Math.floor(buyer.portfolio.cash / stock.currentPrice);
    const shares = Math.max(1, Math.floor(maxShares * 0.1)); // 10% of possible

    const totalCost = shares * stock.currentPrice;
    const updatedStocks = applyMarketImpact(stocks, symbol, shares, true);

    const updatedPlayers = players.map(p => {
      if (p.id !== buyer.id) return p;

      const existingHolding = p.portfolio.holdings.find(h => h.symbol === symbol);
      if (existingHolding) {
        const newTotalShares = existingHolding.shares + shares;
        const newAvgPrice = (existingHolding.shares * existingHolding.avgBuyPrice + totalCost) / newTotalShares;
        return {
          ...p,
          portfolio: {
            cash: p.portfolio.cash - totalCost,
            holdings: p.portfolio.holdings.map(h =>
              h.symbol === symbol ? { ...h, shares: newTotalShares, avgBuyPrice: newAvgPrice } : h
            ),
          },
        };
      } else {
        return {
          ...p,
          portfolio: {
            cash: p.portfolio.cash - totalCost,
            holdings: [...p.portfolio.holdings, { symbol, shares, avgBuyPrice: stock.currentPrice }],
          },
        };
      }
    });

    return { updatedPlayers, updatedStocks, traded: true, executedTrade: { symbol, type: 'buy', shares } };
  }

  if (eligibleSellers.length > 0) {
    const seller = eligibleSellers[Math.floor(Math.random() * eligibleSellers.length)];
    const holding = seller.portfolio.holdings.find(h => h.symbol === symbol)!;
    const shares = Math.max(1, Math.floor(holding.shares * 0.1)); // sell 10%

    const totalValue = shares * stock.currentPrice;
    const updatedStocks = applyMarketImpact(stocks, symbol, shares, false);

    const updatedPlayers = players.map(p => {
      if (p.id !== seller.id) return p;

      const newShares = holding.shares - shares;
      if (newShares === 0) {
        return {
          ...p,
          portfolio: {
            cash: p.portfolio.cash + totalValue,
            holdings: p.portfolio.holdings.filter(h => h.symbol !== symbol),
          },
        };
      } else {
        return {
          ...p,
          portfolio: {
            cash: p.portfolio.cash + totalValue,
            holdings: p.portfolio.holdings.map(h =>
              h.symbol === symbol ? { ...h, shares: newShares } : h
            ),
          },
        };
      }
    });

    return { updatedPlayers, updatedStocks, traded: true, executedTrade: { symbol, type: 'sell', shares } };
  }

  return { updatedPlayers: players, updatedStocks: stocks, traded: false, executedTrade: null };
};

/**
 * Executes warmup trades with trade tracking and prioritization.
 * Returns the updated trade counts.
 */
export const executeWarmupTrades = (
  players: VirtualPlayer[],
  stocks: Stock[],
  warmupConfig: WarmupConfig
): {
  updatedPlayers: VirtualPlayer[];
  updatedStocks: Stock[];
  tradesExecuted: number;
  updatedTradeCounts: Record<string, number>;
  executedTrades: ExecutedTrade[];
} => {
  let currentStocks = [...stocks];
  let tradesExecuted = 0;
  const tradeCounts = { ...warmupConfig.tradeCounts };
  const executedTrades: ExecutedTrade[] = [];

  const updatedPlayers = players.map(player => {
    const decision = makeTradeDecisionWithWarmup(player, currentStocks, warmupConfig);
    if (!decision) return player;

    const stock = currentStocks.find(s => s.symbol === decision.symbol);
    if (!stock) return player;

    const totalValue = decision.shares * stock.currentPrice;
    const newTransaction = createVPTransaction(
      player.id, decision.symbol, decision.type, decision.shares, stock.currentPrice, decision.decisionFactors
    );
    const updatedTransactions = [newTransaction, ...player.transactions].slice(0, MAX_TRANSACTIONS_PER_PLAYER);

    if (decision.type === 'buy') {
      if (totalValue > player.portfolio.cash) return player;

      tradesExecuted++;
      tradeCounts[decision.symbol] = (tradeCounts[decision.symbol] ?? 0) + 1;
      executedTrades.push({ symbol: decision.symbol, type: 'buy', shares: decision.shares });
      currentStocks = applyMarketImpact(currentStocks, decision.symbol, decision.shares, true);

      return applyBuyToPlayer(player, decision.symbol, decision.shares, stock.currentPrice, updatedTransactions);
    } else {
      const holding = player.portfolio.holdings.find(h => h.symbol === decision.symbol);
      if (!holding || holding.shares < decision.shares) return player;

      tradesExecuted++;
      tradeCounts[decision.symbol] = (tradeCounts[decision.symbol] ?? 0) + 1;
      executedTrades.push({ symbol: decision.symbol, type: 'sell', shares: decision.shares });
      currentStocks = applyMarketImpact(currentStocks, decision.symbol, decision.shares, false);

      return applySellToPlayer(player, decision.symbol, decision.shares, stock.currentPrice, updatedTransactions);
    }
  });

  return {
    updatedPlayers,
    updatedStocks: currentStocks,
    tradesExecuted,
    updatedTradeCounts: tradeCounts,
    executedTrades,
  };
};

/**
 * Forces trades for all stocks that were never traded during warmup.
 */
export const forceTradesForUntradedStocks = (
  players: VirtualPlayer[],
  stocks: Stock[],
  tradeCounts: Record<string, number>
): { updatedPlayers: VirtualPlayer[]; updatedStocks: Stock[]; forcedSymbols: string[]; executedTrades: ExecutedTrade[] } => {
  let currentPlayers = [...players];
  let currentStocks = [...stocks];
  const forcedSymbols: string[] = [];
  const executedTrades: ExecutedTrade[] = [];

  for (const stock of stocks) {
    const tradeCount = tradeCounts[stock.symbol] ?? 0;
    if (tradeCount === 0) {
      const result = forceTrade(stock.symbol, currentPlayers, currentStocks);
      if (result.traded) {
        currentPlayers = result.updatedPlayers;
        currentStocks = result.updatedStocks;
        forcedSymbols.push(stock.symbol);
        if (result.executedTrade) {
          executedTrades.push(result.executedTrade);
        }
      }
    }
  }

  return { updatedPlayers: currentPlayers, updatedStocks: currentStocks, forcedSymbols, executedTrades };
};

export const executeVirtualPlayerTrades = (
  players: VirtualPlayer[],
  stocks: Stock[],
  globalPhase: MarketPhase = 'prosperity'
): {
  updatedPlayers: VirtualPlayer[];
  updatedStocks: Stock[];
  tradesExecuted: number;
  executedTrades: ExecutedTrade[];
} => {
  let currentStocks = [...stocks];
  let tradesExecuted = 0;
  const executedTrades: ExecutedTrade[] = [];

  const updatedPlayers = players.map(player => {
    const decision = makeTradeDecision(player, currentStocks, globalPhase);
    if (!decision) return player;

    const stock = currentStocks.find(s => s.symbol === decision.symbol);
    if (!stock) return player;

    const totalValue = decision.shares * stock.currentPrice;
    const newTransaction = createVPTransaction(
      player.id, decision.symbol, decision.type, decision.shares, stock.currentPrice, decision.decisionFactors
    );
    const updatedTransactions = [newTransaction, ...player.transactions].slice(0, MAX_TRANSACTIONS_PER_PLAYER);

    if (decision.type === 'buy') {
      if (totalValue > player.portfolio.cash) return player;

      tradesExecuted++;
      executedTrades.push({ symbol: decision.symbol, type: 'buy', shares: decision.shares });
      currentStocks = applyMarketImpact(currentStocks, decision.symbol, decision.shares, true);

      return applyBuyToPlayer(player, decision.symbol, decision.shares, stock.currentPrice, updatedTransactions);
    } else {
      // Sell
      const holding = player.portfolio.holdings.find(h => h.symbol === decision.symbol);
      if (!holding || holding.shares < decision.shares) return player;

      tradesExecuted++;
      executedTrades.push({ symbol: decision.symbol, type: 'sell', shares: decision.shares });
      currentStocks = applyMarketImpact(currentStocks, decision.symbol, decision.shares, false);

      return applySellToPlayer(player, decision.symbol, decision.shares, stock.currentPrice, updatedTransactions);
    }
  });

  return { updatedPlayers, updatedStocks: currentStocks, tradesExecuted, executedTrades };
};

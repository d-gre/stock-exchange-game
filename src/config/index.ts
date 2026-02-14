import type {GameMode, GameModeConfig, LoanConfig, MarketMakerConfig, MarketPhaseSystemConfig, OrderTypeConfig, ShortSellingConfig, TraderType, TradingMechanics} from '../types';

export const CONFIG = {
  // Number of stocks per sector (max 4, randomly selected at game start)
  stocksPerSector: 4,

  // Number of virtual players
  virtualPlayerCount: 49,

  // Maximum number of virtual players
  maxVirtualPlayers: 49,

  // Starting capital for the main player
  initialCash: 1000000,

  // Stock split: When a price exceeds this value, a split is triggered
  stockSplitThreshold: 750,

  // Stock split ratio (3:1 = price divided by 3, shares tripled)
  stockSplitRatio: 3,

  // Starting capital range for virtual players (derived from initialCash below)
  get virtualPlayerCashMin() { return this.initialCash * 0.5; },  // 50% of player's starting capital
  get virtualPlayerCashMax() { return this.initialCash * 2.0; },  // 200% of player's starting capital

  // Whether virtual players can take loans
  virtualPlayerLoansEnabled: true,

  // Update interval in milliseconds
  updateInterval: 5000,

  // Default game mode
  defaultGameMode: 'realLife' as GameMode,

  // Number of warmup cycles before game start
  // Simulates market activity so charts look "alive"
  warmupCycles: 128,

  // Game End Ranking Display
  // Number of top players to show in ranking
  rankingTopCount: 3,
  // Number of bottom players to show in ranking
  rankingBottomCount: 3,
};

/**
 * Trading mechanics per game mode
 *
 * Spread: Difference between buy and sell price (prevents instant arbitrage)
 * Slippage: Price deviation on large orders (simulates market depth)
 * Fees: Transaction costs (only in Real Life / Hard Life)
 * Delay: Order execution in next cycle (only in Real Life / Hard Life)
 */
export const TRADING_MECHANICS: Record<GameMode, TradingMechanics> = {
  realLife: {
    spreadPercent: 0.02,        // 2% spread
    slippagePerShare: 0.001,    // 0.1% per share
    maxSlippage: 0.10,          // Max 10% slippage
    feePercent: 0.005,          // 0.5% fee
    minFee: 1,                  // Min $1 fee
    orderDelayCycles: 1,        // 1 cycle delay
    marketOrderCashBuffer: 0.05, // 5% cash buffer for market/stop orders
  },
  hardLife: {
    spreadPercent: 0.03,        // 3% spread
    slippagePerShare: 0.0015,   // 0.15% per share
    maxSlippage: 0.15,          // Max 15% slippage
    feePercent: 0.01,           // 1% fee
    minFee: 2,                  // Min $2 fee
    orderDelayCycles: 1,        // 1 cycle delay
    marketOrderCashBuffer: 0.05, // 5% cash buffer for market/stop orders
  },
};

// Used by game mode selector (currently hidden, planned for future release)
export const GAME_MODES: GameModeConfig[] = [
  {
    id: 'realLife',
    name: 'Real Life',
    description: 'Normale Marktbedingungen',
  },
  {
    id: 'hardLife',
    name: 'Hard Life',
    description: 'Teure Trades, keine Einblicke in Markt und Konkurrenz',
  },
];

export const BUY_ORDER_TYPES: OrderTypeConfig[] = [
  {id: 'market', name: 'Billigst'},
  {id: 'limit', name: 'Limit'},
  {id: 'stopBuy', name: 'Stop Buy'},
  {id: 'stopBuyLimit', name: 'Stop Buy Limit'},
];

export const SELL_ORDER_TYPES: OrderTypeConfig[] = [
  {id: 'market', name: 'Bestens'},
  {id: 'limit', name: 'Limit'},
  {id: 'stopBuy', name: 'Stop Loss'},
  {id: 'stopBuyLimit', name: 'Stop Loss Limit'},
];

/** Default order validity in cycles */
export const DEFAULT_ORDER_VALIDITY_CYCLES = 10;

/**
 * Market Maker configuration
 *
 * The Market Maker acts as counterparty for all trades:
 * - Player buys → MM sells from inventory → inventory decreases
 * - Player sells → MM buys into inventory → inventory increases
 * - Low inventory → higher spread (stock becomes "scarce")
 * - High inventory → lower spread (MM wants to offload)
 */
export const MARKET_MAKER_CONFIG: MarketMakerConfig = {
  // Base inventory per stock (100k shares)
  baseInventoryPerStock: 100000,

  // Inventory thresholds for spread calculation
  minInventoryThreshold: 0.1,   // At 10% → maximum spread
  maxInventoryThreshold: 1.9,   // At 190% → minimum spread

  // Spread multiplier range
  minSpreadMultiplier: 0.5,     // 50% of base spread (abundant supply)
  maxSpreadMultiplier: 3.0,     // 300% of base spread (scarce supply)

  // Rebalancing rate per cycle (1% = slow return to base)
  rebalanceRate: 0.01,
};

/**
 * Loan System Configuration
 *
 * Players can take loans backed by their portfolio value.
 * Interest is charged periodically based on risk profile and utilization.
 *
 * Collateral calculation:
 * - Cash: 100% collateral value
 * - Large Cap stocks (>200B market cap): 70% collateral value
 * - Small/Mid-Cap stocks (≤200B market cap): 50% collateral value
 *
 * Interest rate modifiers:
 * - Base rate: Applied to all loans
 * - Risk profile: Conservative players get bonus, aggressive players pay penalty
 *   (Dampened by trade count: fewer trades = less confidence = less adjustment)
 * - Trading history: Only significant losses (>threshold) increase the rate
 *   (Profits and small losses have no effect on the interest rate)
 * - Utilization: Higher utilization = higher rates (progressive tiers)
 * - Credit line extensions: Each extension adds penalty to rate
 *
 * Risk Profile Dampening:
 *   The risk profile adjustment scales with trading experience.
 *   With fewer than minTradesForFullRiskImpact trades, the adjustment
 *   is proportionally reduced (0 trades = 0% effect, 10 trades = 100% effect).
 *   This prevents unfair penalties/bonuses based on limited data.
 *
 * Trading History Impact:
 *   Only realized losses exceeding lossThresholdForHistoryImpact trigger
 *   a rate penalty. The penalty is calculated based on the excess amount.
 *   Profits and minor losses do not affect the interest rate.
 */
export const LOAN_CONFIG: LoanConfig = {
  // === Interest Rate Settings ===
  /** Base interest rate as decimal (0.06 = 6%) */
  baseInterestRate: 0.06,
  /** Number of game cycles between interest charges */
  interestChargeCycles: 20,

  // === Collateral Ratios ===
  /** Cash collateral ratio (1.0 = 100%) */
  cashCollateralRatio: 1.0,
  /** Collateral ratio for large cap stocks (market cap > threshold) */
  largeCapCollateralRatio: 0.70,
  /** Collateral ratio for small/mid-cap stocks (market cap ≤ threshold) */
  smallCapCollateralRatio: 0.50,
  /** Market cap threshold in billions to classify as large cap */
  largeCapThresholdBillions: 200,

  // === Credit Line Calculation ===
  /** Minimum collateral required to take a loan */
  minCollateralForLoan: 1000,
  /** Multiplier for maximum credit line (recommended × this = max) */
  maxCreditLineMultiplier: 2.5,

  // === Multiple Loans ===
  /** Maximum number of concurrent loans allowed */
  maxLoans: 3,
  /** Interest rate penalty per additional loan (0.01 = +1%) - first loan is free */
  additionalLoanInterestPenalty: 0.01,

  // === Fees ===
  /** Origination fee as decimal (0.015 = 1.5%) - charged upfront on loan amount */
  originationFeePercent: 0.015,
  /** Repayment fee as decimal (0.005 = 0.5%) - charged on repayment amount */
  repaymentFeePercent: 0.005,

  // === Progressive Utilization Surcharges ===
  /** Interest surcharge when utilization ≥ 50% */
  utilizationTier50Surcharge: 0.01,
  /** Interest surcharge when utilization ≥ 75% */
  utilizationTier75Surcharge: 0.03,
  /** Interest surcharge when utilization = 100% */
  utilizationTier100Surcharge: 0.06,

  // === Risk Profile Modifiers ===
  /** Interest rate bonus for conservative players (negative = discount) */
  conservativeInterestBonus: -0.01,
  /** Interest rate penalty for aggressive players */
  aggressiveInterestPenalty: 0.02,
  /**
   * Minimum trades for full risk profile impact.
   * With fewer trades, the risk adjustment is dampened:
   * - 0 trades: 0% of full adjustment
   * - minTrades/2: 50% of full adjustment
   * - minTrades+: 100% of full adjustment
   */
  minTradesForFullRiskImpact: 10,

  // === Profit/Loss History Modifier ===
  /** Rate adjustment per $1000 profit/loss (negative profit = penalty) */
  profitHistoryModifierRate: 0.00005,
  /** Maximum adjustment from profit history (caps at ±this value) */
  maxProfitHistoryModifier: 0.02,
  /**
   * Minimum loss threshold before trading history affects interest rate.
   * Only losses exceeding this threshold (in absolute $) trigger a rate penalty.
   * Profits and smaller losses have no effect on the rate.
   */
  lossThresholdForHistoryImpact: 5000,

  // === Loan Duration Settings ===
  /** Minimum loan duration in cycles (should match interestChargeCycles) */
  minLoanDurationCycles: 20,
  /** Maximum loan duration in cycles */
  maxLoanDurationCycles: 100,
  /** Default loan duration in cycles */
  defaultLoanDurationCycles: 40,
  /** Step size for duration selection (should match interestChargeCycles) */
  loanDurationStepCycles: 20,
  /** Number of cycles before maturity to warn the player (shows one warning toast) */
  loanDueWarningCycles: 4,

  // === Duration-based Interest Discount ===
  /**
   * Interest rate discount per duration step above minimum.
   * Longer loans get better rates to incentivize commitment.
   * Example: 0.005 = 0.5% discount per 20 additional cycles
   */
  durationDiscountPerStep: 0.005,
  /** Maximum discount from duration (caps the benefit) */
  maxDurationDiscount: 0.02,

  // === Credit Score Settings ===
  /** Starting credit score for new players (0-100 scale, 50 = neutral) */
  initialCreditScore: 50,
  /** Credit score bonus for on-time repayment */
  creditScoreOnTimeBonus: 3,
  /** Credit score bonus for early repayment */
  creditScoreEarlyBonus: 5,
  /** Base credit score penalty per cycle overdue (before progressive multiplier) */
  creditScoreOverduePenaltyPerCycle: 1,
  /**
   * Number of cycles after which the overdue penalty increases.
   * Progressive penalty formula: basePenalty * (1 + floor(overdueForCycles / threshold))
   * Example with threshold=5: cycles 1-5 = 1x, 6-10 = 2x, 11-15 = 3x penalty
   * This ensures long overdue periods are punished more severely than multiple short ones.
   */
  creditScoreProgressiveThreshold: 5,
  /** Maximum credit score penalty per individual cycle (caps the progressive multiplier) */
  creditScoreMaxPenaltyPerCycle: 10,
  /** Interest rate modifier per credit score point below 50 (e.g., 0.001 = +0.1% per point) */
  creditScorePenaltyRate: 0.001,
  /** Interest rate modifier per credit score point above 50 (e.g., 0.0005 = -0.05% per point) */
  creditScoreBonusRate: 0.0005,
  /** Minimum credit score */
  minCreditScore: 0,
  /** Maximum credit score */
  maxCreditScore: 100,

  // === Base Collateral ===
  /**
   * Base collateral as percentage of starting capital.
   * This "virtual" collateral improves creditworthiness but does NOT count toward net worth.
   * Players can lose more than their starting capital by leveraging this collateral.
   * Example: 0.25 = 25% of initial cash as base collateral
   */
  baseCollateralPercent: 0.25,
};

/**
 * Market Phase System Configuration
 *
 * Controls the dynamic economic climate of the game.
 * Each phase affects volatility, market maker spreads, and virtual player behavior.
 *
 * Phase Flow:
 * - prosperity → boom (when index rises significantly) or consolidation
 * - boom → consolidation (higher probability due to overheating)
 * - consolidation → prosperity (normal stabilization) or panic (only via crash trigger!)
 * - panic → recession (automatically after ~20 cycles)
 * - recession → recovery (stabilization phase)
 * - recovery → prosperity (NOT directly to boom!)
 *
 * Crash Mechanic:
 * When a sector index stays >20% above its 50-cycle average,
 * crash probability increases each cycle. A crash triggers panic phase.
 */
export const MARKET_PHASE_CONFIG: MarketPhaseSystemConfig = {
  phases: {
    prosperity: {
      volatilityMultiplier: 1.0,
      mmSpreadModifier: 0,
      minDuration: 30,
      maxDuration: 60,
    },
    boom: {
      volatilityMultiplier: 1.5,
      mmSpreadModifier: -0.2,
      minDuration: 20,
      maxDuration: 50,
    },
    consolidation: {
      volatilityMultiplier: 2.0,
      mmSpreadModifier: 0.3,
      minDuration: 10,
      maxDuration: 30,
    },
    panic: {
      volatilityMultiplier: 3.0,
      mmSpreadModifier: 1.0,
      minDuration: 15,
      maxDuration: 25,
    },
    recession: {
      volatilityMultiplier: 1.3,
      mmSpreadModifier: 0.5,
      minDuration: 40,
      maxDuration: 80,
    },
    recovery: {
      volatilityMultiplier: 1.2,
      mmSpreadModifier: 0.2,
      minDuration: 15,
      maxDuration: 40,
    },
  },
  transitions: {
    // Probabilities per cycle (when conditions are met)
    prosperityToBoom: 0.02,           // 2% when index +15% over 30 cycles
    prosperityToConsolidation: 0.01,
    boomToConsolidation: 0.03,        // Higher due to overheating
    consolidationToProsperity: 0.03,
    consolidationToPanic: 0.02,       // Only via crash trigger!
    panicToRecession: 0.05,           // ~20 cycles average
    recessionToRecovery: 0.025,
    recoveryToProsperity: 0.04,       // Faster transition out of recovery
  },
  crashMechanic: {
    overheatThreshold: 0.20,        // 20% above 50-cycle average
    baseCrashProbability: 0.005,    // 0.5% base
    crashProbabilityPerCycle: 0.002, // +0.2% per overheated cycle
    crashImpactMin: 0.08,           // -8% minimum drop
    crashImpactMax: 0.15,           // -15% maximum drop
  },
  sectorInteraction: {
    interactionMultiplier: 1.0,     // 1.0 = normal strength, can be increased for stronger correlations
  },
};

/**
 * Float System Configuration
 *
 * The float represents the total number of tradeable shares for each stock.
 * This creates scarcity and realistic market dynamics.
 *
 * Initial distribution:
 * - MM starts with mmInitialPercent of float (e.g., 50%)
 * - VPs start with initial holdings (from their portfolios)
 * - Player starts with 0 shares
 *
 * When shares become scarce (low MM inventory), prices naturally rise
 * due to supply/demand dynamics.
 */
export const FLOAT_CONFIG = {
  /** Percentage of market cap represented as tradeable float */
  floatPercentage: 0.20,
  /** Scale factor to reduce share counts for game balance (divide by this) */
  scaleFactor: 1000,
  /** Percentage of float initially held by Market Maker */
  mmInitialPercent: 0.50,
  /** Warning threshold: show warning when MM holds less than this % of float */
  lowFloatWarningPercent: 0.10,
};

/**
 * Order Book Configuration
 *
 * The order book enables player-to-player and player-to-VP trading
 * before falling back to the Market Maker.
 */
export const ORDER_BOOK_CONFIG = {
  /** VP orders remain in book for this many cycles */
  vpOrderLifetime: 5,
  /** Maximum orders a single VP can have in the book */
  maxOrdersPerVP: 3,
  /** Price improvement for aggressive orders (e.g., 0.005 = 0.5%) */
  priceImprovement: 0.005,
  /** Minimum spread between best bid and ask before MM steps in */
  minSpreadForMM: 0.01,
};

/**
 * Trader Type Distribution Configuration
 *
 * Defines how virtual players are distributed across trading strategies.
 * This creates emergent market dynamics through diverse behaviors.
 *
 * Types:
 * - marketMaker: Places orders on both sides, profits from spread
 * - momentum: Follows trends, creates momentum cascades
 * - contrarian: Fights trends, provides mean reversion
 * - fundamentalist: Trades on fair value, stabilizes prices
 * - noise: Random trading, adds liquidity and unpredictability
 * - balanced: Current risk-tolerance based behavior
 */
export const TRADER_TYPE_CONFIG = {
  /** Distribution of trader types (must sum to 1.0) */
  distribution: {
    marketMaker: 0.10,     // 10% - ~5 VPs
    momentum: 0.20,        // 20% - ~10 VPs
    contrarian: 0.20,      // 20% - ~10 VPs
    fundamentalist: 0.15,  // 15% - ~7-8 VPs
    noise: 0.15,           // 15% - ~7-8 VPs
    balanced: 0.20,        // 20% - ~10 VPs
  } as Record<TraderType, number>,

  /** Default strategy parameters per type */
  defaultParams: {
    marketMaker: {
      targetSpread: 0.02,      // 2% target spread
      inventoryTarget: 0.5,    // Neutral inventory
    },
    momentum: {
      trendLookback: 5,        // 5 candles
      trendThreshold: 0.02,    // 2% minimum trend
    },
    contrarian: {
      oversoldThreshold: 30,   // RSI < 30 = oversold
      overboughtThreshold: 70, // RSI > 70 = overbought
    },
    fundamentalist: {
      valuationTolerance: 0.10, // Trade when 10%+ from fair value
    },
    noise: {
      tradeFrequency: 0.30,    // 30% chance to trade each cycle
    },
  },
};

/**
 * Short Selling Configuration
 *
 * Short selling allows players to sell borrowed shares, profiting from price declines.
 * The player must maintain margin (collateral) to cover potential losses.
 *
 * Margin System (Option B - Credit Line based):
 * - Initial margin is deducted from the player's available credit line
 * - As the stock price moves, margin requirements change
 * - If margin falls below maintenance level, a margin call is triggered
 * - Borrow fees are charged per cycle based on position value
 *
 * Flow:
 * 1. Player opens short: borrows shares, sells them, locks margin
 * 2. Per cycle: borrow fees charged, margin requirements updated
 * 3. Player covers: buys shares back, returns them, releases margin
 * 4. Profit/Loss = Entry Price - Exit Price - Fees (per share)
 */
export const SHORT_SELLING_CONFIG: ShortSellingConfig = {
  /** Feature toggle - set to false to disable short selling */
  enabled: true,

  /**
   * Initial margin requirement as multiplier of position value.
   * 1.5 = 150% means shorting $10,000 worth of stock requires $15,000 margin.
   * This protects against unlimited loss potential of shorts.
   */
  initialMarginPercent: 1.5,

  /**
   * Maintenance margin requirement.
   * 1.25 = 125% means if margin falls below 125% of position value,
   * a margin call is triggered.
   */
  maintenanceMarginPercent: 1.25,

  /**
   * Base borrow fee per cycle.
   * 0.001 = 0.1% of position value per cycle.
   * Example: $10,000 short position costs $10/cycle.
   */
  baseBorrowFeePerCycle: 0.001,

  /**
   * Float utilization threshold for "hard to borrow" status.
   * When total short interest exceeds this percentage of float,
   * the stock becomes hard to borrow with higher fees.
   */
  hardToBorrowThreshold: 0.5,

  /**
   * Fee multiplier for hard-to-borrow stocks.
   * 3.0 = 3x the base borrow fee.
   */
  hardToBorrowFeeMultiplier: 3.0,

  /**
   * Grace period after margin call before forced cover.
   * Player has this many cycles to add margin or cover voluntarily.
   */
  marginCallGraceCycles: 5,

  /**
   * Maximum percentage of a stock's float that can be shorted.
   * Prevents excessive short interest that could destabilize the market.
   */
  maxShortPercentOfFloat: 0.5,
};

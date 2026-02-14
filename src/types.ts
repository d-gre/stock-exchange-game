export type GameMode = 'realLife' | 'hardLife';

/** Stock market sector */
export type Sector = 'tech' | 'finance' | 'industrial' | 'commodities';

export interface GameModeConfig {
  id: GameMode;
  name: string;
  description: string;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface Stock {
  symbol: string;
  name: string;
  /** Stock market sector */
  sector: Sector;
  currentPrice: number;
  priceHistory: CandleData[];
  change: number;
  changePercent: number;
  /** Market capitalization in billions USD (for index weighting) */
  marketCapBillions: number;
  /** Total tradeable shares (float) - calculated from market cap. Optional for backward compatibility. */
  floatShares?: number;
  /** Fair value for fundamentalist traders (optional) */
  fairValue?: number;
}

export interface PortfolioItem {
  symbol: string;
  shares: number;
  avgBuyPrice: number;
}

export interface Portfolio {
  cash: number;
  holdings: PortfolioItem[];
}

export type OrderType = 'limit' | 'market' | 'stopBuy' | 'stopBuyLimit';

/**
 * Short order types for opening and closing short positions.
 * Separate from regular OrderType to keep backwards compatibility.
 */
export type ShortOrderType = 'shortSell' | 'buyToCover';

export interface OrderTypeConfig {
  id: OrderType;
  name: string;
}

export interface ShortOrderTypeConfig {
  id: ShortOrderType;
  name: string;
}

export interface TradeOrder {
  symbol: string;
  type: 'buy' | 'sell';
  shares: number;
  price: number;
}

/**
 * Factors that led to the buy decision
 */
export interface BuyDecisionFactors {
  kind: 'buy';
  /** Stock volatility (0-1, higher = more volatile) */
  volatility: number;
  /** Stock trend (-1 to +1, positive = rising) */
  trend: number;
  /** Calculated score for this stock (0-100) */
  score: number;
  /** Player's risk tolerance (-100 to +100) */
  riskTolerance: number;
}

/**
 * Factors that led to the sell decision
 */
export interface SellDecisionFactors {
  kind: 'sell';
  /** Profit/loss as percentage of purchase price */
  profitPercent: number;
  /** Stock trend (-1 to +1, positive = rising) */
  trend: number;
  /** Calculated sell score (higher = more likely to sell) */
  score: number;
  /** Player's risk tolerance (-100 to +100) */
  riskTolerance: number;
  /** Average purchase price */
  avgBuyPrice: number;
}

export type DecisionFactors = BuyDecisionFactors | SellDecisionFactors;

export interface VirtualPlayerTransaction {
  id: string;
  symbol: string;
  type: 'buy' | 'sell' | 'shortSell' | 'buyToCover';
  shares: number;
  price: number;
  timestamp: number;
  /** Factors that led to the decision */
  decisionFactors?: DecisionFactors;
}

export interface VirtualPlayerSettings {
  /** Risk tolerance: -100 (risk-averse) to 100 (risk-seeking), 0 = neutral */
  riskTolerance: number;
  /** Trader type for strategy-based behavior. Defaults to 'balanced' if not set. */
  traderType?: TraderType;
  /** Strategy-specific parameters */
  strategyParams?: TraderStrategyParams;
}

export interface VirtualPlayer {
  id: string;
  name: string;
  portfolio: Portfolio;
  transactions: VirtualPlayerTransaction[];
  settings: VirtualPlayerSettings;
  /** Active loans (same structure as player loans) */
  loans: Loan[];
  /** Cycles since last interest charge */
  cyclesSinceInterest: number;
  /** Initial starting cash (for end-game comparison) - defaults to portfolio.cash if not set */
  initialCash?: number;
  /** Open short positions (optional - initialized as empty array) */
  shortPositions?: ShortPosition[];
}

/**
 * Trading mechanics for a game mode
 */
export interface TradingMechanics {
  /** Spread as percentage (e.g. 0.02 = 2%) - difference between buy and sell price */
  spreadPercent: number;
  /** Slippage per share as percentage (e.g. 0.001 = 0.1%) */
  slippagePerShare: number;
  /** Maximum slippage as percentage */
  maxSlippage: number;
  /** Transaction fee as percentage (e.g. 0.005 = 0.5%) */
  feePercent: number;
  /** Minimum transaction fee in absolute values */
  minFee: number;
  /** Order delay in update cycles (0 = immediate execution) */
  orderDelayCycles: number;
  /** Cash buffer for market/stop orders (e.g. 0.05 = 5%) to prevent failures due to price changes */
  marketOrderCashBuffer: number;
}

/**
 * Result of a price calculation including all costs
 */
export interface TradeExecution {
  /** Effective price per share after spread and slippage */
  effectivePrice: number;
  /** Total cost/proceeds before fees */
  subtotal: number;
  /** Transaction fee */
  fee: number;
  /** Total cost (buy) or net proceeds (sell) */
  total: number;
  /** Breakdown of price components */
  breakdown: {
    basePrice: number;
    spreadCost: number;
    slippageCost: number;
  };
}

/**
 * Loan request attached to a pending buy order
 * The loan is created when the order executes, not when it's placed
 */
export interface OrderLoanRequest {
  /** Amount of loan needed to complete the order */
  amount: number;
  /** Interest rate locked in at order creation time */
  interestRate: number;
  /** Loan duration in cycles */
  durationCycles: number;
}

/**
 * Pending order for delayed execution
 */
export interface PendingOrder {
  id: string;
  symbol: string;
  type: 'buy' | 'sell' | 'shortSell' | 'buyToCover';
  shares: number;
  /** Order type: market, limit, stopBuy, stopBuyLimit */
  orderType: OrderType;
  /** Limit price (for limit and stopBuyLimit orders) */
  limitPrice?: number;
  /** Stop price (for stopBuy and stopBuyLimit orders) */
  stopPrice?: number;
  /** Market price at order placement time (for display/reference) */
  orderPrice: number;
  /** Remaining cycles until order expires (0 = unlimited or market) */
  remainingCycles: number;
  /** Timestamp of order placement */
  timestamp: number;
  /** Has the stop been triggered? (for stopBuy/stopBuyLimit) */
  stopTriggered?: boolean;
  /** Is this a newly created order? (creation cycle doesn't count) */
  isNew?: boolean;
  /** Optional loan request - loan is created when order executes */
  loanRequest?: OrderLoanRequest;
  /** Collateral to lock when shortSell order executes */
  collateralToLock?: number;
}

/**
 * Pending short order for delayed execution.
 * Separate from PendingOrder to maintain backwards compatibility.
 */
export interface PendingShortOrder {
  id: string;
  symbol: string;
  /** Short order type: shortSell or buyToCover */
  shortOrderType: ShortOrderType;
  shares: number;
  /** Market price at order placement time (for display/reference) */
  orderPrice: number;
  /** Limit price (optional - for limit-style short orders) */
  limitPrice?: number;
  /** Remaining cycles until order expires */
  remainingCycles: number;
  /** Timestamp of order placement */
  timestamp: number;
  /** Is this a newly created order? (creation cycle doesn't count) */
  isNew?: boolean;
  /** Collateral to be locked when shortSell executes */
  collateralToLock?: number;
}

/**
 * Status of a trade
 */
export type TradeStatus = 'executed' | 'failed';

/**
 * Reason for order failure
 */
export type TradeFailureReason = 'insufficient_funds' | 'insufficient_shares' | 'expired';

/**
 * Completed trade by the player (for history)
 */
export interface CompletedTrade {
  id: string;
  symbol: string;
  type: 'buy' | 'sell' | 'shortSell' | 'buyToCover';
  shares: number;
  /** Effective price per share (after costs) */
  pricePerShare: number;
  /** Total transaction amount */
  totalAmount: number;
  /** Timestamp of execution */
  timestamp: number;
  /** Game cycle when the trade was executed */
  cycle?: number;
  /** Realized profit/loss (only for sells) */
  realizedProfitLoss?: number;
  /** Average purchase price (for sells) */
  avgBuyPrice?: number;
  /** Order status (default: 'executed') */
  status?: TradeStatus;
  /** Reason for failure (only when status = 'failed') */
  failureReason?: TradeFailureReason;
  /** Detailed failure description (human-readable, for display) */
  failureDetails?: string;
}

/**
 * Risk profile category based on trading behavior
 */
export type RiskProfileCategory = 'conservative' | 'moderate' | 'aggressive';

/**
 * Risk profile analysis of the player
 */
export interface RiskProfileAnalysis {
  /** Risk score (-100 to +100, like virtual players) */
  riskScore: number;
  /** Category */
  category: RiskProfileCategory;
  /** Average position size relative to portfolio */
  avgPositionSizePercent: number;
  /** Average holding duration in seconds */
  avgHoldingDuration: number;
  /** Number of trades */
  totalTrades: number;
  /** Win/loss ratio (wins / losses) */
  winLossRatio: number;
  /** Average profit on winning trades */
  avgWin: number;
  /** Average loss on losing trades */
  avgLoss: number;
  /** Total realized profit/loss */
  totalRealizedProfitLoss: number;
}

/**
 * Market Maker inventory state for a single stock
 */
export interface MarketMakerInventory {
  /** Stock symbol */
  symbol: string;
  /** Current inventory (number of shares the MM holds) */
  inventory: number;
  /** Base inventory level (target for rebalancing) */
  baseInventory: number;
  /** Dynamic spread multiplier based on inventory level (0.5 - 3.0) */
  spreadMultiplier: number;
}

/**
 * Market Maker configuration
 */
export interface MarketMakerConfig {
  /** Base inventory per stock (e.g., 100000 shares) */
  baseInventoryPerStock: number;
  /** Inventory ratio at which spread is maximum (e.g., 0.1 = 10%) */
  minInventoryThreshold: number;
  /** Inventory ratio at which spread is minimum (e.g., 1.9 = 190%) */
  maxInventoryThreshold: number;
  /** Minimum spread multiplier (e.g., 0.5 = 50% of base spread) */
  minSpreadMultiplier: number;
  /** Maximum spread multiplier (e.g., 3.0 = 300% of base spread) */
  maxSpreadMultiplier: number;
  /** Rate at which inventory rebalances per cycle (e.g., 0.01 = 1%) */
  rebalanceRate: number;
}

// ============================================================================
// LOAN SYSTEM TYPES
// ============================================================================

/**
 * Loan configuration parameters
 * All rates are stored as decimals (e.g., 0.06 = 6%)
 */
export interface LoanConfig {
  // Interest Rate Settings
  baseInterestRate: number;
  interestChargeCycles: number;

  // Collateral Ratios
  cashCollateralRatio: number;
  largeCapCollateralRatio: number;
  smallCapCollateralRatio: number;
  largeCapThresholdBillions: number;
  /** Base collateral as percentage of starting capital (e.g., 0.25 = 25%) */
  baseCollateralPercent: number;

  // Credit Line Calculation
  /** Minimum collateral required to take a loan */
  minCollateralForLoan: number;
  /** Multiplier for maximum credit line (recommended × this = max) */
  maxCreditLineMultiplier: number;

  // Multiple Loans
  /** Maximum number of concurrent loans allowed */
  maxLoans: number;
  /** Interest rate penalty per additional loan (first loan is free) */
  additionalLoanInterestPenalty: number;

  // Fees
  originationFeePercent: number;
  /** Repayment fee as decimal (only charged on EARLY repayment) */
  repaymentFeePercent: number;

  // Progressive Utilization Surcharges
  utilizationTier50Surcharge: number;
  utilizationTier75Surcharge: number;
  utilizationTier100Surcharge: number;

  // Risk Profile Modifiers
  conservativeInterestBonus: number;
  aggressiveInterestPenalty: number;
  /** Minimum trades needed for full risk profile impact (fewer trades = dampened effect) */
  minTradesForFullRiskImpact: number;

  // Profit/Loss History Modifier
  profitHistoryModifierRate: number;
  maxProfitHistoryModifier: number;
  /** Minimum loss threshold (absolute value) before history affects rate (e.g., 5000 = $5000 loss) */
  lossThresholdForHistoryImpact: number;

  // === Loan Duration Settings ===
  /** Minimum loan duration in cycles */
  minLoanDurationCycles: number;
  /** Maximum loan duration in cycles */
  maxLoanDurationCycles: number;
  /** Default loan duration in cycles */
  defaultLoanDurationCycles: number;
  /** Step size for duration selection */
  loanDurationStepCycles: number;
  /** Number of cycles before maturity to warn the player */
  loanDueWarningCycles: number;

  // === Duration-based Interest Discount ===
  /** Interest rate discount per duration step above minimum */
  durationDiscountPerStep: number;
  /** Maximum discount from duration */
  maxDurationDiscount: number;

  // === Credit Score Settings ===
  /** Starting credit score for new players (0-100 scale) */
  initialCreditScore: number;
  /** Credit score bonus for on-time repayment */
  creditScoreOnTimeBonus: number;
  /** Credit score bonus for early repayment */
  creditScoreEarlyBonus: number;
  /** Base credit score penalty per cycle overdue (before progressive multiplier) */
  creditScoreOverduePenaltyPerCycle: number;
  /** Number of cycles after which the overdue penalty increases (progressive threshold) */
  creditScoreProgressiveThreshold: number;
  /** Maximum credit score penalty per individual cycle (caps the progressive multiplier) */
  creditScoreMaxPenaltyPerCycle: number;
  /** Interest rate modifier per credit score point below 50 (penalty for bad score) */
  creditScorePenaltyRate: number;
  /** Interest rate modifier per credit score point above 50 (bonus for good score) */
  creditScoreBonusRate: number;
  /** Minimum credit score */
  minCreditScore: number;
  /** Maximum credit score */
  maxCreditScore: number;
}

/**
 * Individual loan record
 */
export interface Loan {
  /** Unique loan identifier */
  id: string;
  /** Sequential loan number for display (e.g., K#I, K#II) */
  loanNumber: number;
  /** Original loan amount (principal) */
  principal: number;
  /** Current outstanding balance (principal + accrued interest) */
  balance: number;
  /** Interest rate locked in at loan origination */
  interestRate: number;
  /** Timestamp when loan was taken */
  createdAt: number;
  /** Total interest paid on this loan so far */
  totalInterestPaid: number;
  /** Original loan duration in cycles */
  durationCycles: number;
  /** Remaining cycles until loan is due (0 = due now, negative = overdue) */
  remainingCycles: number;
  /** Whether this loan is overdue (not repaid at maturity) */
  isOverdue: boolean;
  /** Number of cycles the loan has been overdue */
  overdueForCycles: number;
  /** Whether the "due soon" warning has been shown for this loan */
  warningShown?: boolean;
}

/**
 * Type of credit score event
 */
export type CreditEventType = 'repaid_early' | 'repaid_on_time' | 'auto_repaid' | 'overdue' | 'default_penalty';

/**
 * Record of a credit score change event
 */
export interface CreditScoreEvent {
  /** Type of event */
  type: CreditEventType;
  /** Credit score change (positive or negative) */
  change: number;
  /** Loan ID associated with this event (if applicable) */
  loanId?: string;
  /** Timestamp of the event */
  timestamp: number;
  /** Optional description */
  description?: string;
}

/**
 * Record of a loan that was ever overdue (for historical tracking)
 * Used to calculate credit score based on delinquency patterns
 */
export interface DelinquencyRecord {
  /** Loan ID that was overdue */
  loanId: string;
  /** Maximum number of cycles this loan was overdue */
  maxOverdueCycles: number;
  /** Timestamp when the loan first became overdue */
  startedAt: number;
  /** Timestamp when the loan was repaid (or still overdue if undefined) */
  resolvedAt?: number;
}

// ============================================================================
// MARKET PHASE SYSTEM TYPES
// ============================================================================

/**
 * Market phase representing the current economic climate
 * - consolidation: cooling off after boom/prosperity (Konsolidierung)
 * - recovery: stabilizing after recession/panic (Erholung)
 */
export type MarketPhase = 'prosperity' | 'boom' | 'consolidation' | 'panic' | 'recession' | 'recovery';

/**
 * Configuration for a single market phase
 */
export interface MarketPhaseConfig {
  /** Volatility multiplier (1.0 = normal) */
  volatilityMultiplier: number;
  /** Market maker spread modification (-0.2 = 20% discount, 1.0 = 100% increase) */
  mmSpreadModifier: number;
  /** Minimum duration in cycles */
  minDuration: number;
  /** Maximum duration in cycles */
  maxDuration: number;
}

/**
 * Transition probabilities between phases (per cycle)
 */
export interface PhaseTransitions {
  prosperityToBoom: number;
  prosperityToConsolidation: number;
  boomToConsolidation: number;
  consolidationToProsperity: number;
  consolidationToPanic: number;
  panicToRecession: number;
  recessionToRecovery: number;
  recoveryToProsperity: number;
}

/**
 * Crash mechanic configuration
 */
export interface CrashMechanicConfig {
  /** Threshold above 50-cycle average to trigger overheat (0.20 = 20%) */
  overheatThreshold: number;
  /** Base crash probability per cycle */
  baseCrashProbability: number;
  /** Additional crash probability per overheated cycle */
  crashProbabilityPerCycle: number;
  /** Minimum crash impact (-8% = 0.08) */
  crashImpactMin: number;
  /** Maximum crash impact (-15% = 0.15) */
  crashImpactMax: number;
}

/**
 * Configuration for sector interaction/correlation
 */
export interface SectorInteractionConfig {
  /** Multiplier for inter-sector correlation effects (1.0 = normal, 2.0 = double strength) */
  interactionMultiplier: number;
}

/**
 * Full market phase system configuration
 */
export interface MarketPhaseSystemConfig {
  phases: Record<MarketPhase, MarketPhaseConfig>;
  transitions: PhaseTransitions;
  crashMechanic: CrashMechanicConfig;
  sectorInteraction: SectorInteractionConfig;
}

/**
 * Breakdown of how the effective interest rate was calculated
 * Used for transparency in the loan modal
 */
export interface InterestRateBreakdown {
  /** Base interest rate from config */
  baseRate: number;
  /** Adjustment based on player's risk profile (-/+ percentage) */
  riskProfileAdjustment: number;
  /** Adjustment based on profit/loss history (-/+ percentage) */
  profitHistoryAdjustment: number;
  /** Surcharge based on credit utilization level */
  utilizationSurcharge: number;
  /** Penalty for having multiple loans (first loan is free) */
  loanCountPenalty: number;
  /** Adjustment based on credit score (positive = penalty for bad score, negative = bonus for good score) */
  creditScoreAdjustment: number;
  /** Discount for longer loan durations (always negative or zero) */
  durationDiscount: number;
  /** Final calculated interest rate (sum of all components) */
  effectiveRate: number;
}

/**
 * Credit line calculation result
 * Shows available credit and how it was calculated
 */
export interface CreditLineInfo {
  /** Recommended credit line (stock collateral rounded to thousands) */
  recommendedCreditLine: number;
  /** Maximum amount player can borrow (recommended × multiplier) */
  maxCreditLine: number;
  /** Current total outstanding debt */
  currentDebt: number;
  /** Remaining amount available to borrow */
  availableCredit: number;
  /** Current utilization ratio (0-1, currentDebt / maxCreditLine) */
  utilizationRatio: number;
  /** Utilization vs recommended credit line (can exceed 1.0) */
  utilizationVsRecommended: number;
  /** Number of active loans */
  activeLoansCount: number;
  /** Breakdown of collateral by type */
  collateralBreakdown: {
    /** Large cap stocks contribution (after applying ratio) */
    largeCapStocks: number;
    /** Small/mid cap stocks contribution (after applying ratio) */
    smallCapStocks: number;
    /** Base collateral from starting capital (does NOT count toward net worth) */
    baseCollateral: number;
    /** Total collateral value (stocks + base collateral) */
    total: number;
  };
}

// ============================================================================
// FLOAT SYSTEM TYPES
// ============================================================================

/**
 * Float state for a single stock.
 * Tracks the distribution of shares among different holders.
 */
export interface StockFloat {
  /** Stock symbol */
  symbol: string;
  /** Total tradeable shares (the "float") */
  totalFloat: number;
  /** Shares held by Market Maker (available to buy from MM) */
  mmHeldShares: number;
  /** Shares held by the human player */
  playerHeldShares: number;
  /** Shares held by all virtual players combined */
  vpHeldShares: number;
  /** Shares reserved in pending orders (not yet executed) */
  reservedShares: number;
}

/**
 * Holder types for share transfers.
 */
export type ShareHolder = 'mm' | 'player' | 'vp';

// ============================================================================
// ORDER BOOK TYPES
// ============================================================================

/**
 * Single entry in the order book.
 */
export interface OrderBookEntry {
  /** Unique order ID */
  id: string;
  /** Trader ID: 'player' for human, 'bot-1' etc. for VPs */
  traderId: string;
  /** Stock symbol */
  symbol: string;
  /** Order type */
  type: 'buy' | 'sell';
  /** Number of shares */
  shares: number;
  /** Limit price */
  price: number;
  /** Order timestamp */
  timestamp: number;
  /** Original pending order ID (for player orders) */
  originalOrderId?: string;
  /** Remaining cycles before expiry (for VP orders) */
  remainingCycles?: number;
}

/**
 * Order book for a single stock.
 */
export interface OrderBook {
  /** Stock symbol */
  symbol: string;
  /** Bid orders (buy), sorted: price DESC, time ASC */
  bids: OrderBookEntry[];
  /** Ask orders (sell), sorted: price ASC, time ASC */
  asks: OrderBookEntry[];
}

/**
 * Result of an order matching attempt.
 */
export interface OrderMatchResult {
  /** IDs of fully matched orders */
  matchedOrderIds: string[];
  /** Partial fills: orderId -> remaining shares */
  partialFills: Record<string, number>;
  /** Executed trades from matching */
  executedTrades: ExecutedMatchTrade[];
  /** Shares that could not be filled from order book */
  unfilledShares: number;
}

/**
 * A single trade executed through order book matching.
 */
export interface ExecutedMatchTrade {
  /** Unique trade ID */
  id: string;
  /** Stock symbol */
  symbol: string;
  /** Buyer trader ID */
  buyerId: string;
  /** Seller trader ID */
  sellerId: string;
  /** Number of shares traded */
  shares: number;
  /** Execution price */
  price: number;
  /** Trade timestamp */
  timestamp: number;
}

// ============================================================================
// SHORT SELLING TYPES
// ============================================================================

/**
 * A short position represents borrowed shares that were sold,
 * with the obligation to buy them back later.
 */
export interface ShortPosition {
  /** Stock symbol */
  symbol: string;
  /** Number of shares shorted */
  shares: number;
  /** Average price at which shares were sold (entry price) */
  entryPrice: number;
  /** Timestamp when the position was opened */
  openedAt: number;
  /** Amount of collateral locked as margin */
  collateralLocked: number;
  /** Total borrow fees paid on this position */
  totalBorrowFeesPaid: number;
}

/**
 * Configuration for short selling mechanics.
 * All percentages are stored as decimals (e.g., 1.5 = 150%).
 */
export interface ShortSellingConfig {
  /** Whether short selling is enabled */
  enabled: boolean;
  /** Initial margin requirement as multiplier (e.g., 1.5 = 150% of position value) */
  initialMarginPercent: number;
  /** Maintenance margin requirement (e.g., 1.25 = 125% of position value) */
  maintenanceMarginPercent: number;
  /** Base borrow fee per cycle as decimal (e.g., 0.001 = 0.1%) */
  baseBorrowFeePerCycle: number;
  /** Float utilization threshold for "hard to borrow" status (e.g., 0.8 = 80%) */
  hardToBorrowThreshold: number;
  /** Fee multiplier for hard-to-borrow stocks */
  hardToBorrowFeeMultiplier: number;
  /** Number of cycles before forced cover after margin call */
  marginCallGraceCycles: number;
  /** Maximum percentage of a stock's float that can be shorted (e.g., 0.5 = 50%) */
  maxShortPercentOfFloat: number;
}

/**
 * Result of a margin calculation for short positions.
 */
export interface ShortMarginInfo {
  /** Total margin required for all short positions */
  totalMarginRequired: number;
  /** Total collateral currently locked */
  totalCollateralLocked: number;
  /** Available margin from credit line */
  availableMargin: number;
  /** Margin utilization ratio (0-1+) */
  marginUtilization: number;
  /** Positions that are at risk of margin call */
  positionsAtRisk: string[];
  /** Positions that have triggered margin call */
  positionsInMarginCall: string[];
}

/**
 * Borrow status for a stock (affects fees).
 */
export type BorrowStatus = 'easy' | 'hard';

// ============================================================================
// TRADER TYPE SYSTEM
// ============================================================================

/**
 * Trader strategy types for virtual players.
 */
export type TraderType =
  | 'marketMaker'    // Provides liquidity, profits from spread
  | 'momentum'       // Follows trends (buys rising, sells falling)
  | 'contrarian'     // Trades against trends (buys dips, sells peaks)
  | 'fundamentalist' // Trades based on fair value vs current price
  | 'noise'          // Random trading for market liquidity
  | 'balanced';      // Current behavior (risk-tolerance based)

/**
 * Strategy-specific parameters for virtual players.
 */
export interface TraderStrategyParams {
  // Market Maker
  /** Target bid-ask spread as percentage */
  targetSpread?: number;
  /** Target inventory level (0.5 = neutral) */
  inventoryTarget?: number;

  // Momentum
  /** Number of candles to look back for trend */
  trendLookback?: number;
  /** Minimum trend strength to trigger trade */
  trendThreshold?: number;

  // Contrarian
  /** RSI or similar below this = oversold (buy signal) */
  oversoldThreshold?: number;
  /** RSI or similar above this = overbought (sell signal) */
  overboughtThreshold?: number;

  // Fundamentalist
  /** Tolerance for deviation from fair value (e.g., 0.10 = 10%) */
  valuationTolerance?: number;

  // Noise
  /** Base probability to trade each cycle */
  tradeFrequency?: number;
}

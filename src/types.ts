export type GameMode = 'sandbox' | 'realLife' | 'hardLife';

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
  currentPrice: number;
  priceHistory: CandleData[];
  change: number;
  changePercent: number;
  /** Market capitalization in billions USD (for index weighting) */
  marketCapBillions: number;
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

export interface OrderTypeConfig {
  id: OrderType;
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
  type: 'buy' | 'sell';
  shares: number;
  price: number;
  timestamp: number;
  /** Factors that led to the decision */
  decisionFactors?: DecisionFactors;
}

export interface VirtualPlayerSettings {
  /** Risk tolerance: -100 (risk-averse) to 100 (risk-seeking), 0 = neutral */
  riskTolerance: number;
}

export interface VirtualPlayer {
  id: string;
  name: string;
  portfolio: Portfolio;
  transactions: VirtualPlayerTransaction[];
  settings: VirtualPlayerSettings;
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
 * Pending order for delayed execution
 */
export interface PendingOrder {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
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
  type: 'buy' | 'sell';
  shares: number;
  /** Effective price per share (after costs) */
  pricePerShare: number;
  /** Total transaction amount */
  totalAmount: number;
  /** Timestamp of execution */
  timestamp: number;
  /** Realized profit/loss (only for sells) */
  realizedProfitLoss?: number;
  /** Average purchase price (for sells) */
  avgBuyPrice?: number;
  /** Order status (default: 'executed') */
  status?: TradeStatus;
  /** Reason for failure (only when status = 'failed') */
  failureReason?: TradeFailureReason;
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

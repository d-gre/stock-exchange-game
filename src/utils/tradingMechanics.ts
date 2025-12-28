import type { TradingMechanics, TradeExecution } from '../types';

/**
 * Calculates the spread portion of costs/proceeds
 *
 * Spread is the difference between buy and sell price.
 * Buyers pay half the spread more, sellers receive half less.
 *
 * @param basePrice - Current market price
 * @param type - 'buy' or 'sell'
 * @param mechanics - Trading mechanics for the current game mode
 * @returns Spread cost (positive for buyers, negative for sellers)
 */
export const calculateSpread = (
  basePrice: number,
  type: 'buy' | 'sell',
  mechanics: TradingMechanics
): number => {
  const halfSpread = mechanics.spreadPercent / 2;
  const direction = type === 'buy' ? 1 : -1;
  return basePrice * halfSpread * direction;
};

/**
 * Calculates the slippage portion of costs/proceeds
 *
 * Slippage simulates market depth: The more shares traded,
 * the more the price moves during execution.
 * The calculation is progressive - each additional share worsens the price.
 *
 * @param basePrice - Current market price
 * @param shares - Number of shares
 * @param type - 'buy' or 'sell'
 * @param mechanics - Trading mechanics for the current game mode
 * @returns Slippage cost (positive for buyers, negative for sellers)
 */
export const calculateSlippage = (
  basePrice: number,
  shares: number,
  type: 'buy' | 'sell',
  mechanics: TradingMechanics
): number => {
  if (shares <= 1) return 0;

  // Progressive slippage: Sum from 0 to (shares-1)
  // Formula: n * (n-1) / 2 for sum from 0 to n-1
  const n = shares;
  const sumOfIndices = (n * (n - 1)) / 2;

  // Average slippage per share, then times number of shares
  const rawSlippage = basePrice * mechanics.slippagePerShare * sumOfIndices / shares * shares;

  // Cap at maxSlippage
  const maxSlippageAmount = basePrice * mechanics.maxSlippage * shares;
  const cappedSlippage = Math.min(rawSlippage, maxSlippageAmount);

  // Direction: Buyers pay more, sellers receive less
  const direction = type === 'buy' ? 1 : -1;

  return cappedSlippage * direction;
};

/**
 * Calculates the transaction fee
 *
 * @param subtotal - Total value of the transaction before fees
 * @param mechanics - Trading mechanics for the current game mode
 * @returns Fee in absolute values
 */
export const calculateFee = (
  subtotal: number,
  mechanics: TradingMechanics
): number => {
  if (mechanics.feePercent === 0 && mechanics.minFee === 0) {
    return 0;
  }

  const percentageFee = Math.abs(subtotal) * mechanics.feePercent;
  return Math.max(percentageFee, mechanics.minFee);
};

/**
 * Calculates the effective price per share after spread and slippage
 *
 * @param basePrice - Current market price
 * @param shares - Number of shares
 * @param type - 'buy' or 'sell'
 * @param mechanics - Trading mechanics for the current game mode
 * @returns Effective price per share
 */
export const calculateEffectivePrice = (
  basePrice: number,
  shares: number,
  type: 'buy' | 'sell',
  mechanics: TradingMechanics
): number => {
  const spreadCost = calculateSpread(basePrice, type, mechanics);
  const slippageCost = calculateSlippage(basePrice, shares, type, mechanics);

  // Convert total costs to price per share
  const totalCostPerShare = (spreadCost + slippageCost) / shares;

  return parseFloat((basePrice + totalCostPerShare).toFixed(2));
};

/**
 * Calculates the complete trade execution with all costs
 *
 * @param basePrice - Current market price
 * @param shares - Number of shares
 * @param type - 'buy' or 'sell'
 * @param mechanics - Trading mechanics for the current game mode
 * @returns Complete trade execution with breakdown
 */
export const calculateTradeExecution = (
  basePrice: number,
  shares: number,
  type: 'buy' | 'sell',
  mechanics: TradingMechanics
): TradeExecution => {
  const spreadCost = calculateSpread(basePrice, type, mechanics);
  const slippageCost = calculateSlippage(basePrice, shares, type, mechanics);

  // Effective price per share
  const totalCostPerShare = (spreadCost + slippageCost) / shares;
  const effectivePrice = parseFloat((basePrice + totalCostPerShare).toFixed(2));

  // Subtotal (before fees)
  const subtotal = parseFloat((effectivePrice * shares).toFixed(2));

  // Fees
  const fee = parseFloat(calculateFee(subtotal, mechanics).toFixed(2));

  // Total: For buy we add fees, for sell we subtract them
  const total = type === 'buy'
    ? parseFloat((subtotal + fee).toFixed(2))
    : parseFloat((subtotal - fee).toFixed(2));

  return {
    effectivePrice,
    subtotal,
    fee,
    total,
    breakdown: {
      basePrice,
      spreadCost: parseFloat(spreadCost.toFixed(2)),
      slippageCost: parseFloat(slippageCost.toFixed(2)),
    },
  };
};

/**
 * Checks if a player can trade a specific stock
 *
 * @param params - Parameters for the check
 * @returns true if the player can trade, false otherwise
 */
export const canPlayerTrade = (params: {
  tradeType: 'buy' | 'sell';
  symbol: string;
  stockPrice: number;
  cash: number;
  sharesOwned: number;
  tradedSymbolsThisCycle: string[];
  /** Reserved cash for pending buy orders */
  reservedCash?: number;
  /** Reserved shares of this symbol for pending sell orders */
  reservedShares?: number;
}): boolean => {
  const {
    tradeType,
    symbol,
    stockPrice,
    cash,
    sharesOwned,
    tradedSymbolsThisCycle,
    reservedCash = 0,
    reservedShares = 0,
  } = params;

  // Already traded in this cycle?
  if (tradedSymbolsThisCycle.includes(symbol)) {
    return false;
  }

  if (tradeType === 'buy') {
    // Available cash = Total cash - Reserved cash for pending orders
    const availableCash = cash - reservedCash;
    // Can buy at least 1 share?
    return availableCash >= stockPrice;
  } else {
    // Available shares = Owned - Reserved shares for pending sell orders
    const availableShares = sharesOwned - reservedShares;
    // Has at least 1 share to sell?
    return availableShares > 0;
  }
};

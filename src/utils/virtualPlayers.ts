import type { Stock, VirtualPlayer, BuyDecisionFactors, SellDecisionFactors, PortfolioItem } from '../types';
import { CONFIG } from '../config';
import { INITIAL_STOCKS } from './stockData';

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
  playerInitialCash: number = CONFIG.initialCash
): VirtualPlayer[] => {
  const players: VirtualPlayer[] = [];

  for (let i = 0; i < count; i++) {
    const startingCash = generateStartingCash(playerInitialCash);
    const riskTolerance = generateRiskTolerance();
    const { holdings, remainingCash } = generateInitialHoldings(startingCash, riskTolerance);

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
      },
    });
  }

  return players;
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
 */
const makeTradeDecision = (player: VirtualPlayer, stocks: Stock[]): TradeDecision | null => {
  const { riskTolerance } = player.settings;
  const normalizedRisk = riskTolerance / 100;

  // === STEP 1: Decide whether to trade at all ===
  // Risk-seeking trade more often (75%), risk-averse trade less often (35%)
  const tradeChance = 0.55 + normalizedRisk * 0.20; // 35% to 75%
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
    return makeBuyDecision(player, stocks);
  } else {
    return makeSellDecision(player, stocks);
  }
};

/**
 * Selects a stock to buy and determines the quantity.
 */
const makeBuyDecision = (player: VirtualPlayer, stocks: Stock[]): TradeDecision | null => {
  const { riskTolerance } = player.settings;

  // Only consider affordable stocks
  const affordableStocks = stocks.filter(s => s.currentPrice <= player.portfolio.cash);
  if (affordableStocks.length === 0) return null;

  // Evaluate each stock and store factors
  const scoredStocks = affordableStocks.map(stock => {
    const volatility = calculateVolatility(stock.priceHistory);
    const trend = calculateTrend(stock.priceHistory);
    const score = scoreStockForPlayer(stock, riskTolerance);
    return {
      stock,
      score,
      volatility,
      trend,
    };
  });

  // Sort by score (best first)
  scoredStocks.sort((a, b) => b.score - a.score);

  // Weighted random selection: better scores have higher chance
  // Top 3 stocks to choose from (or fewer if not enough available)
  const topStocks = scoredStocks.slice(0, 3);
  const totalScore = topStocks.reduce((sum, s) => sum + Math.max(0, s.score), 0);

  let selectedEntry = topStocks[0];
  if (totalScore <= 0) {
    // All scores negative: random selection
    selectedEntry = topStocks[Math.floor(Math.random() * topStocks.length)];
  } else {
    // Weighted selection
    let random = Math.random() * totalScore;
    for (const entry of topStocks) {
      random -= Math.max(0, entry.score);
      if (random <= 0) {
        selectedEntry = entry;
        break;
      }
    }
  }

  // Calculate position size
  const maxShares = Math.floor(player.portfolio.cash / selectedEntry.stock.currentPrice);
  const shares = calculatePositionSize(maxShares, riskTolerance);

  // Decision factors for the transaction
  const decisionFactors: BuyDecisionFactors = {
    kind: 'buy',
    volatility: selectedEntry.volatility,
    trend: selectedEntry.trend,
    score: selectedEntry.score,
    riskTolerance,
  };

  return {
    playerId: player.id,
    symbol: selectedEntry.stock.symbol,
    type: 'buy',
    shares: Math.min(shares, maxShares), // Ensure we don't buy too much
    decisionFactors,
  };
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

    const baseImpact = 0.001 + Math.random() * 0.004;
    const volumeMultiplier = Math.min(shares, 50);
    const priceChange = s.currentPrice * baseImpact * volumeMultiplier * impactFactor;
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

  // Sort by score (best first)
  scoredStocks.sort((a, b) => b.score - a.score);

  // Weighted random selection: better scores have higher chance
  const topStocks = scoredStocks.slice(0, 3);
  const totalScore = topStocks.reduce((sum, s) => sum + Math.max(0, s.score), 0);

  let selectedEntry = topStocks[0];
  if (totalScore <= 0) {
    selectedEntry = topStocks[Math.floor(Math.random() * topStocks.length)];
  } else {
    let random = Math.random() * totalScore;
    for (const entry of topStocks) {
      random -= Math.max(0, entry.score);
      if (random <= 0) {
        selectedEntry = entry;
        break;
      }
    }
  }

  // Calculate position size
  const maxShares = Math.floor(player.portfolio.cash / selectedEntry.stock.currentPrice);
  const shares = calculatePositionSize(maxShares, riskTolerance);

  const decisionFactors: BuyDecisionFactors = {
    kind: 'buy',
    volatility: selectedEntry.volatility,
    trend: selectedEntry.trend,
    score: selectedEntry.score,
    riskTolerance,
  };

  return {
    playerId: player.id,
    symbol: selectedEntry.stock.symbol,
    type: 'buy',
    shares: Math.min(shares, maxShares),
    decisionFactors,
  };
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
): { updatedPlayers: VirtualPlayer[]; updatedStocks: Stock[]; traded: boolean } => {
  const stock = stocks.find(s => s.symbol === symbol);
  if (!stock) return { updatedPlayers: players, updatedStocks: stocks, traded: false };

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

    return { updatedPlayers, updatedStocks, traded: true };
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

    return { updatedPlayers, updatedStocks, traded: true };
  }

  return { updatedPlayers: players, updatedStocks: stocks, traded: false };
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
} => {
  let currentStocks = [...stocks];
  let tradesExecuted = 0;
  const tradeCounts = { ...warmupConfig.tradeCounts };

  const updatedPlayers = players.map(player => {
    const decision = makeTradeDecisionWithWarmup(player, currentStocks, warmupConfig);
    if (!decision) return player;

    const stock = currentStocks.find(s => s.symbol === decision.symbol);
    if (!stock) return player;

    const totalValue = decision.shares * stock.currentPrice;

    const newTransaction = {
      id: `${player.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      symbol: decision.symbol,
      type: decision.type,
      shares: decision.shares,
      price: stock.currentPrice,
      timestamp: Date.now(),
      decisionFactors: decision.decisionFactors,
    };

    const updatedTransactions = [newTransaction, ...player.transactions].slice(0, MAX_TRANSACTIONS_PER_PLAYER);

    if (decision.type === 'buy') {
      if (totalValue > player.portfolio.cash) return player;

      tradesExecuted++;
      tradeCounts[decision.symbol] = (tradeCounts[decision.symbol] ?? 0) + 1;
      currentStocks = applyMarketImpact(currentStocks, decision.symbol, decision.shares, true);

      const existingHolding = player.portfolio.holdings.find(h => h.symbol === decision.symbol);

      if (existingHolding) {
        const newTotalShares = existingHolding.shares + decision.shares;
        const newAvgPrice = (existingHolding.shares * existingHolding.avgBuyPrice + totalValue) / newTotalShares;

        return {
          ...player,
          portfolio: {
            cash: player.portfolio.cash - totalValue,
            holdings: player.portfolio.holdings.map(h =>
              h.symbol === decision.symbol ? { ...h, shares: newTotalShares, avgBuyPrice: newAvgPrice } : h
            ),
          },
          transactions: updatedTransactions,
        };
      } else {
        return {
          ...player,
          portfolio: {
            cash: player.portfolio.cash - totalValue,
            holdings: [
              ...player.portfolio.holdings,
              { symbol: decision.symbol, shares: decision.shares, avgBuyPrice: stock.currentPrice },
            ],
          },
          transactions: updatedTransactions,
        };
      }
    } else {
      const holding = player.portfolio.holdings.find(h => h.symbol === decision.symbol);
      if (!holding || holding.shares < decision.shares) return player;

      tradesExecuted++;
      tradeCounts[decision.symbol] = (tradeCounts[decision.symbol] ?? 0) + 1;
      currentStocks = applyMarketImpact(currentStocks, decision.symbol, decision.shares, false);

      const newShares = holding.shares - decision.shares;

      if (newShares === 0) {
        return {
          ...player,
          portfolio: {
            cash: player.portfolio.cash + totalValue,
            holdings: player.portfolio.holdings.filter(h => h.symbol !== decision.symbol),
          },
          transactions: updatedTransactions,
        };
      } else {
        return {
          ...player,
          portfolio: {
            cash: player.portfolio.cash + totalValue,
            holdings: player.portfolio.holdings.map(h =>
              h.symbol === decision.symbol ? { ...h, shares: newShares } : h
            ),
          },
          transactions: updatedTransactions,
        };
      }
    }
  });

  return {
    updatedPlayers,
    updatedStocks: currentStocks,
    tradesExecuted,
    updatedTradeCounts: tradeCounts,
  };
};

/**
 * Forces trades for all stocks that were never traded during warmup.
 */
export const forceTradesForUntradedStocks = (
  players: VirtualPlayer[],
  stocks: Stock[],
  tradeCounts: Record<string, number>
): { updatedPlayers: VirtualPlayer[]; updatedStocks: Stock[]; forcedSymbols: string[] } => {
  let currentPlayers = [...players];
  let currentStocks = [...stocks];
  const forcedSymbols: string[] = [];

  for (const stock of stocks) {
    const tradeCount = tradeCounts[stock.symbol] ?? 0;
    if (tradeCount === 0) {
      const result = forceTrade(stock.symbol, currentPlayers, currentStocks);
      if (result.traded) {
        currentPlayers = result.updatedPlayers;
        currentStocks = result.updatedStocks;
        forcedSymbols.push(stock.symbol);
      }
    }
  }

  return { updatedPlayers: currentPlayers, updatedStocks: currentStocks, forcedSymbols };
};

export const executeVirtualPlayerTrades = (
  players: VirtualPlayer[],
  stocks: Stock[]
): { updatedPlayers: VirtualPlayer[]; updatedStocks: Stock[]; tradesExecuted: number } => {
  let currentStocks = [...stocks];
  let tradesExecuted = 0;

  const updatedPlayers = players.map(player => {
    const decision = makeTradeDecision(player, currentStocks);
    if (!decision) return player;

    const stock = currentStocks.find(s => s.symbol === decision.symbol);
    if (!stock) return player;

    const totalValue = decision.shares * stock.currentPrice;

    // Create new transaction (with decision factors)
    const newTransaction = {
      id: `${player.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      symbol: decision.symbol,
      type: decision.type,
      shares: decision.shares,
      price: stock.currentPrice,
      timestamp: Date.now(),
      decisionFactors: decision.decisionFactors,
    };

    // Update transactions (max 10 per player)
    const updatedTransactions = [newTransaction, ...player.transactions].slice(0, MAX_TRANSACTIONS_PER_PLAYER);

    if (decision.type === 'buy') {
      if (totalValue > player.portfolio.cash) return player;

      tradesExecuted++;
      currentStocks = applyMarketImpact(currentStocks, decision.symbol, decision.shares, true);

      const existingHolding = player.portfolio.holdings.find(h => h.symbol === decision.symbol);

      if (existingHolding) {
        const newTotalShares = existingHolding.shares + decision.shares;
        const newAvgPrice =
          (existingHolding.shares * existingHolding.avgBuyPrice + totalValue) / newTotalShares;

        return {
          ...player,
          portfolio: {
            cash: player.portfolio.cash - totalValue,
            holdings: player.portfolio.holdings.map(h =>
              h.symbol === decision.symbol
                ? { ...h, shares: newTotalShares, avgBuyPrice: newAvgPrice }
                : h
            ),
          },
          transactions: updatedTransactions,
        };
      } else {
        return {
          ...player,
          portfolio: {
            cash: player.portfolio.cash - totalValue,
            holdings: [
              ...player.portfolio.holdings,
              { symbol: decision.symbol, shares: decision.shares, avgBuyPrice: stock.currentPrice },
            ],
          },
          transactions: updatedTransactions,
        };
      }
    } else {
      // Sell
      const holding = player.portfolio.holdings.find(h => h.symbol === decision.symbol);
      if (!holding || holding.shares < decision.shares) return player;

      tradesExecuted++;
      currentStocks = applyMarketImpact(currentStocks, decision.symbol, decision.shares, false);

      const newShares = holding.shares - decision.shares;

      if (newShares === 0) {
        return {
          ...player,
          portfolio: {
            cash: player.portfolio.cash + totalValue,
            holdings: player.portfolio.holdings.filter(h => h.symbol !== decision.symbol),
          },
          transactions: updatedTransactions,
        };
      } else {
        return {
          ...player,
          portfolio: {
            cash: player.portfolio.cash + totalValue,
            holdings: player.portfolio.holdings.map(h =>
              h.symbol === decision.symbol ? { ...h, shares: newShares } : h
            ),
          },
          transactions: updatedTransactions,
        };
      }
    }
  });

  return { updatedPlayers, updatedStocks: currentStocks, tradesExecuted };
};

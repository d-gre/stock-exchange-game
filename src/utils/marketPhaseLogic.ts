/**
 * Market Phase Logic
 *
 * Handles dynamic market phase transitions, crash mechanics,
 * and Fear & Greed Index calculations.
 */

import type { MarketPhase, Sector, Stock } from '../types';
import { MARKET_PHASE_CONFIG } from '../config';

// ============================================================================
// TYPES
// ============================================================================

export interface PhaseTransitionResult {
  newGlobalPhase: MarketPhase | null;
  newSectorPhases: Partial<Record<Sector, MarketPhase>>;
  crashTriggered: boolean;
  crashSector: Sector | null;
  crashImpact: number;
}

export interface MarketMetrics {
  /** Overall market momentum (-1 to +1) */
  globalMomentum: number;
  /** Sector-specific momentum */
  sectorMomentum: Record<Sector, number>;
  /** Whether each sector is overheated */
  sectorOverheated: Record<Sector, boolean>;
  /** Average price change across all stocks */
  avgPriceChange: number;
}

interface SectorIndexData {
  currentValue: number;
  averageValue: number;
  percentAboveAverage: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SECTORS: Sector[] = ['tech', 'finance', 'industrial', 'commodities'];

const STOCK_SECTORS: Record<string, Sector> = {
  AAPL: 'tech', GOOGL: 'tech', MSFT: 'tech', NVDA: 'tech',
  JPM: 'finance', GS: 'finance', V: 'finance', BAC: 'finance',
  CAT: 'industrial', BA: 'industrial', GE: 'industrial', HON: 'industrial',
  XOM: 'commodities', CVX: 'commodities', FCX: 'commodities', NEM: 'commodities',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate the sector index value from stocks
 */
const calculateSectorIndex = (stocks: Stock[], sector: Sector): SectorIndexData => {
  const sectorStocks = stocks.filter(s => STOCK_SECTORS[s.symbol] === sector);
  if (sectorStocks.length === 0) {
    return { currentValue: 100, averageValue: 100, percentAboveAverage: 0 };
  }

  // Get base prices from the first candle in history
  const getBasePrice = (stock: Stock): number => {
    if (stock.priceHistory.length > 0) {
      return stock.priceHistory[0].close;
    }
    return stock.currentPrice;
  };

  // Current value: sum of current prices weighted by market cap
  const totalMarketCap = sectorStocks.reduce((sum, s) => sum + s.marketCapBillions, 0);
  const currentValue = sectorStocks.reduce((sum, s) => {
    const weight = s.marketCapBillions / totalMarketCap;
    const basePrice = getBasePrice(s);
    return sum + (s.currentPrice / basePrice) * 100 * weight;
  }, 0);

  // Average value: average of last 50 candles (or available history)
  const historyLength = Math.min(50, Math.min(...sectorStocks.map(s => s.priceHistory.length)));
  if (historyLength < 2) {
    return { currentValue, averageValue: currentValue, percentAboveAverage: 0 };
  }

  let avgSum = 0;
  for (let i = 0; i < historyLength; i++) {
    const indexAtTime = sectorStocks.reduce((sum, s) => {
      const historyIndex = s.priceHistory.length - historyLength + i;
      if (historyIndex < 0) return sum;
      const weight = s.marketCapBillions / totalMarketCap;
      const priceAtTime = s.priceHistory[historyIndex].close;
      const basePrice = getBasePrice(s);
      return sum + (priceAtTime / basePrice) * 100 * weight;
    }, 0);
    avgSum += indexAtTime;
  }
  const averageValue = avgSum / historyLength;

  const percentAboveAverage = averageValue > 0 ? (currentValue - averageValue) / averageValue : 0;

  return { currentValue, averageValue, percentAboveAverage };
};

/**
 * Calculate global market momentum based on recent price changes
 */
const calculateGlobalMomentum = (stocks: Stock[]): number => {
  if (stocks.length === 0) return 0;

  let totalChange = 0;
  let validStocks = 0;

  for (const stock of stocks) {
    if (stock.priceHistory.length >= 5) {
      const recent = stock.priceHistory.slice(-5);
      const change = (recent[recent.length - 1].close - recent[0].close) / recent[0].close;
      totalChange += change;
      validStocks++;
    }
  }

  if (validStocks === 0) return 0;

  // Normalize to -1 to +1 range (assuming ±10% is extreme)
  const avgChange = totalChange / validStocks;
  return Math.max(-1, Math.min(1, avgChange * 10));
};

/**
 * Calculate sector-specific momentum
 */
const calculateSectorMomentum = (stocks: Stock[]): Record<Sector, number> => {
  const result: Record<Sector, number> = {
    tech: 0,
    finance: 0,
    industrial: 0,
    commodities: 0,
  };

  for (const sector of SECTORS) {
    const sectorStocks = stocks.filter(s => STOCK_SECTORS[s.symbol] === sector);
    if (sectorStocks.length === 0) continue;

    let totalChange = 0;
    let validStocks = 0;

    for (const stock of sectorStocks) {
      if (stock.priceHistory.length >= 5) {
        const recent = stock.priceHistory.slice(-5);
        const change = (recent[recent.length - 1].close - recent[0].close) / recent[0].close;
        totalChange += change;
        validStocks++;
      }
    }

    if (validStocks > 0) {
      result[sector] = Math.max(-1, Math.min(1, (totalChange / validStocks) * 10));
    }
  }

  return result;
};

// ============================================================================
// MARKET METRICS
// ============================================================================

/**
 * Calculate comprehensive market metrics for phase transition decisions
 */
export const calculateMarketMetrics = (stocks: Stock[]): MarketMetrics => {
  const globalMomentum = calculateGlobalMomentum(stocks);
  const sectorMomentum = calculateSectorMomentum(stocks);

  // Check for overheated sectors
  const sectorOverheated: Record<Sector, boolean> = {
    tech: false,
    finance: false,
    industrial: false,
    commodities: false,
  };

  for (const sector of SECTORS) {
    const indexData = calculateSectorIndex(stocks, sector);
    sectorOverheated[sector] = indexData.percentAboveAverage >= MARKET_PHASE_CONFIG.crashMechanic.overheatThreshold;
  }

  // Average price change
  let totalChange = 0;
  let count = 0;
  for (const stock of stocks) {
    if (stock.priceHistory.length >= 2) {
      const prev = stock.priceHistory[stock.priceHistory.length - 2].close;
      const curr = stock.currentPrice;
      totalChange += (curr - prev) / prev;
      count++;
    }
  }
  const avgPriceChange = count > 0 ? totalChange / count : 0;

  return {
    globalMomentum,
    sectorMomentum,
    sectorOverheated,
    avgPriceChange,
  };
};

// ============================================================================
// PHASE TRANSITIONS
// ============================================================================

/**
 * Determine valid transitions from current phase
 */
const getValidTransitions = (currentPhase: MarketPhase): MarketPhase[] => {
  switch (currentPhase) {
    case 'prosperity':
      return ['boom', 'consolidation'];
    case 'boom':
      return ['consolidation']; // Can only go to consolidation (or panic via crash)
    case 'consolidation':
      return ['prosperity']; // panic only via crash trigger!
    case 'panic':
      return ['recession'];
    case 'recession':
      return ['recovery']; // Goes to recovery first
    case 'recovery':
      return ['prosperity']; // NOT to boom directly!
    default:
      return [];
  }
};

/**
 * Check if conditions for a specific transition are met
 */
const checkTransitionConditions = (
  from: MarketPhase,
  to: MarketPhase,
  metrics: MarketMetrics,
  cyclesInPhase: number
): boolean => {
  const { phases } = MARKET_PHASE_CONFIG;
  const minDuration = phases[from].minDuration;

  // Must be in phase for minimum duration
  if (cyclesInPhase < minDuration) return false;

  switch (`${from}_to_${to}`) {
    case 'prosperity_to_boom':
      // Need strong positive momentum
      return metrics.globalMomentum > 0.3;

    case 'prosperity_to_consolidation':
      // Slight negative momentum
      return metrics.globalMomentum < -0.1;

    case 'boom_to_consolidation':
      // Any negative sign or duration exhaustion
      return metrics.globalMomentum < 0 || cyclesInPhase > phases.boom.maxDuration * 0.8;

    case 'consolidation_to_prosperity':
      // Stabilization: positive momentum
      return metrics.globalMomentum > 0.1;

    case 'panic_to_recession':
      // Automatic after minimum duration
      return cyclesInPhase >= minDuration;

    case 'recession_to_recovery':
      // Market starting to stabilize
      return metrics.globalMomentum > 0;

    case 'recovery_to_prosperity':
      // Need sustained positive momentum
      return metrics.globalMomentum > 0.15;

    default:
      return false;
  }
};

/**
 * Check for phase transition and return new phase if transition occurs
 */
export const checkPhaseTransition = (
  currentPhase: MarketPhase,
  cyclesInPhase: number,
  metrics: MarketMetrics
): MarketPhase | null => {
  const validTransitions = getValidTransitions(currentPhase);
  const { transitions } = MARKET_PHASE_CONFIG;

  for (const targetPhase of validTransitions) {
    // Check if conditions are met
    if (!checkTransitionConditions(currentPhase, targetPhase, metrics, cyclesInPhase)) {
      continue;
    }

    // Get transition probability
    const transitionKey = `${currentPhase}To${targetPhase.charAt(0).toUpperCase() + targetPhase.slice(1)}` as keyof typeof transitions;
    const probability = transitions[transitionKey] || 0.01;

    // Roll for transition
    if (Math.random() < probability) {
      return targetPhase;
    }
  }

  return null;
};

/**
 * Check for sector-specific phase transition
 */
export const checkSectorPhaseTransition = (
  _sector: Sector,
  currentPhase: MarketPhase,
  cyclesInPhase: number,
  sectorMomentum: number
): MarketPhase | null => {
  const validTransitions = getValidTransitions(currentPhase);
  const { transitions, phases } = MARKET_PHASE_CONFIG;
  const minDuration = phases[currentPhase].minDuration;

  if (cyclesInPhase < minDuration) return null;

  // Sector-specific logic based on momentum
  for (const targetPhase of validTransitions) {
    let shouldTransition = false;

    switch (`${currentPhase}_to_${targetPhase}`) {
      case 'prosperity_to_boom':
        shouldTransition = sectorMomentum > 0.35;
        break;
      case 'prosperity_to_consolidation':
        shouldTransition = sectorMomentum < -0.15;
        break;
      case 'boom_to_consolidation':
        shouldTransition = sectorMomentum < -0.05 || cyclesInPhase > phases.boom.maxDuration;
        break;
      case 'consolidation_to_prosperity':
        shouldTransition = sectorMomentum > 0.1;
        break;
      case 'panic_to_recession':
        shouldTransition = cyclesInPhase >= minDuration;
        break;
      case 'recession_to_recovery':
        shouldTransition = sectorMomentum > 0.05;
        break;
      case 'recovery_to_prosperity':
        shouldTransition = sectorMomentum > 0.2;
        break;
    }

    if (shouldTransition) {
      const transitionKey = `${currentPhase}To${targetPhase.charAt(0).toUpperCase() + targetPhase.slice(1)}` as keyof typeof transitions;
      const probability = transitions[transitionKey] || 0.01;

      if (Math.random() < probability * 1.5) { // Slightly higher chance for sectors
        return targetPhase;
      }
    }
  }

  return null;
};

// ============================================================================
// CRASH MECHANICS
// ============================================================================

/**
 * Check if a crash should be triggered for a sector
 */
export const checkCrashTrigger = (
  sector: Sector,
  overheatCycles: number,
  stocks: Stock[]
): { shouldCrash: boolean; crashImpact: number } => {
  const { crashMechanic } = MARKET_PHASE_CONFIG;

  // Check if sector is currently overheated
  const indexData = calculateSectorIndex(stocks, sector);
  const isOverheated = indexData.percentAboveAverage >= crashMechanic.overheatThreshold;

  if (!isOverheated) {
    return { shouldCrash: false, crashImpact: 0 };
  }

  // Calculate crash probability
  const crashProbability = crashMechanic.baseCrashProbability +
    (overheatCycles * crashMechanic.crashProbabilityPerCycle);

  // Roll for crash
  if (Math.random() < crashProbability) {
    // Calculate crash impact (random between min and max)
    const impactRange = crashMechanic.crashImpactMax - crashMechanic.crashImpactMin;
    const crashImpact = crashMechanic.crashImpactMin + Math.random() * impactRange;

    return { shouldCrash: true, crashImpact };
  }

  return { shouldCrash: false, crashImpact: 0 };
};

/**
 * Apply crash impact to stocks in a sector
 * Returns the price drops to apply
 */
export const calculateCrashPriceDrops = (
  stocks: Stock[],
  sector: Sector,
  crashImpact: number
): Record<string, number> => {
  const drops: Record<string, number> = {};

  for (const stock of stocks) {
    if (STOCK_SECTORS[stock.symbol] === sector) {
      // Add some randomness to individual stock drops
      const individualVariation = 0.8 + Math.random() * 0.4; // 80-120% of base impact
      const drop = crashImpact * individualVariation;
      drops[stock.symbol] = drop;
    }
  }

  return drops;
};

// ============================================================================
// FEAR & GREED INDEX
// ============================================================================

/**
 * Calculate the Fear & Greed Index based on market conditions
 *
 * Components:
 * - Global momentum (40% weight)
 * - Current phase (30% weight)
 * - Volatility (20% weight)
 * - Recent price changes (10% weight)
 */
export const calculateFearGreedIndex = (
  globalPhase: MarketPhase,
  metrics: MarketMetrics,
  stocks: Stock[]
): number => {
  // Phase base score
  const phaseScores: Record<MarketPhase, number> = {
    prosperity: 55,
    boom: 75,
    consolidation: 38,
    panic: 15,
    recession: 28,
    recovery: 45,
  };
  const phaseScore = phaseScores[globalPhase];

  // Momentum component (-25 to +25)
  const momentumScore = metrics.globalMomentum * 25;

  // Volatility component (high volatility = more fear)
  let avgVolatility = 0;
  let volatilityCount = 0;
  for (const stock of stocks) {
    if (stock.priceHistory.length >= 10) {
      const recent = stock.priceHistory.slice(-10);
      const changes = [];
      for (let i = 1; i < recent.length; i++) {
        changes.push(Math.abs((recent[i].close - recent[i - 1].close) / recent[i - 1].close));
      }
      avgVolatility += changes.reduce((a, b) => a + b, 0) / changes.length;
      volatilityCount++;
    }
  }
  // High volatility (>5%) = fear (-10), low volatility (<1%) = greed (+10)
  const normalizedVolatility = volatilityCount > 0 ? avgVolatility / volatilityCount : 0.02;
  const volatilityScore = 10 - (normalizedVolatility * 400); // Maps 0-5% to +10 to -10

  // Recent price change component
  const priceChangeScore = metrics.avgPriceChange * 100; // ±1% = ±1 point

  // Combine components
  let index = phaseScore + momentumScore + volatilityScore + priceChangeScore;

  // Clamp to 0-100
  return Math.max(0, Math.min(100, Math.round(index)));
};

// ============================================================================
// VOLATILITY MULTIPLIER
// ============================================================================

/**
 * Get the volatility multiplier for a stock based on global and sector phases
 */
export const getVolatilityMultiplier = (
  symbol: string,
  globalPhase: MarketPhase,
  sectorPhases: Record<Sector, MarketPhase>
): number => {
  const sector = STOCK_SECTORS[symbol];
  if (!sector) return 1.0;

  const globalMultiplier = MARKET_PHASE_CONFIG.phases[globalPhase].volatilityMultiplier;
  const sectorPhase = sectorPhases[sector];
  const sectorMultiplier = MARKET_PHASE_CONFIG.phases[sectorPhase].volatilityMultiplier;

  // Average of global and sector, with sector having slightly more weight
  return (globalMultiplier * 0.4 + sectorMultiplier * 0.6);
};

/**
 * Get the Market Maker spread modifier based on phases
 */
export const getMMSpreadModifier = (
  symbol: string,
  globalPhase: MarketPhase,
  sectorPhases: Record<Sector, MarketPhase>
): number => {
  const sector = STOCK_SECTORS[symbol];
  if (!sector) return 0;

  const globalMod = MARKET_PHASE_CONFIG.phases[globalPhase].mmSpreadModifier;
  const sectorPhase = sectorPhases[sector];
  const sectorMod = MARKET_PHASE_CONFIG.phases[sectorPhase].mmSpreadModifier;

  // Average of global and sector modifiers
  return (globalMod + sectorMod) / 2;
};

// ============================================================================
// GLOBAL PHASE FROM SECTOR PHASES
// ============================================================================

/**
 * Numeric scores for phases (higher = more positive/optimistic)
 * Used to calculate average sentiment across sectors
 */
const PHASE_SCORES: Record<MarketPhase, number> = {
  boom: 5,
  prosperity: 4,
  recovery: 3,
  consolidation: 2,
  recession: 1,
  panic: 0,
};

/**
 * Reverse mapping: score to phase
 * Phases are ordered from most positive to most negative
 */
const SCORE_TO_PHASE: MarketPhase[] = ['panic', 'recession', 'consolidation', 'recovery', 'prosperity', 'boom'];

/**
 * Calculates the global market phase as an average of sector phases.
 * The global phase no longer directly influences sectors - it's purely derived.
 *
 * @param sectorPhases - Current phase for each sector
 * @returns The calculated global phase based on sector average
 */
export const calculateGlobalPhaseFromSectors = (
  sectorPhases: Record<Sector, MarketPhase>
): MarketPhase => {
  // Calculate average score
  let totalScore = 0;
  let count = 0;

  for (const sector of SECTORS) {
    const phase = sectorPhases[sector];
    totalScore += PHASE_SCORES[phase];
    count++;
  }

  if (count === 0) return 'prosperity'; // Fallback

  const avgScore = totalScore / count;

  // Round to nearest phase
  const roundedScore = Math.round(avgScore);
  const clampedScore = Math.max(0, Math.min(5, roundedScore));

  return SCORE_TO_PHASE[clampedScore];
};

// ============================================================================
// VP BEHAVIOR MODIFICATION
// ============================================================================

/**
 * Get trade chance modifier based on market phase and risk tolerance
 *
 * From the spec:
 * - Aggressive (+34 to +100): Ignores phases completely
 * - Moderate (-33 to +33): Adjusts to phase
 *   - Downturn: more cautious (tradeChance -20%)
 *   - Upturn: quicker to take risks (tradeChance +10%)
 * - Conservative (-100 to -33): Becomes even more cautious
 *   - Downturn: tradeChance -40%, only stable stocks
 *   - Panic: stops almost all trades
 */
export const getVPTradeChanceModifier = (
  riskTolerance: number,
  globalPhase: MarketPhase
): number => {
  // Aggressive players ignore phases
  if (riskTolerance >= 34) {
    return 0;
  }

  const isDownturn = globalPhase === 'consolidation' || globalPhase === 'panic' || globalPhase === 'recession';
  const isUpturn = globalPhase === 'prosperity' || globalPhase === 'boom';
  const isRecovering = globalPhase === 'recovery';

  // Conservative players
  if (riskTolerance <= -34) {
    if (globalPhase === 'panic') {
      return -0.6; // Almost stops trading
    }
    if (isDownturn) {
      return -0.4;
    }
    if (isRecovering) {
      return -0.1; // Still cautious during recovery
    }
    if (isUpturn) {
      return 0.05; // Slight increase in good times
    }
    return 0;
  }

  // Moderate players
  if (isDownturn) {
    return -0.2;
  }
  if (isRecovering) {
    return 0; // Neutral during recovery
  }
  if (isUpturn) {
    return 0.1;
  }

  return 0;
};

/**
 * Check if a VP should prefer stable stocks (low volatility) in current phase
 */
export const shouldVPPreferStableStocks = (
  riskTolerance: number,
  globalPhase: MarketPhase
): boolean => {
  // Only conservative players in downturns prefer stable stocks
  if (riskTolerance > -34) return false;

  return globalPhase === 'consolidation' || globalPhase === 'panic' || globalPhase === 'recession';
};

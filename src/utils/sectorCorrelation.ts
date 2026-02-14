import type { Sector, Stock } from '../types';
import { MARKET_PHASE_CONFIG } from '../config';

/**
 * Sector momentum state for correlation calculations.
 */
export interface SectorMomentum {
  /** Current momentum value (-1 to +1) */
  momentum: number;
  /** Performance in last cycle (for momentum calculation) */
  lastPerformance: number;
}

/**
 * Sector momentum state map.
 */
export type SectorMomentumState = Record<Sector, SectorMomentum>;

/**
 * Inter-sector correlation matrix.
 * Defines how one sector's performance affects another.
 * Values: -1 (inverse) to +1 (direct correlation)
 */
export const INTER_SECTOR_CORRELATIONS: Record<Sector, Partial<Record<Sector, number>>> = {
  tech: {
    finance: 0.3,      // Tech success drives investment activity
    industrial: 0.1,   // Slight positive (automation, tech in industry)
    commodities: 0.0,  // Neutral
  },
  finance: {
    tech: 0.4,         // Credit availability helps tech growth
    industrial: 0.4,   // Loans for industrial expansion
    commodities: 0.2,  // Commodity trading profits
  },
  industrial: {
    tech: 0.1,         // Industrial demand for tech
    finance: 0.2,      // Industrial loans/bonds
    commodities: 0.5,  // High demand for raw materials
  },
  commodities: {
    tech: -0.1,        // High commodity prices hurt tech margins slightly
    finance: 0.1,      // Commodity trading
    industrial: -0.4,  // HIGH commodity prices hurt industrial margins!
  },
};

/**
 * Configuration for sector correlation behavior.
 */
export const SECTOR_CONFIG = {
  /** How much sector momentum affects individual stock prices (0-1) */
  sectorInfluenceStrength: 0.6,
  /** How quickly momentum decays per cycle (0-1, lower = slower decay) */
  momentumDecay: 0.85,
  /** How much new performance contributes to momentum (0-1) */
  momentumUpdateRate: 0.15,
  /** Threshold for "strong" performance that triggers inter-sector effects */
  strongPerformanceThreshold: 0.02,
  /** Maximum sector influence on price (caps extreme moves) */
  maxSectorInfluence: 0.03,
};

/**
 * Creates initial sector momentum state (neutral).
 */
export const createInitialSectorMomentum = (): SectorMomentumState => ({
  tech: { momentum: 0, lastPerformance: 0 },
  finance: { momentum: 0, lastPerformance: 0 },
  industrial: { momentum: 0, lastPerformance: 0 },
  commodities: { momentum: 0, lastPerformance: 0 },
});

/**
 * Calculates the average performance of stocks in a sector.
 * @returns Performance as decimal (e.g., 0.02 = 2% up)
 */
export const calculateSectorPerformance = (stocks: Stock[], sector: Sector): number => {
  const sectorStocks = stocks.filter(s => s.sector === sector);
  if (sectorStocks.length === 0) return 0;

  const totalPerformance = sectorStocks.reduce((sum, stock) => {
    return sum + (stock.changePercent / 100);
  }, 0);

  return totalPerformance / sectorStocks.length;
};

/**
 * Updates sector momentum based on current stock performance.
 */
export const updateSectorMomentum = (
  currentMomentum: SectorMomentumState,
  stocks: Stock[]
): SectorMomentumState => {
  const sectors: Sector[] = ['tech', 'finance', 'industrial', 'commodities'];
  const newMomentum: SectorMomentumState = { ...currentMomentum };

  // Step 1: Calculate raw performance for each sector
  const performances: Record<Sector, number> = {} as Record<Sector, number>;
  for (const sector of sectors) {
    performances[sector] = calculateSectorPerformance(stocks, sector);
  }

  // Step 2: Apply inter-sector correlations
  // Use interaction multiplier from config to control correlation strength
  const interactionMultiplier = MARKET_PHASE_CONFIG.sectorInteraction.interactionMultiplier;
  const adjustedPerformances: Record<Sector, number> = { ...performances };

  for (const sourceSector of sectors) {
    const sourcePerf = performances[sourceSector];

    // Only apply inter-sector effects for significant moves
    if (Math.abs(sourcePerf) > SECTOR_CONFIG.strongPerformanceThreshold) {
      const correlations = INTER_SECTOR_CORRELATIONS[sourceSector];

      for (const [targetSector, correlation] of Object.entries(correlations)) {
        if (correlation && targetSector !== sourceSector) {
          // Scale the effect based on source performance strength and interaction multiplier
          const effect = sourcePerf * correlation * 0.5 * interactionMultiplier;
          adjustedPerformances[targetSector as Sector] += effect;
        }
      }
    }
  }

  // Step 3: Update momentum with decay and new performance
  for (const sector of sectors) {
    const current = currentMomentum[sector];
    const newPerf = adjustedPerformances[sector];

    // Momentum decays over time and is influenced by new performance
    const decayedMomentum = current.momentum * SECTOR_CONFIG.momentumDecay;
    const performanceContribution = newPerf * SECTOR_CONFIG.momentumUpdateRate;

    // Clamp momentum to [-1, 1]
    const newMomentumValue = Math.max(-1, Math.min(1,
      decayedMomentum + performanceContribution
    ));

    newMomentum[sector] = {
      momentum: newMomentumValue,
      lastPerformance: newPerf,
    };
  }

  return newMomentum;
};

/**
 * Calculates the sector influence for a stock's price movement.
 * @returns Influence factor (-maxInfluence to +maxInfluence)
 */
export const getSectorInfluence = (
  sector: Sector,
  sectorMomentum: SectorMomentumState
): number => {
  const momentum = sectorMomentum[sector].momentum;

  // Apply influence strength and cap
  const influence = momentum * SECTOR_CONFIG.sectorInfluenceStrength;

  return Math.max(
    -SECTOR_CONFIG.maxSectorInfluence,
    Math.min(SECTOR_CONFIG.maxSectorInfluence, influence)
  );
};

/**
 * Gets all sector influences for price generation.
 */
export const getAllSectorInfluences = (
  sectorMomentum: SectorMomentumState
): Record<Sector, number> => {
  return {
    tech: getSectorInfluence('tech', sectorMomentum),
    finance: getSectorInfluence('finance', sectorMomentum),
    industrial: getSectorInfluence('industrial', sectorMomentum),
    commodities: getSectorInfluence('commodities', sectorMomentum),
  };
};

/**
 * Sector display information for UI.
 */
export const SECTOR_INFO: Record<Sector, { label: string; shortLabel: string; color: string }> = {
  tech: { label: 'Technology', shortLabel: 'T', color: '#3b82f6' },
  finance: { label: 'Finance', shortLabel: 'F', color: '#10b981' },
  industrial: { label: 'Industrial', shortLabel: 'I', color: '#f59e0b' },
  commodities: { label: 'Commodities', shortLabel: 'R', color: '#8b5cf6' },
};

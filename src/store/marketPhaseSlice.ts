import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { MarketPhase, Sector } from '../types';
import { calculateGlobalPhaseFromSectors } from '../utils/marketPhaseLogic';

/**
 * State for tracking overheat cycles per sector
 */
type SectorOverheatCycles = Record<Sector, number>;

/**
 * State for tracking phase per sector
 */
type SectorPhases = Record<Sector, MarketPhase>;

/**
 * Tracking for average climate calculation at game end
 */
interface PhaseHistory {
  /** Total cycles tracked */
  totalCycles: number;
  /** Cycles spent in each global phase */
  cyclesPerPhase: Record<MarketPhase, number>;
}

/**
 * Single entry in climate history for chart display
 */
export interface ClimateHistoryEntry {
  /** Cycle number */
  cycle: number;
  /** Global market phase at this cycle */
  phase: MarketPhase;
  /** Fear & Greed index at this cycle (0-100) */
  fearGreedIndex: number;
}

interface MarketPhaseState {
  /** Current global market phase */
  globalPhase: MarketPhase;
  /** Current phase per sector (can differ from global) */
  sectorPhases: SectorPhases;
  /** Number of cycles in current global phase */
  cyclesInGlobalPhase: number;
  /** Number of cycles in current phase per sector */
  cyclesInSectorPhase: Record<Sector, number>;
  /** Fear & Greed Index (0-100, 50 = neutral) */
  fearGreedIndex: number;
  /** Number of consecutive overheat cycles per sector */
  overheatCycles: SectorOverheatCycles;
  /** Timestamp of last update */
  lastUpdate: number;
  /** History of phases for average calculation */
  phaseHistory: PhaseHistory;
  /** Time-series history for chart display (limited to last 100 entries) */
  climateHistory: ClimateHistoryEntry[];
}

const initialSectorPhases: SectorPhases = {
  tech: 'prosperity',
  finance: 'prosperity',
  industrial: 'prosperity',
  commodities: 'prosperity',
};

const initialCyclesInSectorPhase: Record<Sector, number> = {
  tech: 0,
  finance: 0,
  industrial: 0,
  commodities: 0,
};

const initialOverheatCycles: SectorOverheatCycles = {
  tech: 0,
  finance: 0,
  industrial: 0,
  commodities: 0,
};

const initialPhaseHistory: PhaseHistory = {
  totalCycles: 0,
  cyclesPerPhase: {
    prosperity: 0,
    boom: 0,
    consolidation: 0,
    panic: 0,
    recession: 0,
    recovery: 0,
  },
};

const initialState: MarketPhaseState = {
  globalPhase: 'prosperity',
  sectorPhases: initialSectorPhases,
  cyclesInGlobalPhase: 0,
  cyclesInSectorPhase: initialCyclesInSectorPhase,
  fearGreedIndex: 50,
  overheatCycles: initialOverheatCycles,
  lastUpdate: Date.now(),
  phaseHistory: initialPhaseHistory,
  climateHistory: [],
};

/**
 * All valid market phases
 */
const ALL_PHASES: MarketPhase[] = ['prosperity', 'boom', 'consolidation', 'panic', 'recession', 'recovery'];


/**
 * Fear & Greed index ranges per phase
 */
const FEAR_GREED_RANGES: Record<MarketPhase, { min: number; max: number }> = {
  prosperity: { min: 45, max: 60 },
  boom: { min: 65, max: 85 },
  consolidation: { min: 30, max: 45 },
  panic: { min: 5, max: 20 },
  recession: { min: 20, max: 35 },
  recovery: { min: 35, max: 50 },
};

/**
 * Weights for random sector phase selection at game start
 * Sectors are initialized independently, not based on global phase
 */
const SECTOR_PHASE_START_WEIGHTS: Record<MarketPhase, number> = {
  prosperity: 40,  // Most common - stable sector
  recovery: 20,    // Common - sector recovering
  consolidation: 15,  // Less common - sector cooling
  recession: 10,   // Less common - sector in downturn
  boom: 10,        // Less common - sector already in boom
  panic: 5,        // Rare - sector in crisis
};


/**
 * Generate a random Fear & Greed index appropriate for the given phase
 */
const generateFearGreedForPhase = (phase: MarketPhase): number => {
  const range = FEAR_GREED_RANGES[phase];
  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
};

/**
 * Select a random sector phase independently (not based on global phase)
 * Sectors evolve independently - global phase is calculated from sector average
 */
const selectRandomSectorPhase = (): MarketPhase => {
  const totalWeight = Object.values(SECTOR_PHASE_START_WEIGHTS).reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;

  for (const phase of ALL_PHASES) {
    random -= SECTOR_PHASE_START_WEIGHTS[phase];
    if (random <= 0) {
      return phase;
    }
  }
  return 'prosperity'; // Fallback
};

const marketPhaseSlice = createSlice({
  name: 'marketPhase',
  initialState,
  reducers: {
    /**
     * Sets the global market phase
     */
    setGlobalPhase: (state, action: PayloadAction<MarketPhase>) => {
      state.globalPhase = action.payload;
      state.cyclesInGlobalPhase = 0;
      state.lastUpdate = Date.now();
    },

    /**
     * Sets the phase for a specific sector
     */
    setSectorPhase: (state, action: PayloadAction<{ sector: Sector; phase: MarketPhase }>) => {
      const { sector, phase } = action.payload;
      state.sectorPhases[sector] = phase;
      state.cyclesInSectorPhase[sector] = 0;
      state.lastUpdate = Date.now();
    },

    /**
     * Increments cycle counters for all phases
     */
    incrementPhaseCycles: (state) => {
      state.cyclesInGlobalPhase += 1;
      for (const sector of Object.keys(state.cyclesInSectorPhase) as Sector[]) {
        state.cyclesInSectorPhase[sector] += 1;
      }
      state.lastUpdate = Date.now();
    },

    /**
     * Updates the Fear & Greed Index
     */
    setFearGreedIndex: (state, action: PayloadAction<number>) => {
      state.fearGreedIndex = Math.max(0, Math.min(100, action.payload));
      state.lastUpdate = Date.now();
    },

    /**
     * Updates overheat cycles for a sector
     */
    setOverheatCycles: (state, action: PayloadAction<{ sector: Sector; cycles: number }>) => {
      const { sector, cycles } = action.payload;
      state.overheatCycles[sector] = Math.max(0, cycles);
      state.lastUpdate = Date.now();
    },

    /**
     * Resets overheat cycles for a sector (e.g., after crash)
     */
    resetSectorOverheat: (state, action: PayloadAction<Sector>) => {
      state.overheatCycles[action.payload] = 0;
      state.lastUpdate = Date.now();
    },

    /**
     * Triggers a crash for a sector: sets to panic and resets overheat
     */
    triggerSectorCrash: (state, action: PayloadAction<Sector>) => {
      const sector = action.payload;
      state.sectorPhases[sector] = 'panic';
      state.cyclesInSectorPhase[sector] = 0;
      state.overheatCycles[sector] = 0;
      state.lastUpdate = Date.now();
    },

    /**
     * Triggers a global crash: sets global and all sectors to panic
     */
    triggerGlobalCrash: (state) => {
      state.globalPhase = 'panic';
      state.cyclesInGlobalPhase = 0;
      for (const sector of Object.keys(state.sectorPhases) as Sector[]) {
        state.sectorPhases[sector] = 'panic';
        state.cyclesInSectorPhase[sector] = 0;
        state.overheatCycles[sector] = 0;
      }
      state.fearGreedIndex = 10; // Extreme fear
      state.lastUpdate = Date.now();
    },

    /**
     * Resets market phase state to initial values
     */
    resetMarketPhase: () => {
      return { ...initialState, lastUpdate: Date.now(), phaseHistory: { ...initialPhaseHistory }, climateHistory: [] };
    },

    /**
     * Restores market phase state from saved game
     */
    restoreMarketPhase: (_state, action: PayloadAction<MarketPhaseState>) => {
      return action.payload;
    },

    /**
     * Initializes random phases at game start
     * Sector phases are initialized independently, global phase is calculated as their average
     */
    initializeRandomPhases: (state) => {
      // Initialize sector phases independently (not based on global phase)
      const sectors: Sector[] = ['tech', 'finance', 'industrial', 'commodities'];
      for (const sector of sectors) {
        state.sectorPhases[sector] = selectRandomSectorPhase();
        state.cyclesInSectorPhase[sector] = 0;
        state.overheatCycles[sector] = 0;
      }

      // Calculate global phase as average of sector phases
      state.globalPhase = calculateGlobalPhaseFromSectors(state.sectorPhases);
      state.cyclesInGlobalPhase = 0;

      // Fear & Greed index matching calculated global phase
      state.fearGreedIndex = generateFearGreedForPhase(state.globalPhase);

      // Reset phase history and climate history
      state.phaseHistory = { ...initialPhaseHistory };
      state.climateHistory = [];

      state.lastUpdate = Date.now();
    },

    /**
     * Records the current phase for history tracking (called each game cycle)
     */
    recordPhaseCycle: (state) => {
      state.phaseHistory.totalCycles += 1;
      state.phaseHistory.cyclesPerPhase[state.globalPhase] += 1;

      // Add to climate history for chart display
      state.climateHistory.push({
        cycle: state.phaseHistory.totalCycles,
        phase: state.globalPhase,
        fearGreedIndex: state.fearGreedIndex,
      });
    },
  },
});

export const {
  setGlobalPhase,
  setSectorPhase,
  incrementPhaseCycles,
  setFearGreedIndex,
  setOverheatCycles,
  resetSectorOverheat,
  triggerSectorCrash,
  triggerGlobalCrash,
  resetMarketPhase,
  restoreMarketPhase,
  initializeRandomPhases,
  recordPhaseCycle,
} = marketPhaseSlice.actions;

export default marketPhaseSlice.reducer;

// ============================================================================
// SELECTORS
// ============================================================================

type MarketPhaseRootState = { marketPhase: MarketPhaseState };

export const selectGlobalPhase = (state: MarketPhaseRootState) => state.marketPhase.globalPhase;

export const selectSectorPhases = (state: MarketPhaseRootState) => state.marketPhase.sectorPhases;

export const selectSectorPhase = (sector: Sector) => (state: MarketPhaseRootState) =>
  state.marketPhase.sectorPhases[sector];

export const selectFearGreedIndex = (state: MarketPhaseRootState) => state.marketPhase.fearGreedIndex;

export const selectCyclesInGlobalPhase = (state: MarketPhaseRootState) => state.marketPhase.cyclesInGlobalPhase;

export const selectCyclesInSectorPhase = (sector: Sector) => (state: MarketPhaseRootState) =>
  state.marketPhase.cyclesInSectorPhase[sector];

export const selectOverheatCycles = (state: MarketPhaseRootState) => state.marketPhase.overheatCycles;

export const selectSectorOverheatCycles = (sector: Sector) => (state: MarketPhaseRootState) =>
  state.marketPhase.overheatCycles[sector];

export const selectMarketPhaseState = (state: MarketPhaseRootState) => state.marketPhase;

export const selectPhaseHistory = (state: MarketPhaseRootState) => state.marketPhase.phaseHistory;

export const selectClimateHistory = (state: MarketPhaseRootState) => state.marketPhase.climateHistory;

/**
 * Calculate the dominant (most common) phase during the game
 */
export const selectDominantPhase = (state: MarketPhaseRootState): MarketPhase => {
  const { cyclesPerPhase } = state.marketPhase.phaseHistory;
  let maxCycles = 0;
  let dominantPhase: MarketPhase = 'prosperity';

  for (const phase of ALL_PHASES) {
    if (cyclesPerPhase[phase] > maxCycles) {
      maxCycles = cyclesPerPhase[phase];
      dominantPhase = phase;
    }
  }

  return dominantPhase;
};

/**
 * Calculate average climate score (0-100)
 * prosperity=70, boom=90, consolidation=45, panic=10, recession=25, recovery=50
 */
export const selectAverageClimateScore = (state: MarketPhaseRootState): number => {
  const { totalCycles, cyclesPerPhase } = state.marketPhase.phaseHistory;

  if (totalCycles === 0) return 50;

  const phaseScores: Record<MarketPhase, number> = {
    prosperity: 70,
    boom: 90,
    consolidation: 45,
    panic: 10,
    recession: 25,
    recovery: 50,
  };

  let weightedSum = 0;
  for (const phase of ALL_PHASES) {
    weightedSum += cyclesPerPhase[phase] * phaseScores[phase];
  }

  return Math.round(weightedSum / totalCycles);
};

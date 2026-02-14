import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Stock, Sector } from '../types';
import {
  createInitialSectorMomentum,
  updateSectorMomentum,
  getAllSectorInfluences,
  type SectorMomentumState,
} from '../utils/sectorCorrelation';

// Import RootState type - must be imported this way to avoid circular dependency
import type { store } from './index';
type RootState = ReturnType<typeof store.getState>;

interface SectorSliceState {
  /** Momentum state for all sectors */
  sectorMomentum: SectorMomentumState;
  /** Current sector influences for price generation (-maxInfluence to +maxInfluence) */
  sectorInfluences: Record<Sector, number>;
  /** Timestamp of last update */
  lastUpdate: number;
}

const initialState: SectorSliceState = {
  sectorMomentum: createInitialSectorMomentum(),
  sectorInfluences: {
    tech: 0,
    finance: 0,
    industrial: 0,
    commodities: 0,
  },
  lastUpdate: Date.now(),
};

const sectorSlice = createSlice({
  name: 'sector',
  initialState,
  reducers: {
    /**
     * Updates sector momentum based on current stock performance.
     * Should be called BEFORE generating new prices so influences are ready.
     */
    updateSectorState: (state, action: PayloadAction<Stock[]>) => {
      const stocks = action.payload;

      // Update momentum based on current stock performance
      state.sectorMomentum = updateSectorMomentum(state.sectorMomentum, stocks);

      // Calculate new influences for next price generation
      state.sectorInfluences = getAllSectorInfluences(state.sectorMomentum);

      state.lastUpdate = Date.now();
    },

    /**
     * Resets sector state to initial values.
     * Called when game is reset.
     */
    resetSectorState: (state) => {
      state.sectorMomentum = createInitialSectorMomentum();
      state.sectorInfluences = {
        tech: 0,
        finance: 0,
        industrial: 0,
        commodities: 0,
      };
      state.lastUpdate = Date.now();
    },

    /**
     * Restore sector state from saved game
     */
    restoreSector: (_state, action: PayloadAction<SectorSliceState>) => {
      return action.payload;
    },
  },
});

export const { updateSectorState, resetSectorState, restoreSector } = sectorSlice.actions;
export default sectorSlice.reducer;

// Selectors
export const selectSectorInfluences = (state: RootState) =>
  state.sector.sectorInfluences;

export const selectSectorMomentum = (state: RootState) =>
  state.sector.sectorMomentum;

export const selectSectorInfluence = (sector: Sector) =>
  (state: RootState) =>
    state.sector.sectorInfluences[sector];

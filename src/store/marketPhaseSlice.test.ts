import { describe, it, expect } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import marketPhaseReducer, {
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
  recordPhaseCycle,
  selectGlobalPhase,
  selectSectorPhases,
  selectSectorPhase,
  selectFearGreedIndex,
  selectCyclesInGlobalPhase,
  selectCyclesInSectorPhase,
  selectOverheatCycles,
  selectSectorOverheatCycles,
  selectMarketPhaseState,
  selectClimateHistory,
} from './marketPhaseSlice';

const createTestStore = () =>
  configureStore({
    reducer: { marketPhase: marketPhaseReducer },
  });

describe('marketPhaseSlice', () => {
  describe('initial state', () => {
    it('should have correct initial values', () => {
      const store = createTestStore();
      const state = store.getState().marketPhase;

      expect(state.globalPhase).toBe('prosperity');
      expect(state.fearGreedIndex).toBe(50);
      expect(state.cyclesInGlobalPhase).toBe(0);
      expect(state.sectorPhases.tech).toBe('prosperity');
      expect(state.sectorPhases.finance).toBe('prosperity');
      expect(state.sectorPhases.industrial).toBe('prosperity');
      expect(state.sectorPhases.commodities).toBe('prosperity');
    });

    it('should have zero overheat cycles initially', () => {
      const store = createTestStore();
      const state = store.getState().marketPhase;

      expect(state.overheatCycles.tech).toBe(0);
      expect(state.overheatCycles.finance).toBe(0);
      expect(state.overheatCycles.industrial).toBe(0);
      expect(state.overheatCycles.commodities).toBe(0);
    });
  });

  describe('setGlobalPhase', () => {
    it('should set the global phase', () => {
      const store = createTestStore();
      store.dispatch(setGlobalPhase('boom'));

      const state = store.getState().marketPhase;
      expect(state.globalPhase).toBe('boom');
    });

    it('should reset cycles when phase changes', () => {
      const store = createTestStore();
      store.dispatch(incrementPhaseCycles());
      store.dispatch(incrementPhaseCycles());
      expect(store.getState().marketPhase.cyclesInGlobalPhase).toBe(2);

      store.dispatch(setGlobalPhase('recession'));

      expect(store.getState().marketPhase.cyclesInGlobalPhase).toBe(0);
    });

    it('should update lastUpdate timestamp', () => {
      const store = createTestStore();
      const before = store.getState().marketPhase.lastUpdate;

      store.dispatch(setGlobalPhase('consolidation'));

      const after = store.getState().marketPhase.lastUpdate;
      expect(after).toBeGreaterThanOrEqual(before);
    });
  });

  describe('setSectorPhase', () => {
    it('should set phase for specific sector', () => {
      const store = createTestStore();
      store.dispatch(setSectorPhase({ sector: 'tech', phase: 'boom' }));

      const state = store.getState().marketPhase;
      expect(state.sectorPhases.tech).toBe('boom');
      expect(state.sectorPhases.finance).toBe('prosperity'); // unchanged
    });

    it('should reset sector cycles when phase changes', () => {
      const store = createTestStore();
      store.dispatch(incrementPhaseCycles());
      store.dispatch(incrementPhaseCycles());

      store.dispatch(setSectorPhase({ sector: 'finance', phase: 'consolidation' }));

      const state = store.getState().marketPhase;
      expect(state.cyclesInSectorPhase.finance).toBe(0);
      expect(state.cyclesInSectorPhase.tech).toBe(2); // unchanged
    });
  });

  describe('incrementPhaseCycles', () => {
    it('should increment global phase cycles', () => {
      const store = createTestStore();
      store.dispatch(incrementPhaseCycles());

      expect(store.getState().marketPhase.cyclesInGlobalPhase).toBe(1);
    });

    it('should increment all sector phase cycles', () => {
      const store = createTestStore();
      store.dispatch(incrementPhaseCycles());
      store.dispatch(incrementPhaseCycles());

      const state = store.getState().marketPhase;
      expect(state.cyclesInSectorPhase.tech).toBe(2);
      expect(state.cyclesInSectorPhase.finance).toBe(2);
      expect(state.cyclesInSectorPhase.industrial).toBe(2);
      expect(state.cyclesInSectorPhase.commodities).toBe(2);
    });
  });

  describe('setFearGreedIndex', () => {
    it('should set the fear/greed index', () => {
      const store = createTestStore();
      store.dispatch(setFearGreedIndex(75));

      expect(store.getState().marketPhase.fearGreedIndex).toBe(75);
    });

    it('should clamp value to minimum 0', () => {
      const store = createTestStore();
      store.dispatch(setFearGreedIndex(-20));

      expect(store.getState().marketPhase.fearGreedIndex).toBe(0);
    });

    it('should clamp value to maximum 100', () => {
      const store = createTestStore();
      store.dispatch(setFearGreedIndex(150));

      expect(store.getState().marketPhase.fearGreedIndex).toBe(100);
    });
  });

  describe('setOverheatCycles', () => {
    it('should set overheat cycles for a sector', () => {
      const store = createTestStore();
      store.dispatch(setOverheatCycles({ sector: 'tech', cycles: 5 }));

      expect(store.getState().marketPhase.overheatCycles.tech).toBe(5);
    });

    it('should not allow negative overheat cycles', () => {
      const store = createTestStore();
      store.dispatch(setOverheatCycles({ sector: 'tech', cycles: -3 }));

      expect(store.getState().marketPhase.overheatCycles.tech).toBe(0);
    });
  });

  describe('resetSectorOverheat', () => {
    it('should reset overheat cycles for a sector', () => {
      const store = createTestStore();
      store.dispatch(setOverheatCycles({ sector: 'tech', cycles: 10 }));
      store.dispatch(resetSectorOverheat('tech'));

      expect(store.getState().marketPhase.overheatCycles.tech).toBe(0);
    });

    it('should not affect other sectors', () => {
      const store = createTestStore();
      store.dispatch(setOverheatCycles({ sector: 'tech', cycles: 10 }));
      store.dispatch(setOverheatCycles({ sector: 'finance', cycles: 5 }));
      store.dispatch(resetSectorOverheat('tech'));

      const state = store.getState().marketPhase;
      expect(state.overheatCycles.tech).toBe(0);
      expect(state.overheatCycles.finance).toBe(5);
    });
  });

  describe('triggerSectorCrash', () => {
    it('should set sector to panic phase', () => {
      const store = createTestStore();
      store.dispatch(setSectorPhase({ sector: 'tech', phase: 'boom' }));
      store.dispatch(triggerSectorCrash('tech'));

      expect(store.getState().marketPhase.sectorPhases.tech).toBe('panic');
    });

    it('should reset sector cycles', () => {
      const store = createTestStore();
      store.dispatch(incrementPhaseCycles());
      store.dispatch(incrementPhaseCycles());
      store.dispatch(triggerSectorCrash('tech'));

      expect(store.getState().marketPhase.cyclesInSectorPhase.tech).toBe(0);
    });

    it('should reset sector overheat cycles', () => {
      const store = createTestStore();
      store.dispatch(setOverheatCycles({ sector: 'tech', cycles: 10 }));
      store.dispatch(triggerSectorCrash('tech'));

      expect(store.getState().marketPhase.overheatCycles.tech).toBe(0);
    });

    it('should not affect other sectors', () => {
      const store = createTestStore();
      store.dispatch(setSectorPhase({ sector: 'finance', phase: 'boom' }));
      store.dispatch(triggerSectorCrash('tech'));

      expect(store.getState().marketPhase.sectorPhases.finance).toBe('boom');
    });
  });

  describe('triggerGlobalCrash', () => {
    it('should set global phase to panic', () => {
      const store = createTestStore();
      store.dispatch(setGlobalPhase('boom'));
      store.dispatch(triggerGlobalCrash());

      expect(store.getState().marketPhase.globalPhase).toBe('panic');
    });

    it('should set all sectors to panic', () => {
      const store = createTestStore();
      store.dispatch(setSectorPhase({ sector: 'tech', phase: 'boom' }));
      store.dispatch(setSectorPhase({ sector: 'finance', phase: 'prosperity' }));
      store.dispatch(triggerGlobalCrash());

      const state = store.getState().marketPhase;
      expect(state.sectorPhases.tech).toBe('panic');
      expect(state.sectorPhases.finance).toBe('panic');
      expect(state.sectorPhases.industrial).toBe('panic');
      expect(state.sectorPhases.commodities).toBe('panic');
    });

    it('should reset all cycles', () => {
      const store = createTestStore();
      store.dispatch(incrementPhaseCycles());
      store.dispatch(incrementPhaseCycles());
      store.dispatch(triggerGlobalCrash());

      const state = store.getState().marketPhase;
      expect(state.cyclesInGlobalPhase).toBe(0);
      expect(state.cyclesInSectorPhase.tech).toBe(0);
      expect(state.cyclesInSectorPhase.finance).toBe(0);
    });

    it('should reset all overheat cycles', () => {
      const store = createTestStore();
      store.dispatch(setOverheatCycles({ sector: 'tech', cycles: 10 }));
      store.dispatch(setOverheatCycles({ sector: 'finance', cycles: 5 }));
      store.dispatch(triggerGlobalCrash());

      const state = store.getState().marketPhase;
      expect(state.overheatCycles.tech).toBe(0);
      expect(state.overheatCycles.finance).toBe(0);
    });

    it('should set fear/greed index to extreme fear (10)', () => {
      const store = createTestStore();
      store.dispatch(setFearGreedIndex(80));
      store.dispatch(triggerGlobalCrash());

      expect(store.getState().marketPhase.fearGreedIndex).toBe(10);
    });
  });

  describe('resetMarketPhase', () => {
    it('should reset to initial state', () => {
      const store = createTestStore();
      store.dispatch(setGlobalPhase('panic'));
      store.dispatch(setFearGreedIndex(10));
      store.dispatch(setSectorPhase({ sector: 'tech', phase: 'recession' }));

      store.dispatch(resetMarketPhase());

      const state = store.getState().marketPhase;
      expect(state.globalPhase).toBe('prosperity');
      expect(state.fearGreedIndex).toBe(50);
      expect(state.sectorPhases.tech).toBe('prosperity');
    });
  });

  describe('restoreMarketPhase', () => {
    it('should restore saved state', () => {
      const store = createTestStore();
      const savedState = {
        globalPhase: 'boom' as const,
        sectorPhases: {
          tech: 'boom' as const,
          finance: 'consolidation' as const,
          industrial: 'prosperity' as const,
          commodities: 'recession' as const,
        },
        cyclesInGlobalPhase: 5,
        cyclesInSectorPhase: {
          tech: 3,
          finance: 2,
          industrial: 1,
          commodities: 4,
        },
        fearGreedIndex: 72,
        overheatCycles: {
          tech: 2,
          finance: 0,
          industrial: 0,
          commodities: 1,
        },
        lastUpdate: 123456789,
        phaseHistory: {
          totalCycles: 100,
          cyclesPerPhase: {
            prosperity: 40,
            boom: 30,
            consolidation: 15,
            panic: 5,
            recession: 5,
            recovery: 5,
          },
        },
        climateHistory: [],
      };

      store.dispatch(restoreMarketPhase(savedState));

      const state = store.getState().marketPhase;
      expect(state.globalPhase).toBe('boom');
      expect(state.fearGreedIndex).toBe(72);
      expect(state.sectorPhases.finance).toBe('consolidation');
      expect(state.cyclesInGlobalPhase).toBe(5);
    });
  });

  describe('recordPhaseCycle', () => {
    it('should increment total cycles', () => {
      const store = createTestStore();
      store.dispatch(recordPhaseCycle());

      const state = store.getState().marketPhase;
      expect(state.phaseHistory.totalCycles).toBe(1);
    });

    it('should increment cycles for current global phase', () => {
      const store = createTestStore();
      store.dispatch(setGlobalPhase('boom'));
      store.dispatch(recordPhaseCycle());
      store.dispatch(recordPhaseCycle());

      const state = store.getState().marketPhase;
      expect(state.phaseHistory.cyclesPerPhase.boom).toBe(2);
    });

    it('should add entry to climate history', () => {
      const store = createTestStore();
      store.dispatch(setGlobalPhase('consolidation'));
      store.dispatch(setFearGreedIndex(30));
      store.dispatch(recordPhaseCycle());

      const state = store.getState().marketPhase;
      expect(state.climateHistory).toHaveLength(1);
      expect(state.climateHistory[0]).toEqual({
        cycle: 1,
        phase: 'consolidation',
        fearGreedIndex: 30,
      });
    });

    it('should track multiple cycles in climate history', () => {
      const store = createTestStore();
      store.dispatch(setFearGreedIndex(50));
      store.dispatch(recordPhaseCycle());
      store.dispatch(setGlobalPhase('boom'));
      store.dispatch(setFearGreedIndex(80));
      store.dispatch(recordPhaseCycle());

      const state = store.getState().marketPhase;
      expect(state.climateHistory).toHaveLength(2);
      expect(state.climateHistory[0].phase).toBe('prosperity');
      expect(state.climateHistory[1].phase).toBe('boom');
      expect(state.climateHistory[1].fearGreedIndex).toBe(80);
    });

    it('should keep all climate history entries without limit', () => {
      const store = createTestStore();

      // Add 150 cycles
      for (let i = 0; i < 150; i++) {
        store.dispatch(recordPhaseCycle());
      }

      const state = store.getState().marketPhase;
      // All entries should be kept
      expect(state.climateHistory).toHaveLength(150);
      expect(state.climateHistory[0].cycle).toBe(1);
      expect(state.climateHistory[149].cycle).toBe(150);
    });
  });

  describe('selectors', () => {
    it('selectGlobalPhase should return global phase', () => {
      const store = createTestStore();
      store.dispatch(setGlobalPhase('consolidation'));

      expect(selectGlobalPhase(store.getState())).toBe('consolidation');
    });

    it('selectSectorPhases should return all sector phases', () => {
      const store = createTestStore();
      store.dispatch(setSectorPhase({ sector: 'tech', phase: 'boom' }));

      const phases = selectSectorPhases(store.getState());
      expect(phases.tech).toBe('boom');
      expect(phases.finance).toBe('prosperity');
    });

    it('selectSectorPhase should return phase for specific sector', () => {
      const store = createTestStore();
      store.dispatch(setSectorPhase({ sector: 'industrial', phase: 'recession' }));

      expect(selectSectorPhase('industrial')(store.getState())).toBe('recession');
    });

    it('selectFearGreedIndex should return fear/greed index', () => {
      const store = createTestStore();
      store.dispatch(setFearGreedIndex(85));

      expect(selectFearGreedIndex(store.getState())).toBe(85);
    });

    it('selectCyclesInGlobalPhase should return global cycles', () => {
      const store = createTestStore();
      store.dispatch(incrementPhaseCycles());
      store.dispatch(incrementPhaseCycles());

      expect(selectCyclesInGlobalPhase(store.getState())).toBe(2);
    });

    it('selectCyclesInSectorPhase should return cycles for sector', () => {
      const store = createTestStore();
      store.dispatch(incrementPhaseCycles());

      expect(selectCyclesInSectorPhase('tech')(store.getState())).toBe(1);
    });

    it('selectOverheatCycles should return all overheat cycles', () => {
      const store = createTestStore();
      store.dispatch(setOverheatCycles({ sector: 'tech', cycles: 7 }));

      const cycles = selectOverheatCycles(store.getState());
      expect(cycles.tech).toBe(7);
      expect(cycles.finance).toBe(0);
    });

    it('selectSectorOverheatCycles should return cycles for sector', () => {
      const store = createTestStore();
      store.dispatch(setOverheatCycles({ sector: 'commodities', cycles: 3 }));

      expect(selectSectorOverheatCycles('commodities')(store.getState())).toBe(3);
    });

    it('selectMarketPhaseState should return full state', () => {
      const store = createTestStore();
      const state = selectMarketPhaseState(store.getState());

      expect(state).toHaveProperty('globalPhase');
      expect(state).toHaveProperty('sectorPhases');
      expect(state).toHaveProperty('fearGreedIndex');
      expect(state).toHaveProperty('overheatCycles');
    });

    it('selectClimateHistory should return climate history', () => {
      const store = createTestStore();
      store.dispatch(setGlobalPhase('boom'));
      store.dispatch(setFearGreedIndex(75));
      store.dispatch(recordPhaseCycle());

      const history = selectClimateHistory(store.getState());
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual({
        cycle: 1,
        phase: 'boom',
        fearGreedIndex: 75,
      });
    });
  });
});

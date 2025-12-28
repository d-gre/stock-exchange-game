import { describe, it, expect } from 'vitest';
import uiReducer, {
  selectStock,
  openTradeModal,
  closeTradeModal,
  openSettings,
  closeSettings,
  setChartTab,
} from './uiSlice';

describe('uiSlice', () => {
  const createInitialState = (overrides = {}) => ({
    selectedStock: 'AAPL',
    tradeModal: { isOpen: false, symbol: '', type: 'buy' as const },
    settingsOpen: false,
    helpOpen: false,
    chartTab: 'stock' as const,
    ...overrides,
  });

  describe('selectStock', () => {
    it('should update selected stock', () => {
      const initialState = createInitialState();
      const newState = uiReducer(initialState, selectStock('GOOGL'));
      expect(newState.selectedStock).toBe('GOOGL');
    });

    it('should switch to stock tab when selecting a stock', () => {
      const initialState = createInitialState({ chartTab: 'index' as const });
      const newState = uiReducer(initialState, selectStock('GOOGL'));
      expect(newState.chartTab).toBe('stock');
    });
  });

  describe('tradeModal', () => {
    it('should open trade modal with correct data', () => {
      const initialState = createInitialState();
      const newState = uiReducer(
        initialState,
        openTradeModal({ symbol: 'GOOGL', type: 'sell' })
      );

      expect(newState.tradeModal.isOpen).toBe(true);
      expect(newState.tradeModal.symbol).toBe('GOOGL');
      expect(newState.tradeModal.type).toBe('sell');
    });

    it('should close trade modal', () => {
      const initialState = createInitialState({
        tradeModal: { isOpen: true, symbol: 'GOOGL', type: 'sell' as const },
      });

      const newState = uiReducer(initialState, closeTradeModal());
      expect(newState.tradeModal.isOpen).toBe(false);
    });
  });

  describe('settings', () => {
    it('should open settings', () => {
      const initialState = createInitialState();
      const newState = uiReducer(initialState, openSettings());
      expect(newState.settingsOpen).toBe(true);
    });

    it('should close settings', () => {
      const initialState = createInitialState({ settingsOpen: true });
      const newState = uiReducer(initialState, closeSettings());
      expect(newState.settingsOpen).toBe(false);
    });
  });

  describe('chartTab', () => {
    it('should set chart tab to index', () => {
      const initialState = createInitialState();
      const newState = uiReducer(initialState, setChartTab('index'));
      expect(newState.chartTab).toBe('index');
    });

    it('should set chart tab to stock', () => {
      const initialState = createInitialState({ chartTab: 'index' as const });
      const newState = uiReducer(initialState, setChartTab('stock'));
      expect(newState.chartTab).toBe('stock');
    });
  });
});

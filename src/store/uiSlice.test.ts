import { describe, it, expect } from 'vitest';
import uiReducer, {
  selectStock,
  openTradeModal,
  closeTradeModal,
  openSettings,
  closeSettings,
  openHelp,
  closeHelp,
  setChartTab,
  openLoanModal,
  closeLoanModal,
  highlightLoan,
  clearLoanHighlight,
} from './uiSlice';

describe('uiSlice', () => {
  const createInitialState = (overrides = {}) => ({
    selectedStock: 'AAPL',
    tradeModal: { isOpen: false, symbol: '', type: 'buy' as const },
    settingsOpen: false,
    helpOpen: false,
    chartTab: 'stock' as const,
    loanModalOpen: false,
    highlightedLoanId: null as string | null,
    debugModalOpen: false,
    debugModalContent: '',
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

  describe('help', () => {
    it('should open help', () => {
      const initialState = createInitialState();
      const newState = uiReducer(initialState, openHelp());
      expect(newState.helpOpen).toBe(true);
    });

    it('should close help', () => {
      const initialState = createInitialState({ helpOpen: true });
      const newState = uiReducer(initialState, closeHelp());
      expect(newState.helpOpen).toBe(false);
    });
  });

  describe('loanModal', () => {
    it('should open loan modal', () => {
      const initialState = createInitialState();
      const newState = uiReducer(initialState, openLoanModal());
      expect(newState.loanModalOpen).toBe(true);
    });

    it('should close loan modal', () => {
      const initialState = createInitialState({ loanModalOpen: true });
      const newState = uiReducer(initialState, closeLoanModal());
      expect(newState.loanModalOpen).toBe(false);
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

    it('should set chart tab to history', () => {
      const initialState = createInitialState();
      const newState = uiReducer(initialState, setChartTab('history'));
      expect(newState.chartTab).toBe('history');
    });
  });

  describe('loanHighlight', () => {
    it('should highlight a loan by id', () => {
      const initialState = createInitialState();
      const newState = uiReducer(initialState, highlightLoan('loan-123'));
      expect(newState.highlightedLoanId).toBe('loan-123');
    });

    it('should replace existing highlight with new loan id', () => {
      const initialState = createInitialState({ highlightedLoanId: 'loan-123' });
      const newState = uiReducer(initialState, highlightLoan('loan-456'));
      expect(newState.highlightedLoanId).toBe('loan-456');
    });

    it('should clear loan highlight', () => {
      const initialState = createInitialState({ highlightedLoanId: 'loan-123' });
      const newState = uiReducer(initialState, clearLoanHighlight());
      expect(newState.highlightedLoanId).toBeNull();
    });

    it('should handle clearing when no highlight is set', () => {
      const initialState = createInitialState();
      const newState = uiReducer(initialState, clearLoanHighlight());
      expect(newState.highlightedLoanId).toBeNull();
    });
  });
});

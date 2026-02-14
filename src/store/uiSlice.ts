import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type TradeType = 'buy' | 'sell' | 'shortSell' | 'buyToCover' | 'addMargin';

interface TradeModal {
  isOpen: boolean;
  symbol: string;
  type: TradeType;
}

type ChartTab = 'stock' | 'index' | 'history';

interface UiState {
  selectedStock: string;
  tradeModal: TradeModal;
  settingsOpen: boolean;
  helpOpen: boolean;
  chartTab: ChartTab;
  loanModalOpen: boolean;
  /** Loan ID to highlight in the loans list (from toast click) */
  highlightedLoanId: string | null;
  /** Debug modal state */
  debugModalOpen: boolean;
  debugModalContent: string;
}

const initialState: UiState = {
  selectedStock: '',  // Empty = show all owned stocks
  tradeModal: { isOpen: false, symbol: '', type: 'buy' },
  settingsOpen: false,
  helpOpen: false,
  chartTab: 'stock',
  loanModalOpen: false,
  highlightedLoanId: null,
  debugModalOpen: false,
  debugModalContent: '',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    selectStock: (state, action: PayloadAction<string>) => {
      state.selectedStock = action.payload;
      state.chartTab = 'stock';
    },
    openTradeModal: (state, action: PayloadAction<{ symbol: string; type: TradeType }>) => {
      state.tradeModal = { isOpen: true, ...action.payload };
    },
    closeTradeModal: (state) => {
      state.tradeModal.isOpen = false;
    },
    openSettings: (state) => {
      state.settingsOpen = true;
    },
    closeSettings: (state) => {
      state.settingsOpen = false;
    },
    openHelp: (state) => {
      state.helpOpen = true;
    },
    closeHelp: (state) => {
      state.helpOpen = false;
    },
    setChartTab: (state, action: PayloadAction<ChartTab>) => {
      state.chartTab = action.payload;
    },
    openLoanModal: (state) => {
      state.loanModalOpen = true;
    },
    closeLoanModal: (state) => {
      state.loanModalOpen = false;
    },
    highlightLoan: (state, action: PayloadAction<string>) => {
      state.highlightedLoanId = action.payload;
    },
    clearLoanHighlight: (state) => {
      state.highlightedLoanId = null;
    },
    openDebugModal: (state, action: PayloadAction<string>) => {
      state.debugModalOpen = true;
      state.debugModalContent = action.payload;
    },
    closeDebugModal: (state) => {
      state.debugModalOpen = false;
      state.debugModalContent = '';
    },
  },
});

export const { selectStock, openTradeModal, closeTradeModal, openSettings, closeSettings, openHelp, closeHelp, setChartTab, openLoanModal, closeLoanModal, highlightLoan, clearLoanHighlight, openDebugModal, closeDebugModal } = uiSlice.actions;
export default uiSlice.reducer;

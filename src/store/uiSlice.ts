import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface TradeModal {
  isOpen: boolean;
  symbol: string;
  type: 'buy' | 'sell';
}

type ChartTab = 'stock' | 'index' | 'history';

interface UiState {
  selectedStock: string;
  tradeModal: TradeModal;
  settingsOpen: boolean;
  helpOpen: boolean;
  chartTab: ChartTab;
}

const initialState: UiState = {
  selectedStock: '',  // Leer = alle besessenen Aktien anzeigen
  tradeModal: { isOpen: false, symbol: '', type: 'buy' },
  settingsOpen: false,
  helpOpen: false,
  chartTab: 'stock',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    selectStock: (state, action: PayloadAction<string>) => {
      state.selectedStock = action.payload;
      state.chartTab = 'stock';
    },
    openTradeModal: (state, action: PayloadAction<{ symbol: string; type: 'buy' | 'sell' }>) => {
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
  },
});

export const { selectStock, openTradeModal, closeTradeModal, openSettings, closeSettings, openHelp, closeHelp, setChartTab } = uiSlice.actions;
export default uiSlice.reducer;

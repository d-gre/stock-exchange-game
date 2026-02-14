import { configureStore } from '@reduxjs/toolkit';
import stocksReducer from './stocksSlice';
import portfolioReducer from './portfolioSlice';
import virtualPlayersReducer from './virtualPlayersSlice';
import settingsReducer from './settingsSlice';
import uiReducer from './uiSlice';
import pendingOrdersReducer from './pendingOrdersSlice';
import notificationsReducer from './notificationsSlice';
import tradeHistoryReducer from './tradeHistorySlice';
import marketMakerReducer from './marketMakerSlice';
import sectorReducer from './sectorSlice';
import loansReducer from './loansSlice';
import gameSessionReducer from './gameSessionSlice';
import marketPhaseReducer from './marketPhaseSlice';
import floatReducer from './floatSlice';
import orderBookReducer from './orderBookSlice';
import shortPositionsReducer from './shortPositionsSlice';

export const store = configureStore({
  reducer: {
    stocks: stocksReducer,
    portfolio: portfolioReducer,
    virtualPlayers: virtualPlayersReducer,
    settings: settingsReducer,
    ui: uiReducer,
    pendingOrders: pendingOrdersReducer,
    notifications: notificationsReducer,
    tradeHistory: tradeHistoryReducer,
    marketMaker: marketMakerReducer,
    sector: sectorReducer,
    loans: loansReducer,
    gameSession: gameSessionReducer,
    marketPhase: marketPhaseReducer,
    float: floatReducer,
    orderBook: orderBookReducer,
    shortPositions: shortPositionsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppStore = typeof store;

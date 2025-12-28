import { configureStore } from '@reduxjs/toolkit';
import stocksReducer from './stocksSlice';
import portfolioReducer from './portfolioSlice';
import virtualPlayersReducer from './virtualPlayersSlice';
import settingsReducer from './settingsSlice';
import uiReducer from './uiSlice';
import pendingOrdersReducer from './pendingOrdersSlice';
import notificationsReducer from './notificationsSlice';
import tradeHistoryReducer from './tradeHistorySlice';

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
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

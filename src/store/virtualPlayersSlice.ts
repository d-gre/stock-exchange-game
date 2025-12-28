import { createSlice, type PayloadAction, type Dispatch } from '@reduxjs/toolkit';
import type { VirtualPlayer, Stock } from '../types';
import {
  initializeVirtualPlayers,
  executeVirtualPlayerTrades,
  executeWarmupTrades,
  forceTradesForUntradedStocks,
  type WarmupConfig,
} from '../utils/virtualPlayers';
import { setStocks } from './stocksSlice';

interface VirtualPlayersState {
  players: VirtualPlayer[];
  totalTradeCount: number;
}

interface RootStateForThunk {
  virtualPlayers: VirtualPlayersState;
  stocks: { items: Stock[] };
}

const initialState: VirtualPlayersState = {
  players: initializeVirtualPlayers(),
  totalTradeCount: 0,
};

const virtualPlayersSlice = createSlice({
  name: 'virtualPlayers',
  initialState,
  reducers: {
    setPlayers: (state, action: PayloadAction<VirtualPlayer[]>) => {
      state.players = action.payload;
    },
    incrementTradeCount: (state, action: PayloadAction<number>) => {
      state.totalTradeCount += action.payload;
    },
    resetTradeCount: (state) => {
      state.totalTradeCount = 0;
    },
    reinitializePlayers: (state, action: PayloadAction<{ count: number; playerInitialCash?: number }>) => {
      state.players = initializeVirtualPlayers(action.payload.count, action.payload.playerInitialCash);
      state.totalTradeCount = 0;
    },
  },
});

export const { setPlayers, incrementTradeCount, resetTradeCount, reinitializePlayers } = virtualPlayersSlice.actions;

// Thunk for executing virtual player trades
// Updates both player portfolios and stock prices
export const executeVirtualTrades = () => {
  return (dispatch: Dispatch, getState: () => RootStateForThunk) => {
    const { virtualPlayers, stocks } = getState();
    const { updatedPlayers, updatedStocks, tradesExecuted } = executeVirtualPlayerTrades(
      virtualPlayers.players,
      stocks.items
    );
    dispatch(setPlayers(updatedPlayers));
    dispatch(setStocks(updatedStocks));
    if (tradesExecuted > 0) {
      dispatch(incrementTradeCount(tradesExecuted));
    }
  };
};

/**
 * Thunk for warmup trades with trade tracking and prioritization.
 * Returns the updated trade counts.
 */
export const executeWarmupVirtualTrades = (warmupConfig: WarmupConfig) => {
  return (dispatch: Dispatch, getState: () => RootStateForThunk): Record<string, number> => {
    const { virtualPlayers, stocks } = getState();
    const { updatedPlayers, updatedStocks, updatedTradeCounts } = executeWarmupTrades(
      virtualPlayers.players,
      stocks.items,
      warmupConfig
    );
    dispatch(setPlayers(updatedPlayers));
    dispatch(setStocks(updatedStocks));
    return updatedTradeCounts;
  };
};

/**
 * Thunk for forced trades at the end of warmup.
 * Ensures that each stock has been traded at least once.
 */
export const forceTradesForUntraded = (tradeCounts: Record<string, number>) => {
  return (dispatch: Dispatch, getState: () => RootStateForThunk): string[] => {
    const { virtualPlayers, stocks } = getState();
    const { updatedPlayers, updatedStocks, forcedSymbols } = forceTradesForUntradedStocks(
      virtualPlayers.players,
      stocks.items,
      tradeCounts
    );
    dispatch(setPlayers(updatedPlayers));
    dispatch(setStocks(updatedStocks));
    return forcedSymbols;
  };
};

export default virtualPlayersSlice.reducer;

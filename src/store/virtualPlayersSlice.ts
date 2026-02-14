import { createSlice, type PayloadAction, type Dispatch } from '@reduxjs/toolkit';
import type { VirtualPlayer, Stock, Loan, MarketPhase, Sector } from '../types';
import { LOAN_CONFIG } from '../config';
import {
  initializeVirtualPlayers,
  resetVirtualPlayersForTimedGame,
  executeVirtualPlayerTrades,
  executeWarmupTrades,
  forceTradesForUntradedStocks,
  processVPLoanDecisions,
  type WarmupConfig
} from '../utils/virtualPlayers';
import { setStocks } from './stocksSlice';
import { executeVirtualTrade } from './marketMakerSlice';

interface VirtualPlayersState {
  players: VirtualPlayer[];
  totalTradeCount: number;
}

interface MarketPhaseStateForThunk {
  globalPhase: MarketPhase;
  sectorPhases: Record<Sector, MarketPhase>;
}

interface RootStateForThunk {
  virtualPlayers: VirtualPlayersState;
  stocks: { items: Stock[] };
  marketPhase: MarketPhaseStateForThunk;
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
    reinitializePlayers: (state, action: PayloadAction<{ count: number; playerInitialCash?: number; isTimedGame?: boolean }>) => {
      state.players = initializeVirtualPlayers(action.payload.count, action.payload.playerInitialCash, action.payload.isTimedGame);
      state.totalTradeCount = 0;
    },
    // Reset VPs for timed game after warmup (keeps risk tolerance, resets everything else)
    resetPlayersForTimedGame: (state, action: PayloadAction<{ playerInitialCash: number }>) => {
      state.players = resetVirtualPlayersForTimedGame(state.players, action.payload.playerInitialCash);
    },
    // VP takes a loan
    vpTakeLoan: (state, action: PayloadAction<{ playerId: string; loan: Loan }>) => {
      const player = state.players.find(p => p.id === action.payload.playerId);
      if (player) {
        // Apply origination fee (same as player)
        const netAmount = action.payload.loan.principal * (1 - LOAN_CONFIG.originationFeePercent);
        player.portfolio.cash += netAmount;
        player.loans.push(action.payload.loan);
      }
    },
    // VP repays a loan (partial or full)
    vpRepayLoan: (state, action: PayloadAction<{ playerId: string; loanId: string; amount: number }>) => {
      const player = state.players.find(p => p.id === action.payload.playerId);
      if (player) {
        const loan = player.loans.find(l => l.id === action.payload.loanId);
        if (loan) {
          const repaymentFee = action.payload.amount * LOAN_CONFIG.repaymentFeePercent;
          const totalCost = action.payload.amount + repaymentFee;

          if (player.portfolio.cash >= totalCost) {
            player.portfolio.cash -= totalCost;
            loan.balance -= action.payload.amount;

            // Remove loan if fully repaid
            if (loan.balance <= 0) {
              player.loans = player.loans.filter(l => l.id !== action.payload.loanId);
            }
          }
        }
      }
    },
    // Charge interest on all VP loans
    vpChargeInterest: (state) => {
      for (const player of state.players) {
        for (const loan of player.loans) {
          const interestAmount = loan.balance * loan.interestRate;
          loan.balance += interestAmount;
          loan.totalInterestPaid += interestAmount;
        }
        player.cyclesSinceInterest = 0;
      }
    },
    // Increment interest cycle counter for all VPs
    vpIncrementInterestCycle: (state) => {
      for (const player of state.players) {
        if (player.loans.length > 0) {
          player.cyclesSinceInterest++;
        }
      }
    },
    // Restore virtual players state from saved game
    restoreVirtualPlayers: (_state, action: PayloadAction<VirtualPlayersState>) => {
      return action.payload;
    },
  },
});

export const {
  setPlayers,
  incrementTradeCount,
  resetTradeCount,
  reinitializePlayers,
  resetPlayersForTimedGame,
  vpTakeLoan,
  vpRepayLoan,
  vpChargeInterest,
  vpIncrementInterestCycle,
  restoreVirtualPlayers,
} = virtualPlayersSlice.actions;

// Thunk for executing virtual player trades
// Updates both player portfolios and stock prices, and Market Maker inventory
// Also processes loan decisions (take/repay)
export const executeVirtualTrades = () => {
  return (dispatch: Dispatch, getState: () => RootStateForThunk) => {
    const { virtualPlayers, stocks } = getState();

    // First, process loan decisions
    const loanDecisions = processVPLoanDecisions(virtualPlayers.players, stocks.items);

    // Apply loan decisions
    for (const decision of loanDecisions) {
      if (decision.type === 'take' && decision.loan) {
        dispatch(vpTakeLoan({ playerId: decision.playerId, loan: decision.loan }));
      } else if (decision.type === 'repay' && decision.loanId && decision.amount) {
        dispatch(vpRepayLoan({
          playerId: decision.playerId,
          loanId: decision.loanId,
          amount: decision.amount,
        }));
      }
    }

    // Get updated state after loan processing
    const updatedState = getState();

    // Then, execute trades with market phase awareness
    const { updatedPlayers, updatedStocks, tradesExecuted, executedTrades } = executeVirtualPlayerTrades(
      updatedState.virtualPlayers.players,
      updatedState.stocks.items,
      updatedState.marketPhase.globalPhase
    );
    dispatch(setPlayers(updatedPlayers));
    dispatch(setStocks(updatedStocks));
    if (tradesExecuted > 0) {
      dispatch(incrementTradeCount(tradesExecuted));
    }

    // Update Market Maker inventory for each executed trade
    for (const trade of executedTrades) {
      dispatch(executeVirtualTrade(trade));
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
    const { updatedPlayers, updatedStocks, updatedTradeCounts, executedTrades } = executeWarmupTrades(
      virtualPlayers.players,
      stocks.items,
      warmupConfig
    );
    dispatch(setPlayers(updatedPlayers));
    dispatch(setStocks(updatedStocks));

    // Update Market Maker inventory for each executed trade
    for (const trade of executedTrades) {
      dispatch(executeVirtualTrade(trade));
    }

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
    const { updatedPlayers, updatedStocks, forcedSymbols, executedTrades } = forceTradesForUntradedStocks(
      virtualPlayers.players,
      stocks.items,
      tradeCounts
    );
    dispatch(setPlayers(updatedPlayers));
    dispatch(setStocks(updatedStocks));

    // Update Market Maker inventory for each executed trade
    for (const trade of executedTrades) {
      dispatch(executeVirtualTrade(trade));
    }

    return forcedSymbols;
  };
};

// Selectors
export const selectAllPlayers = (state: { virtualPlayers: VirtualPlayersState }) =>
  state.virtualPlayers.players;

export const selectTotalVPDebt = (state: { virtualPlayers: VirtualPlayersState }) =>
  state.virtualPlayers.players.reduce(
    (total, player) => total + player.loans.reduce((sum, loan) => sum + loan.balance, 0),
    0
  );

/** Calculate total debt for a single VP */
export const getVPTotalDebt = (player: VirtualPlayer): number =>
  player.loans.reduce((sum, loan) => sum + loan.balance, 0);

export default virtualPlayersSlice.reducer;

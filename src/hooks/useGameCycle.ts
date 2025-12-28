import { useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { updatePrices, checkAndApplyStockSplits } from '../store/stocksSlice';
import { executeVirtualTrades } from '../store/virtualPlayersSlice';
import { decrementCountdown, resetCountdown, type SpeedMultiplier } from '../store/settingsSlice';
import { executePendingOrders, resetTradedSymbols } from '../store/pendingOrdersSlice';
import { updatePortfolioValueHistory, selectTotalRealizedProfitLoss } from '../store/tradeHistorySlice';

interface UseGameCycleOptions {
  /** Is the game started? */
  isGameStarted: boolean;
  /** Can the player currently trade (Trade-Panel open)? */
  canTradeInPanel: boolean;
  /** Current portfolio value for history */
  totalPortfolioValue: number;
}

interface UseGameCycleReturn {
  /** Effective interval in seconds (considers speed multiplier) */
  effectiveInterval: number;
  /** Is the game paused for any reason? */
  isEffectivelyPaused: boolean;
  /** Current countdown in seconds */
  countdown: number;
  /** Manually paused? */
  isPaused: boolean;
  /** Current speed multiplier */
  speedMultiplier: SpeedMultiplier;
}

/**
 * Hook for game cycle logic
 * Manages timer, countdown, pause state and executes update cycles
 */
export const useGameCycle = ({
  isGameStarted,
  canTradeInPanel,
  totalPortfolioValue,
}: UseGameCycleOptions): UseGameCycleReturn => {
  const dispatch = useAppDispatch();

  const { updateInterval, countdown, isPaused, speedMultiplier } = useAppSelector(
    state => state.settings
  );
  const totalRealizedProfitLoss = useAppSelector(selectTotalRealizedProfitLoss);

  const effectiveInterval = updateInterval / speedMultiplier;

  // Pause the cycle when:
  // - Game not yet started
  // - Manually paused
  // - Player can trade in the Trade-Panel
  const isEffectivelyPaused = !isGameStarted || isPaused || canTradeInPanel;

  const handleUpdatePrices = useCallback(() => {
    // 1. Execute and process pending orders
    dispatch(executePendingOrders());

    // 2. Generate new candles
    dispatch(updatePrices());

    // 3. Check and apply stock splits (when price > $750)
    dispatch(checkAndApplyStockSplits());

    // 4. Let virtual players trade
    dispatch(executeVirtualTrades());

    // 5. Reset traded stocks for new cycle
    dispatch(resetTradedSymbols());

    dispatch(resetCountdown());
  }, [dispatch]);

  // Main update interval
  useEffect(() => {
    if (isEffectivelyPaused) return;
    const priceInterval = setInterval(handleUpdatePrices, effectiveInterval * 1000);
    return () => clearInterval(priceInterval);
  }, [handleUpdatePrices, effectiveInterval, isEffectivelyPaused]);

  // Countdown interval (1 second)
  useEffect(() => {
    if (isEffectivelyPaused) return;
    const countdownInterval = setInterval(() => {
      dispatch(decrementCountdown());
    }, 1000);
    return () => clearInterval(countdownInterval);
  }, [dispatch, isEffectivelyPaused]);

  // Update portfolio history after each cycle
  useEffect(() => {
    if (!isGameStarted) return;
    const maxCountdown = Math.ceil(effectiveInterval);
    if (countdown === maxCountdown) {
      dispatch(updatePortfolioValueHistory({
        portfolioValue: totalPortfolioValue,
        realizedProfitLoss: totalRealizedProfitLoss,
      }));
    }
  }, [countdown, effectiveInterval, totalPortfolioValue, totalRealizedProfitLoss, dispatch, isGameStarted]);

  return {
    effectiveInterval,
    isEffectivelyPaused,
    countdown,
    isPaused,
    speedMultiplier,
  };
};

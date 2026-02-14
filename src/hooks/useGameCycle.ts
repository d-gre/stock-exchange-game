import { useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { updatePrices, checkAndApplyStockSplits } from '../store/stocksSlice';
import { executeVirtualTrades, selectAllPlayers } from '../store/virtualPlayersSlice';
import { setCountdown, resetCountdown, type SpeedMultiplier } from '../store/settingsSlice';
import { executePendingOrders, resetTradedSymbols } from '../store/pendingOrdersSlice';
import { updatePortfolioValueHistory, selectTotalRealizedProfitLoss } from '../store/tradeHistorySlice';
import { rebalanceInventory } from '../store/marketMakerSlice';
import { updateSectorState, selectSectorInfluences } from '../store/sectorSlice';
import { tickOrderCycles as tickOrderBookCycles } from '../store/orderBookSlice';
import {
  incrementInterestCycleCounter,
  chargeInterest,
  decrementLoanCycles,
  processLoanMaturity,
  markLoanWarningShown,
  selectShouldChargeInterest,
  selectTotalDebt,
  selectPendingInterest,
  selectCyclesSinceLastInterestCharge,
  selectLoansDueSoon,
  selectLoansDueNow,
  selectAllLoans,
} from '../store/loansSlice';
import {
  chargeBorrowFees,
  updateMarginCallStatuses,
  selectAllShortPositions,
  selectMarginCallStatuses,
  selectPositionsForForcedCover,
  selectTotalShortInterestBySymbol,
  closeShortPosition,
} from '../store/shortPositionsSlice';
import { selectAllFloats } from '../store/floatSlice';
import { deductCash } from '../store/portfolioSlice';
import { addNotification, dismissNotificationsForMarginCall, tickNotificationCycles } from '../store/notificationsSlice';
import { LOAN_CONFIG, SHORT_SELLING_CONFIG } from '../config';
import { toRomanNumeral } from '../utils/formatting';
import type { Loan } from '../types';
import {
  incrementCycle,
  endGame,
  selectGameDuration,
  selectCurrentCycle,
  selectIsGameEnded,
  type RiskLevel,
  type PlayerEndStats,
  type EndGameStats,
} from '../store/gameSessionSlice';
import {
  recordPhaseCycle,
  incrementPhaseCycles,
  setGlobalPhase,
  setSectorPhase,
  setFearGreedIndex,
  setOverheatCycles,
  triggerSectorCrash,
  selectGlobalPhase,
  selectSectorPhases,
  selectOverheatCycles,
} from '../store/marketPhaseSlice';
import {
  calculateMarketMetrics,
  checkSectorPhaseTransition,
  checkCrashTrigger,
  calculateFearGreedIndex,
  getVolatilityMultiplier,
  calculateGlobalPhaseFromSectors,
} from '../utils/marketPhaseLogic';
import type { Sector } from '../types';

interface UseGameCycleOptions {
  /** Is the game started? */
  isGameStarted: boolean;
  /** Can the player currently trade (Trade-Panel open)? */
  canTradeInPanel: boolean;
  /** Is the loan modal open? */
  isLoanModalOpen: boolean;
  /** Is the settings sidebar open? */
  isSettingsOpen: boolean;
  /** Is the help modal open? */
  isHelpOpen: boolean;
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
  /** Current game cycle (0-based) */
  currentCycle: number;
  /** Total game duration in cycles (null = unlimited) */
  gameDuration: number | null;
  /** Remaining cycles (null = unlimited) */
  remainingCycles: number | null;
  /** Game progress as fraction 0-1 (null = unlimited) */
  gameProgress: number | null;
  /** Has the game ended? */
  isGameEnded: boolean;
  /** Calculate end game statistics */
  calculateEndGameStats: () => EndGameStats;
}

/**
 * Hook for game cycle logic
 * Manages timer, countdown, pause state and executes update cycles
 */
export const useGameCycle = ({
  isGameStarted,
  canTradeInPanel,
  isLoanModalOpen,
  isSettingsOpen,
  isHelpOpen,
  totalPortfolioValue,
}: UseGameCycleOptions): UseGameCycleReturn => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const { updateInterval, countdown, isPaused, speedMultiplier, initialCash } = useAppSelector(
    state => state.settings
  );
  const stocks = useAppSelector(state => state.stocks.items);
  const portfolio = useAppSelector(state => state.portfolio);
  const sectorInfluences = useAppSelector(selectSectorInfluences);
  const totalRealizedProfitLoss = useAppSelector(selectTotalRealizedProfitLoss);
  const shouldChargeInterest = useAppSelector(selectShouldChargeInterest);
  const gameDuration = useAppSelector(selectGameDuration);
  const currentCycle = useAppSelector(selectCurrentCycle);
  const isGameEnded = useAppSelector(selectIsGameEnded);
  const virtualPlayers = useAppSelector(selectAllPlayers);
  const playerTotalDebt = useAppSelector(selectTotalDebt);
  const playerPendingInterest = useAppSelector(selectPendingInterest);
  const cyclesSinceLastInterestCharge = useAppSelector(selectCyclesSinceLastInterestCharge);
  const loansDueSoon = useAppSelector(selectLoansDueSoon);
  const loansDueNow = useAppSelector(selectLoansDueNow);
  const allLoans = useAppSelector(selectAllLoans);
  const gameSessionState = useAppSelector(state => state.gameSession);

  // Short selling selectors
  const shortPositions = useAppSelector(selectAllShortPositions);
  const marginCallStatuses = useAppSelector(selectMarginCallStatuses);
  const positionsForForcedCover = useAppSelector(selectPositionsForForcedCover);
  const totalShortsBySymbol = useAppSelector(selectTotalShortInterestBySymbol);
  const floats = useAppSelector(selectAllFloats);

  // Market phase selectors
  const globalPhase = useAppSelector(selectGlobalPhase);
  const sectorPhases = useAppSelector(selectSectorPhases);
  const cyclesInSectorPhase = useAppSelector(state => state.marketPhase.cyclesInSectorPhase);
  const overheatCycles = useAppSelector(selectOverheatCycles);

  const effectiveInterval = updateInterval / speedMultiplier;

  // Pause the cycle when:
  // - Game not yet started
  // - Manually paused
  // - Player can trade in the Trade-Panel
  // - Loan modal is open
  // - Settings sidebar is open
  // - Help modal is open
  // - Game has ended
  const isEffectivelyPaused = !isGameStarted || isPaused || canTradeInPanel || isLoanModalOpen || isSettingsOpen || isHelpOpen || isGameEnded;

  // Calculate risk level based on trading behavior
  const calculateRiskLevel = useCallback((): RiskLevel => {
    const { totalTradesExecuted, maxLoanUtilization } = gameSessionState;
    const cycleCount = currentCycle || 1;

    // Factors:
    // 1. Trade frequency (trades per cycle)
    const tradesPerCycle = totalTradesExecuted / cycleCount;

    // 2. Portfolio diversification (number of different stocks held)
    const diversification = portfolio.holdings.length;

    // 3. Loan utilization
    const loanUtilization = maxLoanUtilization;

    // Score: higher = more aggressive
    let riskScore = 0;

    // High trade frequency = aggressive
    if (tradesPerCycle > 0.5) riskScore += 2;
    else if (tradesPerCycle > 0.2) riskScore += 1;

    // Low diversification = aggressive
    if (diversification <= 2) riskScore += 2;
    else if (diversification <= 4) riskScore += 1;

    // High loan utilization = aggressive
    if (loanUtilization > 0.5) riskScore += 2;
    else if (loanUtilization > 0.2) riskScore += 1;

    if (riskScore >= 4) return 'aggressive';
    if (riskScore >= 2) return 'moderate';
    return 'conservative';
  }, [gameSessionState, currentCycle, portfolio.holdings.length]);

  // Calculate risk level for a virtual player based on their behavior
  const calculateVPRiskLevel = useCallback((vp: typeof virtualPlayers[0]): RiskLevel => {
    const diversification = vp.portfolio.holdings.length;
    const vpDebt = vp.loans?.reduce((sum, loan) => sum + loan.balance, 0) ?? 0;
    const vpHoldingsValue = vp.portfolio.holdings.reduce((sum, holding) => {
      const stock = stocks.find(s => s.symbol === holding.symbol);
      return sum + (stock ? stock.currentPrice * holding.shares : 0);
    }, 0);
    const vpNetWorth = vp.portfolio.cash + vpHoldingsValue;
    const loanUtilization = vpNetWorth > 0 ? vpDebt / vpNetWorth : 0;

    let riskScore = 0;

    // Low diversification = aggressive
    if (diversification <= 2) riskScore += 2;
    else if (diversification <= 4) riskScore += 1;

    // High loan utilization = aggressive
    if (loanUtilization > 0.5) riskScore += 2;
    else if (loanUtilization > 0.2) riskScore += 1;

    // High portfolio concentration (one stock > 50% of holdings) = aggressive
    if (vpHoldingsValue > 0) {
      const maxHoldingValue = Math.max(...vp.portfolio.holdings.map(h => {
        const stock = stocks.find(s => s.symbol === h.symbol);
        return stock ? stock.currentPrice * h.shares : 0;
      }), 0);
      if (maxHoldingValue / vpHoldingsValue > 0.5) riskScore += 1;
    }

    if (riskScore >= 4) return 'aggressive';
    if (riskScore >= 2) return 'moderate';
    return 'conservative';
  }, [stocks]);

  // Calculate end game statistics
  const calculateEndGameStats = useCallback((): EndGameStats => {
    // Calculate player's net worth
    // Formula: Cash + Stock Value - Debt (balance) - Pending Interest (uncharged) + Short P/L
    const playerHoldingsValue = portfolio.holdings.reduce((sum, holding) => {
      const stock = stocks.find(s => s.symbol === holding.symbol);
      return sum + (stock ? stock.currentPrice * holding.shares : 0);
    }, 0);

    // Calculate unrealized P/L from short positions
    // Short P/L = (entryPrice - currentPrice) * shares (positive when price fell, negative when rose)
    const playerShortPL = shortPositions.reduce((sum, position) => {
      const stock = stocks.find(s => s.symbol === position.symbol);
      const currentPrice = stock?.currentPrice ?? position.entryPrice;
      return sum + (position.entryPrice - currentPrice) * position.shares;
    }, 0);

    const playerNetWorth = portfolio.cash + playerHoldingsValue - playerTotalDebt - playerPendingInterest + playerShortPL;
    const playerProfit = playerNetWorth - initialCash;
    const playerRiskLevel = calculateRiskLevel();

    // Build list of all players (human + virtual)
    const allPlayers: PlayerEndStats[] = [
      {
        id: 'player',
        name: 'You',
        netWorth: playerNetWorth,
        profit: playerProfit,
        riskLevel: playerRiskLevel,
        isHuman: true,
      },
    ];

    // Add virtual players
    for (const vp of virtualPlayers) {
      const vpHoldingsValue = vp.portfolio.holdings.reduce((sum, holding) => {
        const stock = stocks.find(s => s.symbol === holding.symbol);
        return sum + (stock ? stock.currentPrice * holding.shares : 0);
      }, 0);
      const vpDebt = vp.loans?.reduce((sum, loan) => sum + loan.balance, 0) ?? 0;
      // Calculate pending interest for VP loans (same formula as player)
      const vpPendingInterest = vp.loans?.reduce((total, loan) => {
        const interestPerCycle = loan.balance * (loan.interestRate / LOAN_CONFIG.interestChargeCycles);
        return total + interestPerCycle * cyclesSinceLastInterestCharge;
      }, 0) ?? 0;
      // Calculate unrealized P/L from VP short positions
      const vpShortPL = (vp.shortPositions ?? []).reduce((sum, position) => {
        const stock = stocks.find(s => s.symbol === position.symbol);
        const currentPrice = stock?.currentPrice ?? position.entryPrice;
        return sum + (position.entryPrice - currentPrice) * position.shares;
      }, 0);
      const vpNetWorth = vp.portfolio.cash + vpHoldingsValue - vpDebt - vpPendingInterest + vpShortPL;
      const vpInitialCash = vp.initialCash ?? vp.portfolio.cash;
      const vpProfit = vpNetWorth - vpInitialCash;
      const vpRiskLevel = calculateVPRiskLevel(vp);

      allPlayers.push({
        id: vp.id,
        name: vp.name,
        netWorth: vpNetWorth,
        profit: vpProfit,
        riskLevel: vpRiskLevel,
        isHuman: false,
      });
    }

    // Sort by net worth (descending)
    allPlayers.sort((a, b) => b.netWorth - a.netWorth);

    // Find player's ranking
    const playerRanking = allPlayers.findIndex(p => p.isHuman) + 1;

    return {
      playerRanking,
      playerNetWorth,
      playerProfit,
      playerRiskLevel,
      allPlayersRanked: allPlayers,
    };
  }, [portfolio, stocks, playerTotalDebt, playerPendingInterest, initialCash, virtualPlayers, cyclesSinceLastInterestCharge, calculateRiskLevel, calculateVPRiskLevel, shortPositions]);

  const handleUpdatePrices = useCallback(() => {
    // 1. Update sector momentum based on current stock performance
    dispatch(updateSectorState(stocks));

    // 2. Calculate market metrics for phase decisions
    const marketMetrics = calculateMarketMetrics(stocks);

    // 3. Calculate volatility multipliers based on current phases
    const volatilityMultipliers: Record<string, number> = {};
    for (const stock of stocks) {
      volatilityMultipliers[stock.symbol] = getVolatilityMultiplier(
        stock.symbol,
        globalPhase,
        sectorPhases
      );
    }

    // 4. Generate new candles with sector influences and volatility multipliers
    dispatch(updatePrices({
      sectorInfluences,
      volatilityMultipliers,
    }));

    // 3. Check and apply stock splits (when price > $750)
    dispatch(checkAndApplyStockSplits());

    // 4. Let virtual players trade
    dispatch(executeVirtualTrades());

    // 5. Execute pending orders (AFTER price changes and VP trades)
    //    This means market orders execute at the NEW price, not the old one
    dispatch(executePendingOrders());

    // 6. Rebalance Market Maker inventory (slowly returns to base level)
    dispatch(rebalanceInventory());

    // 6b. Tick order book cycles (expire old VP orders)
    dispatch(tickOrderBookCycles());

    // 7. Process loan interest (increment counter, charge if threshold reached)
    dispatch(incrementInterestCycleCounter());
    if (shouldChargeInterest) {
      dispatch(chargeInterest());
    }

    // Helper to generate loan display name (e.g., "K#I", "L#II")
    const getLoanName = (loan: Loan): string => {
      const abbreviation = t('loans.loanAbbreviation');
      return `${abbreviation}#${toRomanNumeral(loan.loanNumber)}`;
    };

    // 8. Process loan maturity and cycles
    // First, check for loans that are about to be due (warning) - only shows once per loan
    for (const loan of loansDueSoon) {
      const loanName = getLoanName(loan);
      dispatch(addNotification({
        type: 'warning',
        title: t('loans.notifications.dueSoonTitle'),
        message: t('loans.notifications.dueSoonMessage', {
          loanName,
          amount: loan.principal.toLocaleString(),
          cycles: loan.remainingCycles,
        }),
        autoDismissMs: 8000,
        loanId: loan.id,
      }));
      // Mark loan as warned to prevent duplicate warnings
      dispatch(markLoanWarningShown(loan.id));
    }

    // Then, process loans that are due NOW (before decrementing cycles)
    for (const loan of loansDueNow) {
      const loanName = getLoanName(loan);
      const availableCash = portfolio.cash;
      const amountToRepay = loan.balance;

      if (availableCash >= amountToRepay) {
        // Full repayment possible
        dispatch(deductCash(amountToRepay));
        dispatch(processLoanMaturity({
          loanId: loan.id,
          amountRepaid: amountToRepay,
          wasFullyRepaid: true,
        }));
        dispatch(addNotification({
          type: 'success',
          title: t('loans.notifications.repaidTitle'),
          message: t('loans.notifications.repaidMessage', {
            loanName,
            amount: amountToRepay.toLocaleString(undefined, { minimumFractionDigits: 2 }),
          }),
          autoDismissMs: 6000,
          loanId: loan.id,
        }));
      } else {
        // Partial repayment - loan becomes overdue
        if (availableCash > 0) {
          dispatch(deductCash(availableCash));
        }
        dispatch(processLoanMaturity({
          loanId: loan.id,
          amountRepaid: availableCash,
          wasFullyRepaid: false,
        }));
        const remainingDebt = amountToRepay - availableCash;
        dispatch(addNotification({
          type: 'error',
          title: t('loans.notifications.overdueTitle'),
          message: t('loans.notifications.overdueMessage', {
            loanName,
            amount: remainingDebt.toLocaleString(undefined, { minimumFractionDigits: 2 }),
          }),
          autoDismissMs: 0, // Don't auto-dismiss errors
          loanId: loan.id,
        }));
      }
    }

    // Finally, decrement loan cycles (for loans not yet due)
    if (allLoans.length > 0) {
      dispatch(decrementLoanCycles());
    }

    // =========================================================================
    // SHORT SELLING PROCESSING
    // =========================================================================

    if (SHORT_SELLING_CONFIG.enabled && shortPositions.length > 0) {
      // Build prices map for short position calculations
      const pricesMap: Record<string, number> = {};
      for (const stock of stocks) {
        pricesMap[stock.symbol] = stock.currentPrice;
      }

      // 8a. Charge borrow fees for all short positions
      dispatch(chargeBorrowFees({
        prices: pricesMap,
        floats,
        totalShortsBySymbol,
      }));

      // Calculate total borrow fees for this cycle and deduct from cash
      let totalBorrowFeesThisCycle = 0;
      for (const position of shortPositions) {
        const currentPrice = pricesMap[position.symbol] ?? position.entryPrice;
        const positionValue = position.shares * currentPrice;
        const shortInterest = totalShortsBySymbol[position.symbol] ?? position.shares;
        const floatInfo = floats[position.symbol];
        const isHardToBorrow = floatInfo
          ? shortInterest / floatInfo.totalFloat >= SHORT_SELLING_CONFIG.hardToBorrowThreshold
          : false;
        const baseFee = positionValue * SHORT_SELLING_CONFIG.baseBorrowFeePerCycle;
        const fee = isHardToBorrow ? baseFee * SHORT_SELLING_CONFIG.hardToBorrowFeeMultiplier : baseFee;
        totalBorrowFeesThisCycle += fee;
      }

      if (totalBorrowFeesThisCycle > 0) {
        dispatch(deductCash(totalBorrowFeesThisCycle));
      }

      // 8b. Update margin call statuses
      dispatch(updateMarginCallStatuses({ prices: pricesMap }));

      // 8c. Check for new margin calls and notify
      const currentMarginCallSymbols = new Set(marginCallStatuses.map(s => s.symbol));

      for (const status of marginCallStatuses) {
        if (status.cyclesRemaining === SHORT_SELLING_CONFIG.marginCallGraceCycles) {
          // New margin call - notify player
          dispatch(addNotification({
            type: 'error',
            title: t('shorts.notifications.marginCallTitle'),
            message: t('shorts.notifications.marginCallMessage', {
              symbol: status.symbol,
              cycles: status.cyclesRemaining,
            }),
            autoDismissMs: 0, // Don't auto-dismiss margin calls
            marginCallSymbol: status.symbol,
          }));
        } else if (status.cyclesRemaining === 1) {
          // Warning: forced cover imminent
          dispatch(addNotification({
            type: 'warning',
            title: t('shorts.notifications.forcedCoverWarningTitle'),
            message: t('shorts.notifications.forcedCoverWarningMessage', {
              symbol: status.symbol,
            }),
            autoDismissMs: 8000,
          }));
        }
      }

      // 8c2. Dismiss margin call notifications for positions no longer in margin call
      // (e.g., player added margin or price moved favorably)
      for (const position of shortPositions) {
        if (!currentMarginCallSymbols.has(position.symbol)) {
          dispatch(dismissNotificationsForMarginCall(position.symbol));
        }
      }

      // 8d. Execute forced covers for positions that exhausted grace period
      for (const symbol of positionsForForcedCover) {
        const position = shortPositions.find(p => p.symbol === symbol);
        if (!position) continue;

        const currentPrice = pricesMap[symbol] ?? position.entryPrice;

        // Close position at current market price
        dispatch(closeShortPosition({
          symbol,
          shares: position.shares,
          exitPrice: currentPrice,
        }));

        // Deduct the cost of covering from cash
        const coverCost = position.shares * currentPrice;
        dispatch(deductCash(coverCost));

        // Add proceeds from collateral release (happens in closeShortPosition)
        // Calculate P/L and notify
        const realizedPL = (position.entryPrice - currentPrice) * position.shares - position.totalBorrowFeesPaid;

        // Dismiss the margin call notification for this symbol
        dispatch(dismissNotificationsForMarginCall(symbol));

        dispatch(addNotification({
          type: 'error',
          title: t('shorts.notifications.forcedCoverTitle'),
          message: t('shorts.notifications.forcedCoverMessage', {
            symbol,
            shares: position.shares,
            pl: realizedPL.toLocaleString(undefined, { minimumFractionDigits: 2 }),
          }),
          autoDismissMs: 0,
        }));
      }
    }

    // =========================================================================
    // END SHORT SELLING PROCESSING
    // =========================================================================

    // 9. Reset traded stocks for new cycle
    dispatch(resetTradedSymbols());

    // 9b. Tick notification cycles (auto-dismiss cycle-based notifications)
    dispatch(tickNotificationCycles());

    // =========================================================================
    // MARKET PHASE DYNAMICS
    // =========================================================================

    // 10. Increment phase cycles counter
    dispatch(incrementPhaseCycles());

    // 11. Check for sector-specific overheating, crashes, and phase transitions
    const SECTORS: Sector[] = ['tech', 'finance', 'industrial', 'commodities'];
    // Track updated sector phases for global phase calculation
    const updatedSectorPhases = { ...sectorPhases };

    for (const sector of SECTORS) {
      // Check if sector is overheated
      if (marketMetrics.sectorOverheated[sector]) {
        // Increment overheat counter
        const newOverheatCycles = overheatCycles[sector] + 1;
        dispatch(setOverheatCycles({ sector, cycles: newOverheatCycles }));

        // Check for crash trigger
        const crashResult = checkCrashTrigger(sector, newOverheatCycles, stocks);
        if (crashResult.shouldCrash) {
          // Trigger sector crash
          dispatch(triggerSectorCrash(sector));
          // Track the panic phase for global calculation
          updatedSectorPhases[sector] = 'panic';

          // Note: Price drops are naturally reflected through the panic phase's
          // negative momentum and high volatility in subsequent cycles

          // Notify about crash
          dispatch(addNotification({
            type: 'error',
            title: t('market.crashTitle', { sector: t(`sectors.${sector}`) }),
            message: t('market.crashMessage', {
              sector: t(`sectors.${sector}`),
              impact: Math.round(crashResult.crashImpact * 100),
            }),
            autoDismissMs: 10000,
          }));
        }
      } else {
        // Reset overheat counter if no longer overheated
        if (overheatCycles[sector] > 0) {
          dispatch(setOverheatCycles({ sector, cycles: 0 }));
        }
      }

      // Check for sector phase transition (independent of global)
      // Skip if sector just crashed (already set to panic)
      if (updatedSectorPhases[sector] !== 'panic' || sectorPhases[sector] === 'panic') {
        const newSectorPhase = checkSectorPhaseTransition(
          sector,
          sectorPhases[sector],
          cyclesInSectorPhase[sector],
          marketMetrics.sectorMomentum[sector]
        );
        if (newSectorPhase) {
          dispatch(setSectorPhase({ sector, phase: newSectorPhase }));
          // Track the new phase for global calculation
          updatedSectorPhases[sector] = newSectorPhase;
        }
      }
    }

    // 12. Calculate global phase as average of sector phases (no independent transition)
    // Use the tracked updated sector phases which reflect changes from this cycle
    const calculatedGlobalPhase = calculateGlobalPhaseFromSectors(updatedSectorPhases);
    if (calculatedGlobalPhase !== globalPhase) {
      dispatch(setGlobalPhase(calculatedGlobalPhase));
    }

    // 13. Update Fear & Greed Index
    const newFearGreedIndex = calculateFearGreedIndex(globalPhase, marketMetrics, stocks);
    dispatch(setFearGreedIndex(newFearGreedIndex));

    // =========================================================================
    // END MARKET PHASE DYNAMICS
    // =========================================================================

    // 14. Record current phase for game summary statistics
    dispatch(recordPhaseCycle());

    // 15. Increment game cycle counter
    dispatch(incrementCycle());

    // 16. Check if timed game has ended
    const newCycle = currentCycle + 1;
    if (gameDuration !== null && newCycle >= gameDuration) {
      const stats = calculateEndGameStats();
      dispatch(endGame(stats));
    }

    dispatch(resetCountdown());
  }, [dispatch, stocks, sectorInfluences, shouldChargeInterest, currentCycle, gameDuration, calculateEndGameStats, loansDueSoon, loansDueNow, allLoans, portfolio.cash, globalPhase, sectorPhases, cyclesInSectorPhase, overheatCycles, shortPositions, marginCallStatuses, positionsForForcedCover, totalShortsBySymbol, floats, t]);

  // Timestamp-based timer to keep countdown and cycle in sync
  // When paused, we store the remaining time and restore it when resumed
  const nextCycleTimeRef = useRef<number>(0);
  const remainingMsRef = useRef<number>(effectiveInterval * 1000);
  const lastCountdownRef = useRef<number>(-1);
  const wasEffectivelyPausedRef = useRef<boolean>(true);

  // Unified timer effect - handles both countdown updates and cycle execution
  useEffect(() => {
    // Handle transition from paused to running
    if (!isEffectivelyPaused && wasEffectivelyPausedRef.current) {
      // Starting or resuming: set next cycle time based on remaining time
      nextCycleTimeRef.current = Date.now() + remainingMsRef.current;
    }

    // Handle transition from running to paused
    if (isEffectivelyPaused && !wasEffectivelyPausedRef.current) {
      // Pausing: store remaining time
      remainingMsRef.current = Math.max(0, nextCycleTimeRef.current - Date.now());
    }

    wasEffectivelyPausedRef.current = isEffectivelyPaused;

    if (isEffectivelyPaused) return;

    // Single interval that handles both countdown and cycle execution
    const timerInterval = setInterval(() => {
      const now = Date.now();
      const remainingMs = nextCycleTimeRef.current - now;

      // Check if cycle should execute FIRST (before updating countdown)
      if (remainingMs <= 0) {
        // Execute cycle
        handleUpdatePrices();

        // Set next cycle time (from now, not from previous target, to avoid drift accumulation)
        const intervalMs = effectiveInterval * 1000;
        nextCycleTimeRef.current = now + intervalMs;
        remainingMsRef.current = intervalMs;
        lastCountdownRef.current = -1; // Force countdown update
      } else {
        // Calculate countdown as float for smooth progress (e.g., 2.8 seconds)
        // Round to 1 decimal place to avoid excessive re-renders
        const newCountdown = Math.round(Math.max(0, remainingMs / 100)) / 10;

        // Only dispatch if countdown changed
        if (newCountdown !== lastCountdownRef.current) {
          lastCountdownRef.current = newCountdown;
          dispatch(setCountdown(newCountdown));
        }
      }
    }, 200); // Check every 200ms for smooth countdown updates (balance between smoothness and performance)

    return () => clearInterval(timerInterval);
  }, [isEffectivelyPaused, effectiveInterval, handleUpdatePrices, dispatch]);

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

  // Calculate remaining cycles and progress
  const remainingCycles = gameDuration !== null ? Math.max(0, gameDuration - currentCycle) : null;
  const gameProgress = gameDuration !== null ? Math.min(1, currentCycle / gameDuration) : null;

  return {
    effectiveInterval,
    isEffectivelyPaused,
    countdown,
    isPaused,
    speedMultiplier,
    currentCycle,
    gameDuration,
    remainingCycles,
    gameProgress,
    isGameEnded,
    calculateEndGameStats,
  };
};

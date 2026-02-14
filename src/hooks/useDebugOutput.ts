import { useEffect, useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { selectTotalDebt, selectAllLoans } from '../store/loansSlice';
import { selectAllShortPositions, selectTotalLockedCollateral } from '../store/shortPositionsSlice';
import { selectAllPendingOrders } from '../store/pendingOrdersSlice';
import { selectAllTrades } from '../store/tradeHistorySlice';
import { selectCurrentCycle } from '../store/gameSessionSlice';
import { openDebugModal } from '../store/uiSlice';

/**
 * Debug Hook: Press Alt+D (Option+D on Mac) to open debug modal with portfolio JSON
 * For developers only - not documented
 */
export const useDebugOutput = () => {
  const dispatch = useAppDispatch();
  const portfolio = useAppSelector(state => state.portfolio);
  const stocks = useAppSelector(state => state.stocks.items);
  const loans = useAppSelector(selectAllLoans);
  const totalDebt = useAppSelector(selectTotalDebt);
  const shortPositions = useAppSelector(selectAllShortPositions);
  const totalLockedCollateral = useAppSelector(selectTotalLockedCollateral);
  const pendingOrders = useAppSelector(selectAllPendingOrders);
  const tradeHistory = useAppSelector(selectAllTrades);
  const currentCycle = useAppSelector(selectCurrentCycle);

  const handleDebugOutput = useCallback(() => {
    // Calculate holdings with current values
    const holdings = portfolio.holdings.map(holding => {
      const stock = stocks.find(s => s.symbol === holding.symbol);
      const currentPrice = stock?.currentPrice ?? 0;
      const totalValue = currentPrice * holding.shares;
      return {
        symbol: holding.symbol,
        shares: holding.shares,
        avgBuyPrice: holding.avgBuyPrice,
        currentPrice,
        totalValue,
      };
    });

    // Calculate total stock value
    const stockValue = holdings.reduce((sum, h) => sum + h.totalValue, 0);

    // Format loans
    const loansData = loans.map(loan => ({
      id: loan.id,
      loanNumber: loan.loanNumber,
      principal: loan.principal,
      balance: loan.balance,
      interestRate: loan.interestRate,
      durationCycles: loan.durationCycles,
      remainingCycles: loan.remainingCycles,
      isOverdue: loan.isOverdue,
      overdueForCycles: loan.overdueForCycles,
    }));

    // Format short positions with current prices and P/L
    const shortsData = shortPositions.map(position => {
      const stock = stocks.find(s => s.symbol === position.symbol);
      const currentPrice = stock?.currentPrice ?? position.entryPrice;
      const unrealizedPL = (position.entryPrice - currentPrice) * position.shares - position.totalBorrowFeesPaid;
      return {
        symbol: position.symbol,
        shares: position.shares,
        entryPrice: position.entryPrice,
        currentPrice,
        collateralLocked: position.collateralLocked,
        totalBorrowFeesPaid: position.totalBorrowFeesPaid,
        unrealizedPL,
      };
    });

    // Format pending orders
    const ordersData = pendingOrders.map(order => ({
      symbol: order.symbol,
      type: order.type,
      orderType: order.orderType,
      shares: order.shares,
      orderPrice: order.orderPrice,
      limitPrice: order.limitPrice,
      stopPrice: order.stopPrice,
      remainingCycles: order.remainingCycles,
    }));

    // Format trade history
    const tradesData = tradeHistory.slice(0, 50).map(trade => ({
      id: trade.id,
      symbol: trade.symbol,
      type: trade.type,
      shares: trade.shares,
      pricePerShare: trade.pricePerShare,
      totalAmount: trade.totalAmount,
      cycle: trade.cycle,
      status: trade.status ?? 'executed',
      realizedProfitLoss: trade.realizedProfitLoss,
    }));

    const debugData = {
      currentCycle,
      cash: portfolio.cash,
      stockValue,
      totalDebt,
      totalLockedCollateral,
      netWorth: portfolio.cash + stockValue - totalDebt,
      holdings,
      loans: loansData,
      shorts: shortsData,
      pendingOrders: ordersData,
      tradeHistory: tradesData,
    };

    // Open debug modal with formatted JSON
    dispatch(openDebugModal(JSON.stringify(debugData, null, 2)));
  }, [dispatch, portfolio, stocks, loans, totalDebt, shortPositions, totalLockedCollateral, pendingOrders, tradeHistory, currentCycle]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      // Alt+D (Option+D on Mac)
      if (event.altKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        handleDebugOutput();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleDebugOutput]);
};

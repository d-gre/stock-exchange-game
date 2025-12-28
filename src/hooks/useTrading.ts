import { useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { applyTrade } from '../store/stocksSlice';
import { buyStock, sellStock } from '../store/portfolioSlice';
import { selectStock, openTradeModal, closeTradeModal, setChartTab } from '../store/uiSlice';
import { addPendingOrder, cancelOrder, markSymbolAsTraded, selectAllPendingOrders } from '../store/pendingOrdersSlice';
import { addCompletedTrade } from '../store/tradeHistorySlice';
import { calculateTradeExecution } from '../utils/tradingMechanics';
import { TRADING_MECHANICS } from '../config';
import type { PendingOrder, CompletedTrade, GameMode, Stock, Portfolio } from '../types';
import type { OrderData } from '../components/TradePanel';

interface UseTradingOptions {
  stocks: Stock[];
  portfolio: Portfolio;
  gameMode: GameMode;
}

interface UseTradingReturn {
  /** Currently edited order */
  editingOrder: PendingOrder | null;
  /** Opens the Trade-Panel for a stock */
  handleTrade: (symbol: string, type: 'buy' | 'sell') => void;
  /** Cancels an order */
  handleCancelOrder: (orderId: string) => void;
  /** Opens the Trade-Panel to edit an order */
  handleEditOrder: (order: PendingOrder) => void;
  /** Callback for failed orders - edit */
  handleEditFailedOrder: (orderId: string, symbol: string) => void;
  /** Callback for failed orders - delete */
  handleDeleteFailedOrder: (orderId: string) => void;
  /** Closes the Trade-Panel */
  handleCloseTradePanel: () => void;
  /** Executes a trade */
  executeTrade: (orderData: OrderData) => void;
}

/**
 * Hook for trading logic
 * Manages Trade-Panel, order editing and trade execution
 */
export const useTrading = ({
  stocks,
  portfolio,
  gameMode,
}: UseTradingOptions): UseTradingReturn => {
  const dispatch = useAppDispatch();
  const [editingOrder, setEditingOrder] = useState<PendingOrder | null>(null);
  const pendingOrders = useAppSelector(selectAllPendingOrders);

  const mechanics = TRADING_MECHANICS[gameMode];

  const handleTrade = useCallback((symbol: string, type: 'buy' | 'sell'): void => {
    dispatch(selectStock(symbol));
    dispatch(setChartTab('stock'));
    dispatch(openTradeModal({ symbol, type }));
  }, [dispatch]);

  const handleCancelOrder = useCallback((orderId: string): void => {
    dispatch(cancelOrder(orderId));
  }, [dispatch]);

  const handleEditOrder = useCallback((order: PendingOrder): void => {
    setEditingOrder(order);
    dispatch(selectStock(order.symbol));
    dispatch(setChartTab('stock'));
    dispatch(openTradeModal({ symbol: order.symbol, type: order.type }));
  }, [dispatch]);

  const handleEditFailedOrder = useCallback((orderId: string, symbol: string): void => {
    const order = pendingOrders.find(o => o.id === orderId);
    if (order) {
      setEditingOrder(order);
      dispatch(selectStock(order.symbol));
      dispatch(setChartTab('stock'));
      dispatch(openTradeModal({ symbol: order.symbol, type: order.type }));
    } else {
      dispatch(selectStock(symbol));
      dispatch(setChartTab('stock'));
      dispatch(openTradeModal({ symbol, type: 'buy' }));
    }
  }, [dispatch, pendingOrders]);

  const handleDeleteFailedOrder = useCallback((orderId: string): void => {
    dispatch(cancelOrder(orderId));
  }, [dispatch]);

  const handleCloseTradePanel = useCallback((): void => {
    setEditingOrder(null);
    dispatch(closeTradeModal());
  }, [dispatch]);

  const executeTrade = useCallback((orderData: OrderData): void => {
    const { symbol, type, shares, orderType, limitPrice, stopPrice, validityCycles } = orderData;
    const stock = stocks.find(s => s.symbol === symbol);
    if (!stock) return;

    // When editing: Cancel old order first
    if (editingOrder) {
      dispatch(cancelOrder(editingOrder.id));
      setEditingOrder(null);
    }

    // Non-market orders or orders with delay are created as pending orders
    const needsPendingOrder = orderType !== 'market' || mechanics.orderDelayCycles > 0;

    if (needsPendingOrder) {
      dispatch(addPendingOrder({
        symbol,
        type,
        shares,
        orderType,
        orderPrice: stock.currentPrice,
        limitPrice,
        stopPrice,
        validityCycles: orderType === 'market' ? mechanics.orderDelayCycles : validityCycles,
      }));
      dispatch(markSymbolAsTraded(symbol));
      return;
    }

    // Immediate execution (only market orders without delay)
    const execution = calculateTradeExecution(stock.currentPrice, shares, type, mechanics);
    const totalPricePerShare = execution.total / shares;

    // For sales: Calculate average buy price and realized profit/loss
    const holding = portfolio.holdings.find(h => h.symbol === symbol);
    let realizedProfitLoss: number | undefined;
    let avgBuyPrice: number | undefined;

    if (type === 'sell' && holding) {
      avgBuyPrice = holding.avgBuyPrice;
      realizedProfitLoss = (totalPricePerShare - avgBuyPrice) * shares;
    }

    if (type === 'buy') {
      dispatch(buyStock({
        symbol,
        shares,
        price: totalPricePerShare,
      }));
    } else {
      dispatch(sellStock({
        symbol,
        shares,
        price: totalPricePerShare,
      }));
    }

    // Add trade to history
    const completedTrade: CompletedTrade = {
      id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      symbol,
      type,
      shares,
      pricePerShare: totalPricePerShare,
      totalAmount: execution.total,
      timestamp: Date.now(),
      realizedProfitLoss,
      avgBuyPrice,
    };
    dispatch(addCompletedTrade(completedTrade));

    // Apply market impact
    dispatch(applyTrade({ symbol, type, shares }));

    // Mark stock as traded in this cycle
    dispatch(markSymbolAsTraded(symbol));
  }, [stocks, portfolio.holdings, mechanics, editingOrder, dispatch]);

  return {
    editingOrder,
    handleTrade,
    handleCancelOrder,
    handleEditOrder,
    handleEditFailedOrder,
    handleDeleteFailedOrder,
    handleCloseTradePanel,
    executeTrade,
  };
};

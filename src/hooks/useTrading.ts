import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { selectStock, openTradeModal, closeTradeModal, setChartTab, type TradeType } from '../store/uiSlice';
import { addPendingOrder, cancelOrder, markSymbolAsTraded, selectAllPendingOrders } from '../store/pendingOrdersSlice';
import { dismissNotificationsForOrder, addNotification } from '../store/notificationsSlice';
import { selectAllShortPositions, addCollateral } from '../store/shortPositionsSlice';
import { deductCash } from '../store/portfolioSlice';
import { formatCurrency, getFormatLocale } from '../utils/formatting';
import type { PendingOrder, Stock } from '../types';
import type { OrderData } from '../components/TradePanel';

interface UseTradingOptions {
  stocks: Stock[];
}

interface UseTradingReturn {
  /** Currently edited order */
  editingOrder: PendingOrder | null;
  /** Opens the Trade-Panel for a stock */
  handleTrade: (symbol: string, type: TradeType) => void;
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
}: UseTradingOptions): UseTradingReturn => {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const [editingOrder, setEditingOrder] = useState<PendingOrder | null>(null);
  const pendingOrders = useAppSelector(selectAllPendingOrders);
  const shortPositions = useAppSelector(selectAllShortPositions);

  const handleTrade = useCallback((symbol: string, type: TradeType): void => {
    dispatch(selectStock(symbol));
    dispatch(setChartTab('stock'));
    dispatch(openTradeModal({ symbol, type }));
  }, [dispatch]);

  const handleCancelOrder = useCallback((orderId: string): void => {
    dispatch(cancelOrder(orderId));
    dispatch(dismissNotificationsForOrder(orderId));
  }, [dispatch]);

  const handleEditOrder = useCallback((order: PendingOrder): void => {
    setEditingOrder(order);
    dispatch(selectStock(order.symbol));
    dispatch(setChartTab('stock'));
    dispatch(openTradeModal({ symbol: order.symbol, type: order.type }));
    dispatch(dismissNotificationsForOrder(order.id));
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
    const { symbol, type, shares, orderType, limitPrice, stopPrice, validityCycles, loanRequest, collateralToLock, marginAmount } = orderData;
    const stock = stocks.find(s => s.symbol === symbol);
    if (!stock) return;

    // Add margin is executed immediately (no pending order needed)
    if (type === 'addMargin' && marginAmount && marginAmount > 0) {
      const locale = getFormatLocale(i18n.language);
      dispatch(deductCash(marginAmount));
      dispatch(addCollateral({ symbol, amount: marginAmount }));
      dispatch(addNotification({
        type: 'success',
        title: t('shorts.addMargin'),
        message: t('shorts.marginAdded', { symbol, amount: formatCurrency(marginAmount, 0, locale) }),
        autoDismissMs: 5000,
      }));
      return;
    }

    // Short sell and buy to cover orders now go through the pending order system
    // They execute after 1 cycle delay like regular orders
    if (type === 'shortSell') {
      // Track if this is an edit (before we cancel the old order)
      const isEdit = !!editingOrder;

      // When editing: Cancel old order first
      if (editingOrder) {
        dispatch(cancelOrder(editingOrder.id));
        setEditingOrder(null);
      }

      dispatch(addPendingOrder({
        symbol,
        type: 'shortSell',
        shares,
        orderType,
        orderPrice: stock.currentPrice,
        limitPrice,
        stopPrice,
        // Market orders always execute in the next cycle (validityCycles: 1)
        validityCycles: orderType === 'market' ? 1 : validityCycles,
        isEdit,
        collateralToLock,
      }));
      dispatch(markSymbolAsTraded(symbol));
      return;
    }

    if (type === 'buyToCover') {
      // Get the short position to verify it exists
      const shortPosition = shortPositions.find(p => p.symbol === symbol);
      if (!shortPosition) return;

      // Track if this is an edit (before we cancel the old order)
      const isEdit = !!editingOrder;

      // When editing: Cancel old order first
      if (editingOrder) {
        dispatch(cancelOrder(editingOrder.id));
        setEditingOrder(null);
      }

      dispatch(addPendingOrder({
        symbol,
        type: 'buyToCover',
        shares,
        orderType,
        orderPrice: stock.currentPrice,
        limitPrice,
        stopPrice,
        // Market orders always execute in the next cycle (validityCycles: 1)
        validityCycles: orderType === 'market' ? 1 : validityCycles,
        isEdit,
      }));
      dispatch(markSymbolAsTraded(symbol));
      return;
    }

    // Track if this is an edit (before we cancel the old order)
    const isEdit = !!editingOrder;

    // When editing: Cancel old order first
    if (editingOrder) {
      dispatch(cancelOrder(editingOrder.id));
      setEditingOrder(null);
    }

    // All orders are created as pending orders
    // Market orders execute at the start of the NEXT cycle (after virtual players have traded)
    // This ensures market orders get the price after VP trades have influenced it
    // Type assertion is safe: addMargin, shortSell, buyToCover all return early above
    dispatch(addPendingOrder({
      symbol,
      type: type as 'buy' | 'sell',
      shares,
      orderType,
      orderPrice: stock.currentPrice,
      limitPrice,
      stopPrice,
      // Market orders always execute in the next cycle (validityCycles: 1)
      // Other order types use the user-specified validity
      validityCycles: orderType === 'market' ? 1 : validityCycles,
      isEdit,
      loanRequest,
    }));
    dispatch(markSymbolAsTraded(symbol));
  }, [stocks, editingOrder, dispatch, shortPositions, t, i18n]);

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

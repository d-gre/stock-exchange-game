import { useState, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useClickOutside } from '../hooks/useClickOutside';
import type { Stock, Portfolio, GameMode, OrderType, TradeExecution, PendingOrder } from '../types';
import { BUY_ORDER_TYPES, SELL_ORDER_TYPES, TRADING_MECHANICS, DEFAULT_ORDER_VALIDITY_CYCLES } from '../config';
import { calculateTradeExecution } from '../utils/tradingMechanics';

/** Data for an advanced order */
export interface OrderData {
  symbol: string;
  type: 'buy' | 'sell';
  shares: number;
  orderType: OrderType;
  limitPrice?: number;
  stopPrice?: number;
  validityCycles: number;
}

interface TradePanelProps {
  stock: Stock | null;
  tradeType: 'buy' | 'sell';
  portfolio: Portfolio;
  gameMode: GameMode;
  isSymbolTradedThisCycle: boolean;
  /** Reserved cash for pending buy orders */
  reservedCash: number;
  /** Reserved shares of this symbol for pending sell orders */
  reservedSharesForSymbol: number;
  /** Order being edited (for edit mode) */
  editingOrder?: PendingOrder;
  onClose: () => void;
  onTrade: (orderData: OrderData) => void;
}

export const TradePanel = ({ stock, tradeType, portfolio, gameMode, isSymbolTradedThisCycle, reservedCash, reservedSharesForSymbol, editingOrder, onClose, onTrade }: TradePanelProps) => {
  const { t, i18n } = useTranslation();

  const formatCurrency = useCallback((value: number): string => {
    return value.toLocaleString(i18n.language === 'de' ? 'de-DE' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [i18n.language]);

  const formatNumber = (value: number): string => {
    return value.toLocaleString(i18n.language === 'de' ? 'de-DE' : 'en-US');
  };

  // Initialize values from editingOrder (for edit mode)
  const [shares, setShares] = useState(editingOrder?.shares ?? 0);
  const [error, setError] = useState('');
  const [orderType, setOrderType] = useState<OrderType>(editingOrder?.orderType ?? 'market');
  const [orderTypeOpen, setOrderTypeOpen] = useState(false);
  const [validityCycles, setValidityCycles] = useState(
    editingOrder?.remainingCycles ?? DEFAULT_ORDER_VALIDITY_CYCLES
  );
  const [limitPrice, setLimitPrice] = useState<number | ''>(editingOrder?.limitPrice ?? '');
  const [stopPrice, setStopPrice] = useState<number | ''>(editingOrder?.stopPrice ?? '');
  const panelRef = useRef<HTMLDivElement>(null);
  const orderTypeRef = useRef<HTMLDivElement>(null);

  const isEditMode = !!editingOrder;

  const showAdvancedOptions = gameMode !== 'sandbox';
  const orderTypes = tradeType === 'buy' ? BUY_ORDER_TYPES : SELL_ORDER_TYPES;

  // Which price inputs are needed?
  const needsLimitPrice = orderType === 'limit' || orderType === 'stopBuyLimit';
  const needsStopPrice = orderType === 'stopBuy' || orderType === 'stopBuyLimit';

  // Validation for stop limit orders
  const stopLimitValidation = useMemo(() => {
    if (orderType !== 'stopBuyLimit') return { isValid: true, warning: '' };
    if (limitPrice === '' || stopPrice === '') return { isValid: true, warning: '' };

    const limit = limitPrice as number;
    const stop = stopPrice as number;

    if (tradeType === 'buy') {
      // Stop Buy Limit: Order is triggered when price >= stop, then only buys when price <= limit
      // Limit must be > stop, otherwise the order can never be meaningfully executed
      if (limit <= stop) {
        return {
          isValid: false,
          warning: t('trading.invalidStopBuyLimit', { limit: formatCurrency(limit), stop: formatCurrency(stop) }),
        };
      }
    } else {
      // Stop Loss Limit: Order is triggered when price <= stop, then only sells when price >= limit
      // Limit must be < stop, otherwise the order can never be meaningfully executed
      if (limit >= stop) {
        return {
          isValid: false,
          warning: t('trading.invalidStopLossLimit', { limit: formatCurrency(limit), stop: formatCurrency(stop) }),
        };
      }
    }

    return { isValid: true, warning: '' };
  }, [orderType, limitPrice, stopPrice, tradeType, t, formatCurrency]);

  const mechanics = TRADING_MECHANICS[gameMode];
  const holding = portfolio.holdings.find(h => h.symbol === stock?.symbol);
  const ownedShares = holding?.shares ?? 0;

  // In edit mode: Release the reserved amounts of the order being edited
  // (since the old order will be replaced)
  const editingOrderReservedCash = editingOrder?.type === 'buy'
    ? editingOrder.shares * editingOrder.orderPrice
    : 0;
  const editingOrderReservedShares = editingOrder?.type === 'sell'
    ? editingOrder.shares
    : 0;

  // Available shares = owned shares - reserved shares + reserved shares of the order being edited
  const availableShares = Math.max(0, ownedShares - reservedSharesForSymbol + editingOrderReservedShares);
  // Available cash = total cash - reserved cash + reserved cash of the order being edited
  const availableCash = Math.max(0, portfolio.cash - reservedCash + editingOrderReservedCash);
  const maxSellShares = availableShares;

  // Calculate trade execution with all costs
  const tradeExecution: TradeExecution | null = useMemo(() => {
    if (!stock || shares <= 0) return null;
    return calculateTradeExecution(stock.currentPrice, shares, tradeType, mechanics);
  }, [stock, shares, tradeType, mechanics]);

  // Max purchasable shares considering spread, slippage, and fees
  const maxBuyShares = useMemo(() => {
    if (!stock) return 0;
    // Binary search for the maximum quantity
    let low = 0;
    let high = Math.floor(availableCash / stock.currentPrice) + 10;
    let result = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (mid === 0) {
        low = mid + 1;
        continue;
      }
      const execution = calculateTradeExecution(stock.currentPrice, mid, 'buy', mechanics);
      if (execution.total <= availableCash) {
        result = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return result;
  }, [stock, availableCash, mechanics]);

  // Close dropdown when clicking outside
  useClickOutside(orderTypeRef, useCallback(() => setOrderTypeOpen(false), []));

  if (!stock) return null;

  const handleSubmit = (): void => {
    if (shares <= 0 || !tradeExecution) {
      setError(t('errors.invalidQuantity'));
      return;
    }

    if (tradeType === 'buy') {
      if (tradeExecution.total > availableCash) {
        setError(t('errors.insufficientCash'));
        return;
      }
    } else {
      if (shares > maxSellShares) {
        setError(t('errors.insufficientShares'));
        return;
      }
    }

    // Validate limit price
    if (needsLimitPrice && (limitPrice === '' || limitPrice <= 0)) {
      setError(t('errors.invalidLimitPrice'));
      return;
    }

    // Validate stop price
    if (needsStopPrice && (stopPrice === '' || stopPrice <= 0)) {
      setError(t('errors.invalidStopPrice'));
      return;
    }

    // Calculate validity cycles
    // Market orders are executed immediately, all others have a validity period
    const cycles = orderType === 'market' ? 0 : validityCycles;

    const orderData: OrderData = {
      symbol: stock.symbol,
      type: tradeType,
      shares,
      orderType,
      limitPrice: needsLimitPrice ? (limitPrice as number) : undefined,
      stopPrice: needsStopPrice ? (stopPrice as number) : undefined,
      validityCycles: cycles,
    };

    onTrade(orderData);
    onClose();
  };

  const handleMaxClick = (): void => {
    if (tradeType === 'buy') {
      setShares(maxBuyShares);
    } else {
      setShares(maxSellShares);
    }
  };

  const handleOrderTypeChange = (newType: OrderType): void => {
    setOrderType(newType);
    setOrderTypeOpen(false);

    if (!stock) return;

    // Set default prices based on new order type
    const newNeedsStopPrice = newType === 'stopBuy' || newType === 'stopBuyLimit';
    const newNeedsLimitPrice = newType === 'limit' || newType === 'stopBuyLimit';

    if (newNeedsStopPrice) {
      setStopPrice(Math.round(stock.currentPrice * 100) / 100);
    } else {
      setStopPrice('');
    }

    if (newNeedsLimitPrice) {
      // For stop limit orders: Set limit price with offset so validation is immediately satisfied
      if (newType === 'stopBuyLimit') {
        const offset = tradeType === 'buy' ? 0.01 : -0.01;
        setLimitPrice(Math.round(Math.max(0.01, stock.currentPrice + offset) * 100) / 100);
      } else {
        setLimitPrice(Math.round(stock.currentPrice * 100) / 100);
      }
    } else {
      setLimitPrice('');
    }
  };

  return (
    <div className={`trade-panel trade-panel--${tradeType}${isEditMode ? ' trade-panel--editing' : ''}`} ref={panelRef}>
      <div className="trade-panel__header">
        <h3>
          {isEditMode ? `${t('trading.editOrder')}: ` : (tradeType === 'buy' ? `${t('trading.buy')}: ` : `${t('trading.sell')}: `)}
          {stock.symbol}
        </h3>
        <button className="trade-panel__close-btn" onClick={onClose}>&times;</button>
      </div>

      <div className="trade-panel__body">
        <div className="trade-panel__stock-info">
          <p><strong>{stock.name}</strong></p>
          <p>{t('trading.currentPrice')}: <span className="trade-panel__price">${formatCurrency(stock.currentPrice)}</span></p>
        </div>

        <div className="trade-panel__trade-info">
          {tradeType === 'buy' ? (
            <>
              <p>{t('trading.availableCash')}: ${formatCurrency(availableCash)}</p>
              {reservedCash > 0 && (
                <p className="trade-panel__reserved-info">{t('trading.reservedForOrders')}: ${formatCurrency(reservedCash)}</p>
              )}
            </>
          ) : (
            <>
              <p>{t('trading.availableShares')}: {formatNumber(availableShares)}</p>
              {reservedSharesForSymbol > 0 && (
                <p className="trade-panel__reserved-info">{t('trading.reservedForOrders')}: {formatNumber(reservedSharesForSymbol)}</p>
              )}
            </>
          )}
        </div>

        <div className="trade-panel__input-group">
          <label>{t('trading.quantity')}:</label>
          <div className="trade-panel__input-with-btn">
            <input
              type="number"
              min="1"
              max={tradeType === 'buy' ? maxBuyShares : maxSellShares}
              value={shares}
              onChange={(e) => {
                setShares(Math.max(0, parseInt(e.target.value) || 0));
                setError('');
              }}
            />
            <button className="trade-panel__max-btn" onClick={handleMaxClick}>{t('common.max')}</button>
          </div>
        </div>

        {showAdvancedOptions && (
          <>
            <div className="trade-panel__input-group">
              <label>{t('trading.type')}:</label>
              <div className="trade-panel__order-type" ref={orderTypeRef}>
                <button
                  className={`trade-panel__order-type-trigger${orderTypeOpen ? ' trade-panel__order-type-trigger--open' : ''}`}
                  onClick={() => setOrderTypeOpen(!orderTypeOpen)}
                >
                  <span>{t(`orderTypes.${tradeType}.${orderType}`)}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7 10l5 5 5-5z"/>
                  </svg>
                </button>
                {orderTypeOpen && (
                  <div className="trade-panel__order-type-options">
                    {orderTypes.map((type) => (
                      <button
                        key={type.id}
                        className={`trade-panel__order-type-option${type.id === orderType ? ' trade-panel__order-type-option--active' : ''}`}
                        onClick={() => handleOrderTypeChange(type.id)}
                      >
                        {t(`orderTypes.${tradeType}.${type.id}`)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Stop-Preis Input */}
            {needsStopPrice && (
              <div className="trade-panel__input-group">
                <label>{t('trading.stopPrice')}:</label>
                <div className="trade-panel__price-input">
                  <span className="trade-panel__currency-symbol">$</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={stopPrice}
                    onChange={(e) => setStopPrice(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    placeholder={stock.currentPrice.toFixed(2)}
                  />
                </div>
                <span className="trade-panel__price-hint">
                  {tradeType === 'buy'
                    ? t('trading.stopHintBuy')
                    : t('trading.stopHintSell')}
                </span>
              </div>
            )}

            {/* Limit-Preis Input */}
            {needsLimitPrice && (
              <div className="trade-panel__input-group">
                <label>{t('trading.limitPrice')}:</label>
                <div className="trade-panel__price-input">
                  <span className="trade-panel__currency-symbol">$</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    placeholder={stock.currentPrice.toFixed(2)}
                  />
                </div>
                <span className="trade-panel__price-hint">
                  {tradeType === 'buy'
                    ? t('trading.limitHintBuy')
                    : t('trading.limitHintSell')}
                </span>
              </div>
            )}

            {/* Warning for invalid stop limit price combination */}
            {!stopLimitValidation.isValid && (
              <div className="trade-panel__stop-limit-warning">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                </svg>
                <span>{stopLimitValidation.warning}</span>
              </div>
            )}

            {orderType !== 'market' && (
              <div className="trade-panel__input-group">
                <label>{t('trading.validity')}:</label>
                <div className="trade-panel__validity-input">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={validityCycles}
                    onChange={(e) => setValidityCycles(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>
                <span className="trade-panel__price-hint">{t('trading.tradingCycles')}</span>
              </div>
            )}
          </>
        )}

        {tradeExecution && shares > 0 && (
          <div className="trade-panel__breakdown">
            <div className="trade-panel__breakdown-row">
              <span>{t('trading.rate')}:</span>
              <span>${formatCurrency(stock.currentPrice)}</span>
            </div>

            {/* Sandbox: Full transparency */}
            {gameMode === 'sandbox' && (
              <>
                <div className="trade-panel__breakdown-row">
                  <span>{t('trading.effectivePrice')}:</span>
                  <span className={tradeType === 'buy' ? 'trade-panel__breakdown-cost' : 'trade-panel__breakdown-gain'}>
                    ${formatCurrency(tradeExecution.effectivePrice)}
                  </span>
                </div>
                {(tradeExecution.breakdown.spreadCost !== 0 || tradeExecution.breakdown.slippageCost !== 0) && (
                  <div className="trade-panel__breakdown-details">
                    <div className="trade-panel__breakdown-row trade-panel__breakdown-row--small">
                      <span>{t('trading.spread')}:</span>
                      <span>${formatCurrency(Math.abs(tradeExecution.breakdown.spreadCost))}</span>
                    </div>
                    <div className="trade-panel__breakdown-row trade-panel__breakdown-row--small">
                      <span>{t('trading.slippage')}:</span>
                      <span>${formatCurrency(Math.abs(tradeExecution.breakdown.slippageCost))}</span>
                    </div>
                  </div>
                )}
                <div className="trade-panel__breakdown-row">
                  <span>{t('trading.subtotal')}:</span>
                  <span>${formatCurrency(tradeExecution.subtotal)}</span>
                </div>
              </>
            )}

            {/* Real Life / Hard Life: Only typical banking app info */}
            {gameMode !== 'sandbox' && (
              <div className="trade-panel__breakdown-row">
                <span>{t('trading.quantityTimesRate')}:</span>
                <span>${formatCurrency(stock.currentPrice * shares)}</span>
              </div>
            )}

            {tradeExecution.fee > 0 && (
              <div className="trade-panel__breakdown-row">
                <span>{t('trading.orderFee')}:</span>
                <span className="trade-panel__breakdown-fee">${formatCurrency(tradeExecution.fee)}</span>
              </div>
            )}

            <div className="trade-panel__breakdown-row trade-panel__breakdown-row--total">
              <span>{tradeType === 'buy' ? t('trading.totalCost') : t('trading.netProceeds')}:</span>
              <span className="trade-panel__total-value">
                {gameMode === 'sandbox' ? (
                  <>${formatCurrency(tradeExecution.total)}</>
                ) : (
                  <>{t('trading.approx')} ${formatCurrency(tradeExecution.total)}</>
                )}
              </span>
            </div>

            {gameMode !== 'sandbox' && orderType === 'market' && (
              <div className="trade-panel__breakdown-hint">
                {t('trading.priceDeviation')}
              </div>
            )}

            {gameMode !== 'sandbox' && orderType !== 'market' && (
              <div className="trade-panel__breakdown-hint">
                {t('trading.orderExecuteWhen')}
              </div>
            )}
          </div>
        )}

        {error && <p className="trade-panel__error">{error}</p>}
      </div>

      <div className="trade-panel__footer">
        <button className="trade-panel__cancel-btn" onClick={onClose}>{t('common.cancel')}</button>
        <button
          className={`trade-panel__confirm-btn trade-panel__confirm-btn--${tradeType}`}
          onClick={handleSubmit}
          disabled={(!isEditMode && isSymbolTradedThisCycle) || shares <= 0 || !stopLimitValidation.isValid || (tradeType === 'buy' ? shares > maxBuyShares : shares > maxSellShares)}
        >
          {isEditMode
            ? t('trading.updateOrder')
            : (orderType === 'market'
                ? (tradeType === 'buy' ? t('trading.buy') : t('trading.sell'))
                : t('trading.placeOrder'))}
        </button>
      </div>
    </div>
  );
}

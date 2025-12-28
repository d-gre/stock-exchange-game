import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Portfolio as PortfolioType, Stock, PendingOrder, OrderType } from '../types';

interface PortfolioProps {
  portfolio: PortfolioType;
  stocks: Stock[];
  selectedStock: string;
  pendingOrders: PendingOrder[];
  reservedCash: number;
  onSelectStock: (symbol: string) => void;
  onCancelOrder: (orderId: string) => void;
  onEditOrder: (order: PendingOrder) => void;
}

export const Portfolio = ({ portfolio, stocks, selectedStock, pendingOrders, reservedCash, onSelectStock, onCancelOrder, onEditOrder }: PortfolioProps) => {
  const { t, i18n } = useTranslation();

  const formatNumber = (num: number, decimals: number = 2): string => {
    return num.toLocaleString(i18n.language === 'de' ? 'de-DE' : 'en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const getOrderTypeName = (orderType: OrderType, isBuy: boolean): string => {
    const key = isBuy ? 'buy' : 'sell';
    return t(`orderTypes.${key}.${orderType}`);
  };
  // Sort holdings alphabetically
  const sortedHoldings = useMemo(() =>
    [...portfolio.holdings].sort((a, b) => a.symbol.localeCompare(b.symbol)),
    [portfolio.holdings]
  );

  const getStockPrice = (symbol: string): number => {
    const stock = stocks.find(s => s.symbol === symbol);
    return stock?.currentPrice ?? 0;
  };

  const getStockName = (symbol: string): string => {
    const stock = stocks.find(s => s.symbol === symbol);
    return stock?.name ?? symbol;
  };

  const calculateHoldingValue = (symbol: string, shares: number): number => {
    return shares * getStockPrice(symbol);
  };

  const calculateProfitLoss = (symbol: string, shares: number, avgBuyPrice: number): number => {
    const currentValue = calculateHoldingValue(symbol, shares);
    const costBasis = shares * avgBuyPrice;
    return currentValue - costBasis;
  };

  const totalHoldingsValue = portfolio.holdings.reduce((sum, holding) => {
    return sum + calculateHoldingValue(holding.symbol, holding.shares);
  }, 0);

  // Available cash = total cash - reserved cash for pending orders
  // Math.max prevents negative display during race conditions
  const availableCash = Math.max(0, portfolio.cash - reservedCash);

  const totalValue = portfolio.cash + totalHoldingsValue;

  const totalProfitLoss = portfolio.holdings.reduce((sum, holding) => {
    return sum + calculateProfitLoss(holding.symbol, holding.shares, holding.avgBuyPrice);
  }, 0);

  return (
    <div className="portfolio">
      <h2 className="portfolio__title">{t('portfolio.title')}</h2>

      <div className="portfolio__summary">
        <div className="portfolio__summary-item">
          <span className="portfolio__summary-label">{t('portfolio.available')}:</span>
          <span className="portfolio__summary-value">${formatNumber(availableCash)}</span>
        </div>
        {reservedCash > 0 && (
          <div className="portfolio__summary-item portfolio__summary-item--reserved">
            <span className="portfolio__summary-label">{t('portfolio.reserved')}:</span>
            <span className="portfolio__summary-value">${formatNumber(reservedCash)}</span>
          </div>
        )}
        <div className="portfolio__summary-item">
          <span className="portfolio__summary-label">{t('portfolio.stockValue')}:</span>
          <span className="portfolio__summary-value">${formatNumber(totalHoldingsValue)}</span>
        </div>
        <div className="portfolio__summary-item portfolio__summary-item--total">
          <span className="portfolio__summary-label">{t('portfolio.totalValue')}:</span>
          <span className="portfolio__summary-value">${formatNumber(totalValue)}</span>
        </div>
        <div className="portfolio__summary-item">
          <span className="portfolio__summary-label">{t('portfolio.profitLoss')}:</span>
          <span className={`portfolio__summary-value ${totalProfitLoss >= 0 ? 'portfolio__summary-value--positive' : 'portfolio__summary-value--negative'}`}>
            {totalProfitLoss >= 0 ? '+' : ''}${formatNumber(totalProfitLoss)}
          </span>
        </div>
      </div>

      <div className="portfolio__holdings">
        <h3 className="portfolio__holdings-title">{t('portfolio.assets')}</h3>
        {portfolio.holdings.length > 0 ? (
          <div className="portfolio__holdings-table">
            <div className="portfolio__holdings-header">
              <span>{t('portfolio.symbol')}</span>
              <span>{t('portfolio.qty')}</span>
              <span>{t('portfolio.buyPrice')}</span>
              <span>{t('portfolio.current')}</span>
              <span>{t('portfolio.pl')}</span>
            </div>
            {sortedHoldings.map(holding => {
              const currentPrice = getStockPrice(holding.symbol);
              const profitLoss = calculateProfitLoss(holding.symbol, holding.shares, holding.avgBuyPrice);
              const profitLossPercent = ((currentPrice - holding.avgBuyPrice) / holding.avgBuyPrice) * 100;

              return (
                <div
                  key={holding.symbol}
                  className={`portfolio__holdings-row ${selectedStock === holding.symbol ? 'portfolio__holdings-row--selected' : ''}`}
                  onClick={() => onSelectStock(holding.symbol)}
                >
                  <span className="portfolio__holdings-symbol" title={getStockName(holding.symbol)}>{holding.symbol}</span>
                  <span>{formatNumber(holding.shares, 0)}</span>
                  <span>${formatNumber(holding.avgBuyPrice, 0)}</span>
                  <span>${formatNumber(currentPrice, 0)}</span>
                  <span className={`portfolio__holdings-pl ${profitLoss >= 0 ? 'portfolio__holdings-pl--positive' : 'portfolio__holdings-pl--negative'}`}>
                    {profitLoss >= 0 ? '+' : ''}{formatNumber(profitLossPercent, 1)}%
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="portfolio__no-holdings">{t('portfolio.noHoldings')}</p>
        )}
      </div>

      <div className="portfolio__orders">
        <h3 className="portfolio__orders-title">{t('portfolio.orders')}</h3>
        {pendingOrders.length > 0 ? (
          <div className="portfolio__orders-list">
            {pendingOrders.map(order => (
              <div key={order.id} className={`portfolio__order-row ${order.type === 'buy' ? 'portfolio__order-row--buy' : 'portfolio__order-row--sell'}`}>
                <div className="portfolio__order-info">
                  <span className={`portfolio__order-type ${order.type === 'buy' ? 'portfolio__order-type--buy' : 'portfolio__order-type--sell'}`}>
                    {t(`portfolio.${order.type}`)}
                  </span>
                  <span className="portfolio__order-kind">
                    {getOrderTypeName(order.orderType, order.type === 'buy')}
                  </span>
                  <span className="portfolio__order-symbol">{order.symbol}</span>
                  <span className="portfolio__order-details">
                    {formatNumber(order.shares, 0)} × ${formatNumber(order.orderPrice)}
                  </span>
                  <span className="portfolio__order-total">
                    ${formatNumber(order.shares * order.orderPrice)}
                  </span>
                  <span className="portfolio__order-cycles" title={t('portfolio.remainingCycles')}>
                    {order.remainingCycles === 0 ? t('portfolio.nextCycle') : t('portfolio.tradingCycles', { count: order.remainingCycles })}
                  </span>
                </div>
                <div className="portfolio__order-actions">
                  <button
                    className="portfolio__edit-btn"
                    onClick={() => onEditOrder(order)}
                    title={t('portfolio.editOrder')}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                    </svg>
                  </button>
                  <button
                    className="portfolio__cancel-btn"
                    onClick={() => onCancelOrder(order.id)}
                    title={t('portfolio.cancelOrder')}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="portfolio__no-orders">{t('portfolio.noOrders')}</p>
        )}
      </div>
    </div>
  );
}

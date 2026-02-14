import { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Stock, Sector } from '../types';
import { formatCurrency, formatPercent, getFormatLocale } from '../utils/formatting';

interface StockListProps {
  stocks: Stock[];
  selectedStock: string;
  onSelectStock: (symbol: string) => void;
}

type SortColumn = 'symbol' | 'price' | 'change' | 'trend' | 'sector';
type SortDirection = 'asc' | 'desc';

/**
 * Calculates mini trend from last 5 candles
 * Returns array of -1 (falling), 0 (neutral), 1 (rising)
 */
const calculateMiniTrend = (priceHistory: Stock['priceHistory']): number[] => {
  const lastCandles = priceHistory.slice(-5);
  return lastCandles.map(candle => {
    const change = candle.close - candle.open;
    if (change > 0) return 1;
    if (change < 0) return -1;
    return 0;
  });
};

/**
 * Calculates a trend score for sorting (-5 to +5)
 * Based on ratio of green to red candles in last 5
 */
const calculateTrendScore = (priceHistory: Stock['priceHistory']): number => {
  const trend = calculateMiniTrend(priceHistory);
  return trend.reduce((sum, t) => sum + t, 0);
};

/**
 * Sector sort order for consistent grouping
 */
const SECTOR_ORDER: Record<Sector, number> = {
  tech: 1,
  finance: 2,
  industrial: 3,
  commodities: 4,
};

export const StockList = ({ stocks, selectedStock, onSelectStock }: StockListProps) => {
  const { t, i18n } = useTranslation();
  const locale = getFormatLocale(i18n.language);
  const [sortColumn, setSortColumn] = useState<SortColumn>('symbol');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = useCallback((column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending (except change/trend: descending is more useful)
      setSortColumn(column);
      setSortDirection(column === 'change' || column === 'trend' ? 'desc' : 'asc');
    }
  }, [sortColumn]);

  // Sort stocks based on current sort state
  const sortedStocks = useMemo(() => {
    const sorted = [...stocks].sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case 'symbol':
          comparison = a.symbol.localeCompare(b.symbol);
          break;
        case 'price':
          comparison = a.currentPrice - b.currentPrice;
          break;
        case 'change':
          comparison = a.changePercent - b.changePercent;
          break;
        case 'trend':
          comparison = calculateTrendScore(a.priceHistory) - calculateTrendScore(b.priceHistory);
          break;
        case 'sector':
          comparison = SECTOR_ORDER[a.sector] - SECTOR_ORDER[b.sector];
          // Secondary sort by symbol within same sector
          if (comparison === 0) {
            comparison = a.symbol.localeCompare(b.symbol);
          }
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [stocks, sortColumn, sortDirection]);

  const renderSortIndicator = (column: SortColumn) => {
    if (sortColumn !== column) return null;
    return <span className="stock-list__sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  const renderSortButton = (column: SortColumn, label: string) => (
    <button
      className={`stock-list__sort-btn ${sortColumn === column ? 'stock-list__sort-btn--active' : ''}`}
      onClick={() => handleSort(column)}
    >
      {label}
      {sortColumn === column && (
        <span className="stock-list__sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
      )}
    </button>
  );

  return (
    <div className="stock-list">
      <h2 className="stock-list__title">{t('stockList.title')}</h2>
      {/* Compact sort bar for tablet landscape (when header is hidden) */}
      <div className="stock-list__sort-bar">
        {renderSortButton('symbol', t('stockList.symbol'))}
        {renderSortButton('price', t('stockList.price'))}
        {renderSortButton('change', t('stockList.change'))}
        {renderSortButton('trend', t('stockList.trend'))}
        {renderSortButton('sector', t('stockList.sector'))}
      </div>
      <div className="stock-list__table">
        <div className="stock-list__header">
          <span
            className="stock-list__header-cell stock-list__header-cell--sortable"
            onClick={() => handleSort('symbol')}
          >
            {t('stockList.symbol')}{renderSortIndicator('symbol')}
          </span>
          <span
            className="stock-list__header-cell stock-list__header-cell--sortable"
            onClick={() => handleSort('price')}
          >
            {t('stockList.price')}{renderSortIndicator('price')}
          </span>
          <span
            className="stock-list__header-cell stock-list__header-cell--sortable"
            onClick={() => handleSort('change')}
          >
            {t('stockList.change')}{renderSortIndicator('change')}
          </span>
          <span
            className="stock-list__header-cell stock-list__header-cell--sortable"
            onClick={() => handleSort('trend')}
          >
            {t('stockList.trend')}{renderSortIndicator('trend')}
          </span>
          <span
            className="stock-list__header-cell stock-list__header-cell--sortable"
            onClick={() => handleSort('sector')}
          >
            {t('stockList.sector')}{renderSortIndicator('sector')}
          </span>
        </div>
        {sortedStocks.map(stock => {
          const trend = calculateMiniTrend(stock.priceHistory);
          return (
            <div
              key={stock.symbol}
              className={`stock-list__row ${selectedStock === stock.symbol ? 'stock-list__row--selected' : ''}`}
              onClick={() => onSelectStock(stock.symbol)}
            >
              <span className="stock-list__symbol" title={stock.name}>{stock.symbol}</span>
              <span className="stock-list__price">{formatCurrency(stock.currentPrice, 2, locale)}</span>
              <span className={`stock-list__change ${stock.change >= 0 ? 'stock-list__change--positive' : 'stock-list__change--negative'}`}>
                {formatPercent(stock.changePercent / 100, 1, true, locale)}
              </span>
              <span className="stock-list__mini-trend">
                {trend.map((trendValue, i) => (
                  <span
                    key={i}
                    className={`stock-list__trend-bar ${trendValue > 0 ? 'stock-list__trend-bar--up' : trendValue < 0 ? 'stock-list__trend-bar--down' : 'stock-list__trend-bar--neutral'}`}
                  />
                ))}
              </span>
              <span
                className={`stock-list__sector stock-list__sector--${stock.sector}`}
                title={t(`stockList.sectors.${stock.sector}`)}
              >
                {t(`stockList.sectors.${stock.sector}Short`)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

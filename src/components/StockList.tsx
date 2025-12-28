import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type {Stock} from '../types';

interface StockListProps {
  stocks: Stock[];
  selectedStock: string;
  onSelectStock: (symbol: string) => void;
}

const formatMarketCap = (billions: number): string => {
  if (billions >= 1000) {
    return `${(billions / 1000).toFixed(1)}T`;
  }
  return `${billions.toFixed(0)}B`;
};

/**
 * Berechnet Mini-Trend aus den letzten 5 Kerzen
 * Gibt Array von -1 (fallend), 0 (neutral), 1 (steigend) zurück
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

export const StockList = ({stocks, selectedStock, onSelectStock}: StockListProps) => {
  const { t } = useTranslation();

  // Stocks alphabetisch sortieren
  const sortedStocks = useMemo(() =>
    [...stocks].sort((a, b) => a.symbol.localeCompare(b.symbol)),
    [stocks]
  );

  return (
    <div className="stock-list">
      <h2 className="stock-list__title">{t('stockList.title')}</h2>
      <div className="stock-list__table">
        <div className="stock-list__header">
          <span>{t('stockList.symbol')}</span>
          <span>{t('stockList.price')}</span>
          <span>{t('stockList.change')}</span>
          <span>{t('stockList.marketCap')}</span>
          <span>{t('stockList.trend')}</span>
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
              <span className="stock-list__price">${stock.currentPrice.toFixed(2)}</span>
              <span className={`stock-list__change ${stock.change >= 0 ? 'stock-list__change--positive' : 'stock-list__change--negative'}`}>
                {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(1)}%
              </span>
              <span className="stock-list__market-cap">${formatMarketCap(stock.marketCapBillions)}</span>
              <span className="stock-list__mini-trend">
                {trend.map((t, i) => (
                  <span
                    key={i}
                    className={`stock-list__trend-bar ${t > 0 ? 'stock-list__trend-bar--up' : t < 0 ? 'stock-list__trend-bar--down' : 'stock-list__trend-bar--neutral'}`}
                  />
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

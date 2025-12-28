import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import CandlestickChart from './CandlestickChart';
import type { Stock, PortfolioItem } from '../types';
import type { Theme } from '../hooks/useTheme';

interface MultiStockChartProps {
  stocks: Stock[];
  holdings: PortfolioItem[];
  selectedStock: string;
  cash: number;
  symbolsWithPendingOrders: string[];
  onSelectStock: (symbol: string) => void;
  onTrade: (symbol: string, type: 'buy' | 'sell') => void;
  theme?: Theme;
}

export const MultiStockChart = ({
  stocks,
  holdings,
  selectedStock,
  cash,
  symbolsWithPendingOrders,
  onSelectStock,
  onTrade,
  theme = 'dark',
}: MultiStockChartProps) => {
  const { t, i18n } = useTranslation();

  const formatCurrency = (value: number): string => {
    return value.toLocaleString(i18n.language === 'de' ? 'de-DE' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const canAfford = (price: number): boolean => cash >= price;
  const hasPendingOrder = (symbol: string): boolean => symbolsWithPendingOrders.includes(symbol);
  const getHoldingShares = (symbol: string): number => {
    const holding = holdings.find(h => h.symbol === symbol);
    return holding?.shares ?? 0;
  };
  // Sort owned stocks alphabetically and enrich with stock data
  const ownedStocks = useMemo(() => {
    return holdings
      .map(holding => {
        const stock = stocks.find(s => s.symbol === holding.symbol);
        return stock ? { ...stock, holding } : null;
      })
      .filter((item): item is Stock & { holding: PortfolioItem } => item !== null)
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [stocks, holdings]);

  // If a stock is selected, show only this one
  if (selectedStock) {
    const selected = stocks.find(s => s.symbol === selectedStock);
    if (!selected) {
      return (
        <div className="multi-stock-chart__empty">
          <p>{t('chart.stockNotFound')}</p>
        </div>
      );
    }

    const holding = holdings.find(h => h.symbol === selectedStock);
    const profitLoss = holding ? (selected.currentPrice - holding.avgBuyPrice) * holding.shares : 0;

    return (
      <div className="multi-stock-chart__grid multi-stock-chart__grid--single">
        <div className="multi-stock-chart__card multi-stock-chart__card--selected" onClick={() => onSelectStock(selectedStock)}>
          <div className="multi-stock-chart__card-header">
            <div className="multi-stock-chart__card-info">
              <span className="multi-stock-chart__card-symbol">{selected.symbol}</span>
              <span className="multi-stock-chart__card-name">{selected.name}</span>
            </div>
            <div className={`multi-stock-chart__card-price ${selected.change >= 0 ? 'positive' : 'negative'}`}>
              ${formatCurrency(selected.currentPrice)}
              <span className="multi-stock-chart__card-change">
                {selected.change >= 0 ? '+' : ''}{formatCurrency(selected.change)} ({selected.changePercent >= 0 ? '+' : ''}{selected.changePercent.toFixed(2)}%)
              </span>
            </div>
            <div className="multi-stock-chart__card-actions-row">
              {holding && (
                <div className="multi-stock-chart__card-holding-info">
                  <span>{holding.shares} {t('chart.pieces')} @ ${formatCurrency(holding.avgBuyPrice)}</span>
                  <span className={`multi-stock-chart__card-pnl ${profitLoss >= 0 ? 'multi-stock-chart__card-pnl--positive' : 'multi-stock-chart__card-pnl--negative'}`}>
                    {profitLoss >= 0 ? '+' : ''}${formatCurrency(profitLoss)}
                  </span>
                </div>
              )}
              <div className="multi-stock-chart__card-actions">
              <button
                className="multi-stock-chart__action-btn multi-stock-chart__action-btn--buy"
                onClick={(e) => {
                  e.stopPropagation();
                  onTrade(selected.symbol, 'buy');
                }}
                disabled={!canAfford(selected.currentPrice) || hasPendingOrder(selected.symbol)}
                title={hasPendingOrder(selected.symbol) ? t('chart.pendingOrder') : t('trading.buy')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v8M8 12h8" />
                </svg>
                <span>{t('trading.buy')}</span>
              </button>
              <button
                className="multi-stock-chart__action-btn multi-stock-chart__action-btn--sell"
                onClick={(e) => {
                  e.stopPropagation();
                  onTrade(selected.symbol, 'sell');
                }}
                disabled={getHoldingShares(selected.symbol) === 0 || hasPendingOrder(selected.symbol)}
                title={hasPendingOrder(selected.symbol) ? t('chart.pendingOrder') : t('trading.sell')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 12h8" />
                </svg>
                <span>{t('trading.sell')}</span>
              </button>
              </div>
            </div>
          </div>
          <div className="multi-stock-chart__card-body">
            <CandlestickChart data={selected.priceHistory} autoHeight theme={theme} />
          </div>
        </div>
      </div>
    );
  }

  // No selection: Show all owned stocks
  if (ownedStocks.length === 0) {
    return (
      <div className="multi-stock-chart__empty">
        <p>{t('chart.noStocksInPortfolio')}</p>
        <p className="multi-stock-chart__empty-hint">{t('chart.clickToShowChart')}</p>
      </div>
    );
  }

  // Chart height based on number of stocks (with only one stock: autoHeight)
  const useAutoHeight = ownedStocks.length === 1;
  const chartHeight = ownedStocks.length <= 4 ? 220 : 180;

  return (
    <div className={`multi-stock-chart__grid multi-stock-chart__grid--count-${Math.min(ownedStocks.length, 6)}`}>
      {ownedStocks.map(stock => {
        const profitLoss = (stock.currentPrice - stock.holding.avgBuyPrice) * stock.holding.shares;

        return (
          <div
            key={stock.symbol}
            className="multi-stock-chart__card"
            onClick={() => onSelectStock(stock.symbol)}
          >
            <div className="multi-stock-chart__card-header">
              <div className="multi-stock-chart__card-info">
                <span className="multi-stock-chart__card-symbol">{stock.symbol}</span>
              </div>
              <div className={`multi-stock-chart__card-price ${stock.change >= 0 ? 'positive' : 'negative'}`}>
                ${formatCurrency(stock.currentPrice)}
              </div>
              <div className={`multi-stock-chart__card-change-display ${stock.change >= 0 ? 'multi-stock-chart__card-change-display--positive' : 'multi-stock-chart__card-change-display--negative'}`}>
                {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(1)}%
              </div>
              <div className="multi-stock-chart__card-actions-row">
                <div className="multi-stock-chart__card-holding-info">
                  <span>{stock.holding.shares} {t('chart.pieces')} @ ${formatCurrency(stock.holding.avgBuyPrice)}</span>
                  <span className={`multi-stock-chart__card-pnl ${profitLoss >= 0 ? 'multi-stock-chart__card-pnl--positive' : 'multi-stock-chart__card-pnl--negative'}`}>
                    {profitLoss >= 0 ? '+' : ''}${formatCurrency(profitLoss)}
                  </span>
                </div>
                <div className="multi-stock-chart__card-actions multi-stock-chart__card-actions--compact">
                  <button
                    className="multi-stock-chart__action-btn multi-stock-chart__action-btn--buy"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTrade(stock.symbol, 'buy');
                    }}
                    disabled={!canAfford(stock.currentPrice) || hasPendingOrder(stock.symbol)}
                    title={hasPendingOrder(stock.symbol) ? t('chart.pendingOrder') : t('trading.buy')}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v8M8 12h8" />
                    </svg>
                  </button>
                  <button
                    className="multi-stock-chart__action-btn multi-stock-chart__action-btn--sell"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTrade(stock.symbol, 'sell');
                    }}
                    disabled={getHoldingShares(stock.symbol) === 0 || hasPendingOrder(stock.symbol)}
                    title={hasPendingOrder(stock.symbol) ? t('chart.pendingOrder') : t('trading.sell')}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M8 12h8" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            <div className="multi-stock-chart__card-body">
              <CandlestickChart
                data={stock.priceHistory}
                height={chartHeight}
                compact={ownedStocks.length > 1}
                autoHeight={useAutoHeight}
                theme={theme}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { selectStock, setChartTab, type TradeType } from '../store/uiSlice';
import { selectAllTrades } from '../store/tradeHistorySlice';
import { calculateMarketIndex, calculateAllSectorIndices } from '../utils/indexCalculation';
import { formatNumber, formatPercent, getFormatLocale } from '../utils/formatting';
import CandlestickChart from './CandlestickChart';
import MultiStockChart from './MultiStockChart';
import { TradeHistory } from './TradeHistory';
import type { Stock, Portfolio, Sector } from '../types';
import type { Theme } from '../hooks/useTheme';

/**
 * Calculates mini trend from the last 5 candles
 * Returns array of -1 (falling), 0 (neutral), 1 (rising)
 */
const calculateMiniTrend = (priceHistory: { open: number; close: number }[]): number[] => {
  const lastCandles = priceHistory.slice(-5);
  return lastCandles.map(candle => {
    const change = candle.close - candle.open;
    if (change > 0) return 1;
    if (change < 0) return -1;
    return 0;
  });
};

/** Sector display order */
const SECTOR_ORDER: Sector[] = ['tech', 'finance', 'industrial', 'commodities'];

/** Sector colors for chart lines - theme dependent */
const getSectorLineColors = (theme: Theme): Record<Sector, string> => {
  if (theme === 'medieval') {
    return {
      tech: '#1a4a6a',
      finance: '#084a3a',
      industrial: '#7a4a0a',
      commodities: '#4a2a6a',
    };
  }
  // Light and dark theme use the same sector colors
  return {
    tech: '#3b82f6',
    finance: '#10b981',
    industrial: '#f59e0b',
    commodities: '#8b5cf6',
  };
};

interface ChartPanelProps {
  stocks: Stock[];
  portfolio: Portfolio;
  selectedStock: string;
  symbolsWithPendingOrders: string[];
  theme: Theme;
  /** Indicates whether warmup is currently running (for placeholder animation) */
  isWarmingUp?: boolean;
  /** Warmup progress in percent (0-100) */
  warmupProgress?: number;
  onSelectStock: (symbol: string) => void;
  onTrade: (symbol: string, type: TradeType) => void;
}

export const ChartPanel = ({
  stocks,
  portfolio,
  selectedStock,
  symbolsWithPendingOrders,
  theme,
  isWarmingUp = false,
  warmupProgress = 0,
  onSelectStock,
  onTrade,
}: ChartPanelProps) => {
  const { t, i18n } = useTranslation();
  const locale = getFormatLocale(i18n.language);
  const dispatch = useAppDispatch();
  const chartTab = useAppSelector(state => state.ui.chartTab);
  const tradeHistory = useAppSelector(selectAllTrades);

  const selectedStockData = stocks.find(s => s.symbol === selectedStock);
  const marketIndex = calculateMarketIndex(stocks);
  const sectorIndices = calculateAllSectorIndices(stocks);

  // With no holdings and no selection -> show market index (only if not history tab)
  const showIndexInstead = chartTab === 'stock' && portfolio.holdings.length === 0 && !selectedStock;

  // During warmup: Show pie chart animation instead of real chart
  if (isWarmingUp) {
    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - warmupProgress / 100);

    return (
      <>
        <div className="chart-panel__tabs">
          <div className="chart-panel__tabs-right">
            <button className="chart-panel__tab chart-panel__tab--active">
              {t('chart.marketIndex')}
            </button>
          </div>
        </div>
        <div className="chart-panel__area">
          <div className="chart-panel__wrapper">
            <div className="chart-panel__warmup-overlay">
              <div className="game-start__progress-pie">
                <svg viewBox="0 0 100 100">
                  <defs>
                    <linearGradient id="pie-gradient-chart" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="var(--accent-primary)" />
                      <stop offset="100%" stopColor="var(--accent-secondary)" />
                    </linearGradient>
                  </defs>
                  <circle
                    className="game-start__progress-pie-bg"
                    cx="50"
                    cy="50"
                    r={radius}
                  />
                  <circle
                    className="game-start__progress-pie-fill"
                    cx="50"
                    cy="50"
                    r={radius}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    style={{ stroke: 'url(#pie-gradient-chart)' }}
                  />
                </svg>
                <span className="game-start__progress-pie-text">{warmupProgress}%</span>
              </div>
              <span className="game-start__progress-label">{t('game.preparingMarket')}</span>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="chart-panel__tabs">
        <div className="chart-panel__tabs-left">
          {(portfolio.holdings.length > 0 || selectedStock) && (
            <button
              className={`chart-panel__tab ${chartTab === 'stock' && !showIndexInstead ? 'chart-panel__tab--active' : ''}`}
              onClick={() => {
                // Only clear single selection when there are holdings (multi-stock view)
                if (portfolio.holdings.length > 0) {
                  dispatch(selectStock(''));
                }
                dispatch(setChartTab('stock'));
              }}
            >
              {portfolio.holdings.length > 0
                ? t('chart.assets')
                : selectedStockData
                  ? `${selectedStockData.symbol} - ${selectedStockData.name}`
                  : t('chart.stock')}
            </button>
          )}
        </div>
        <div className="chart-panel__tabs-right">
          {tradeHistory.length > 0 && (
            <button
              className={`chart-panel__tab ${chartTab === 'history' ? 'chart-panel__tab--active' : ''}`}
              onClick={() => dispatch(setChartTab('history'))}
            >
              {t('chart.orderHistory')}
            </button>
          )}
          <button
            className={`chart-panel__tab ${chartTab === 'index' || showIndexInstead ? 'chart-panel__tab--active' : ''}`}
            onClick={() => dispatch(setChartTab('index'))}
          >
            {t('chart.marketIndex')}
          </button>
        </div>
      </div>
      <div className="chart-panel__area">
        <div className="chart-panel__wrapper">
          {chartTab === 'stock' && !showIndexInstead && (
            <MultiStockChart
              stocks={stocks}
              holdings={portfolio.holdings}
              selectedStock={selectedStock}
              cash={portfolio.cash}
              symbolsWithPendingOrders={symbolsWithPendingOrders}
              onSelectStock={onSelectStock}
              onTrade={onTrade}
              theme={theme}
            />
          )}
          {(chartTab === 'index' || showIndexInstead) && (
            <div className="chart-panel__indices-container">
              {/* Main Market Index */}
              <div className="chart-panel__market-index">
                <div className="chart-panel__market-index-header">
                  <h2>D-GREX Prime</h2>
                  <div className={`chart-panel__market-index-value${marketIndex.change >= 0 ? ' chart-panel__market-index-value--positive' : ' chart-panel__market-index-value--negative'}`}>
                    {formatNumber(Math.round(marketIndex.currentPrice), 0, locale)}
                    <span className="chart-panel__market-index-change">
                      {formatPercent(marketIndex.changePercent / 100, 2, true, locale)}
                    </span>
                    <span className="chart-panel__market-index-trend">
                      {calculateMiniTrend(marketIndex.priceHistory).map((trend, i) => (
                        <span
                          key={i}
                          className={`chart-panel__trend-bar${trend > 0 ? ' chart-panel__trend-bar--up' : trend < 0 ? ' chart-panel__trend-bar--down' : ' chart-panel__trend-bar--neutral'}`}
                        />
                      ))}
                    </span>
                  </div>
                </div>
                <CandlestickChart data={marketIndex.priceHistory} type="area" autoHeight theme={theme} locale={locale} />
              </div>

              {/* Sector Indices Grid */}
              <div className="chart-panel__sector-indices">
                {SECTOR_ORDER.map(sector => {
                  const sectorIndex = sectorIndices[sector];
                  return (
                    <div key={sector} className="chart-panel__sector-index-chart">
                      <div className="chart-panel__sector-index-header">
                        <h3 className={`chart-panel__sector-title--${sector}`}>{sectorIndex.name}</h3>
                        <div className={`chart-panel__sector-index-value${sectorIndex.change >= 0 ? ' chart-panel__sector-index-value--positive' : ' chart-panel__sector-index-value--negative'}`}>
                          {formatNumber(Math.round(sectorIndex.currentPrice), 0, locale)}
                          <span className="chart-panel__sector-index-change">
                            {formatPercent(sectorIndex.changePercent / 100, 2, true, locale)}
                          </span>
                          <span className="chart-panel__market-index-trend">
                            {calculateMiniTrend(sectorIndex.priceHistory).map((trend, i) => (
                              <span
                                key={i}
                                className={`chart-panel__trend-bar${trend > 0 ? ' chart-panel__trend-bar--up' : trend < 0 ? ' chart-panel__trend-bar--down' : ' chart-panel__trend-bar--neutral'}`}
                              />
                            ))}
                          </span>
                        </div>
                      </div>
                      <CandlestickChart data={sectorIndex.priceHistory} type="area" autoHeight theme={theme} lineColor={getSectorLineColors(theme)[sector]} locale={locale} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {chartTab === 'history' && (
            <TradeHistory theme={theme} />
          )}
        </div>
      </div>
    </>
  );
};

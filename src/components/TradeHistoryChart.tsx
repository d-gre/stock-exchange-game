import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createChart, LineSeries, AreaSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, LineData, Time } from 'lightweight-charts';
import type { CompletedTrade } from '../types';
import type { Theme } from '../hooks/useTheme';
import type { FormatLocale } from '../utils/formatting';
import { getDefaultChartOptions, getChartColors, createResizeHandler, setupResizeListeners } from '../utils/chartUtils';

interface TradeHistoryChartProps {
  trades: CompletedTrade[];
  portfolioValueHistory: Array<{
    timestamp: number;
    value: number;
    realizedProfitLoss: number;
  }>;
  height?: number;
  autoHeight?: boolean;
  theme?: Theme;
  locale?: FormatLocale;
}

export const TradeHistoryChart = ({
  trades,
  portfolioValueHistory,
  height = 300,
  autoHeight = false,
  theme = 'dark',
  locale = 'en',
}: TradeHistoryChartProps) => {
  const { t } = useTranslation();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const plSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const valueSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  // Helper function to set chart data
  const setChartData = (
    plSeries: ISeriesApi<'Area'>,
    valueSeries: ISeriesApi<'Line'>,
    chart: IChartApi,
    history: typeof portfolioValueHistory,
    currentTheme: Theme
  ) => {
    if (history.length === 0) return;

    const colors = getChartColors(currentTheme);

    // Deduplicate entries with the same second timestamp (keep last value)
    const deduplicatedHistory = new Map<number, typeof history[0]>();
    for (const point of history) {
      const timeInSeconds = Math.floor(point.timestamp / 1000);
      deduplicatedHistory.set(timeInSeconds, point);
    }
    const sortedHistory = Array.from(deduplicatedHistory.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, point]) => point);

    // P&L data
    const plData: LineData<Time>[] = sortedHistory.map(point => ({
      time: Math.floor(point.timestamp / 1000) as Time,
      value: point.realizedProfitLoss,
    }));
    plSeries.setData(plData);

    // Portfolio value data
    const valueData: LineData<Time>[] = sortedHistory.map(point => ({
      time: Math.floor(point.timestamp / 1000) as Time,
      value: point.value,
    }));
    valueSeries.setData(valueData);

    // Adjust the color of the P&L chart
    const lastPL = history[history.length - 1]?.realizedProfitLoss ?? 0;
    const positiveTopColor = currentTheme === 'dark' ? 'rgba(38, 166, 154, 0.4)' : 'rgba(25, 135, 84, 0.3)';
    const positiveBottomColor = currentTheme === 'dark' ? 'rgba(38, 166, 154, 0.0)' : 'rgba(25, 135, 84, 0.0)';
    const negativeTopColor = currentTheme === 'dark' ? 'rgba(239, 83, 80, 0.4)' : 'rgba(220, 53, 69, 0.3)';
    const negativeBottomColor = currentTheme === 'dark' ? 'rgba(239, 83, 80, 0.0)' : 'rgba(220, 53, 69, 0.0)';

    if (lastPL >= 0) {
      plSeries.applyOptions({
        lineColor: colors.upColor,
        topColor: positiveTopColor,
        bottomColor: positiveBottomColor,
      });
    } else {
      plSeries.applyOptions({
        lineColor: colors.downColor,
        topColor: negativeTopColor,
        bottomColor: negativeBottomColor,
      });
    }

    chart.timeScale().fitContent();
  };

  // Create chart and recreate on theme/size changes
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const chartHeight = autoHeight ? container.clientHeight || height : height;
    const colors = getChartColors(theme);

    const chart = createChart(container, getDefaultChartOptions(
      { width: container.clientWidth, height: chartHeight },
      { timeVisible: true, secondsVisible: false },
      theme,
      locale
    ));

    // P&L Area Chart (green/red depending on profit/loss)
    const plSeries = chart.addSeries(AreaSeries, {
      lineColor: colors.upColor,
      topColor: theme === 'dark' ? 'rgba(38, 166, 154, 0.4)' : 'rgba(25, 135, 84, 0.3)',
      bottomColor: theme === 'dark' ? 'rgba(38, 166, 154, 0.0)' : 'rgba(25, 135, 84, 0.0)',
      lineWidth: 2,
      priceScaleId: 'left',
    });

    // Portfolio Value Line
    const valueSeries = chart.addSeries(LineSeries, {
      color: colors.lineColor,
      lineWidth: 2,
      priceScaleId: 'right',
    });

    // Second price scale on the left
    chart.priceScale('left').applyOptions({
      visible: true,
      borderColor: colors.borderColor,
    });

    chartRef.current = chart;
    plSeriesRef.current = plSeries;
    valueSeriesRef.current = valueSeries;

    // Set initial data immediately after chart creation
    setChartData(plSeries, valueSeries, chart, portfolioValueHistory, theme);

    const handleResize = createResizeHandler({
      container,
      chart,
      autoHeight,
      fallbackHeight: height,
    });

    return setupResizeListeners(container, chart, handleResize);
  }, [height, autoHeight, theme, locale, portfolioValueHistory]);

  // Update data when only portfolioValueHistory changes (chart already exists)
  useEffect(() => {
    if (!plSeriesRef.current || !valueSeriesRef.current || !chartRef.current) return;
    setChartData(plSeriesRef.current, valueSeriesRef.current, chartRef.current, portfolioValueHistory, theme);
  }, [portfolioValueHistory]);

  if (trades.length === 0 && portfolioValueHistory.length <= 1) {
    return (
      <div className="trade-history-chart__empty">
        <p>{t('tradeHistory.chart.noTrades')}</p>
        <p className="trade-history-chart__empty-hint">{t('tradeHistory.chart.noTradesHint')}</p>
      </div>
    );
  }

  const colors = getChartColors(theme);

  return (
    <div className={`trade-history-chart${autoHeight ? ' trade-history-chart--auto-height' : ''}`}>
      <div className="trade-history-chart__legend">
        <span className="trade-history-chart__legend-item trade-history-chart__legend-item--portfolio-value">
          <span className="trade-history-chart__legend-color" style={{ backgroundColor: colors.lineColor }}></span>
          {t('tradeHistory.chart.portfolioValue')}
        </span>
        <span className="trade-history-chart__legend-item trade-history-chart__legend-item--realized-pl">
          <span className="trade-history-chart__legend-color" style={{ backgroundColor: colors.upColor }}></span>
          {t('tradeHistory.chart.realizedPL')}
        </span>
      </div>
      <div ref={chartContainerRef} className="trade-history-chart__canvas" />
    </div>
  );
};

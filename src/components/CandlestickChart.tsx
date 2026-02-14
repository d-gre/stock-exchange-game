import { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, LineSeries, AreaSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, CandlestickData, LineData, AreaData, Time } from 'lightweight-charts';
import type { CandleData } from '../types';
import type { Theme } from '../hooks/useTheme';
import type { FormatLocale } from '../utils/formatting';
import { getDefaultChartOptions, getChartColors, createResizeHandler, setupResizeListeners } from '../utils/chartUtils';

interface ChartProps {
  data: CandleData[];
  type?: 'candlestick' | 'line' | 'area';
  height?: number;
  compact?: boolean;
  /** Chart takes the full available height of the container */
  autoHeight?: boolean;
  /** Current theme for color styling */
  theme?: Theme;
  /** Custom line color for line/area charts (overrides theme default) */
  lineColor?: string;
  /** Locale for price formatting on Y-axis */
  locale?: FormatLocale;
}

const CandlestickChart = ({ data, type = 'candlestick', height = 400, compact = false, autoHeight = false, theme = 'dark', lineColor, locale = 'en' }: ChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<ISeriesApi<any> | null>(null);
  // Keep a ref to data for use in the chart creation effect without making data a dependency
  const dataRef = useRef(data);
  dataRef.current = data;

  // Helper function to set chart data based on type
  const setChartData = (series: ISeriesApi<'Candlestick' | 'Line' | 'Area'>, chart: IChartApi, chartData: CandleData[], chartType: string) => {
    if (chartData.length === 0) return;

    if (chartType === 'line') {
      const lineData: LineData[] = chartData.map(candle => ({
        time: candle.time as Time,
        value: candle.close,
      }));
      series.setData(lineData);
    } else if (chartType === 'area') {
      const areaData: AreaData[] = chartData.map(candle => ({
        time: candle.time as Time,
        value: candle.close,
      }));
      series.setData(areaData);
    } else {
      const candleData: CandlestickData[] = chartData.map(candle => ({
        time: candle.time as Time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }));
      series.setData(candleData);
    }
    chart.timeScale().fitContent();
  };

  // Create chart and recreate on type/size/theme changes
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const chartHeight = autoHeight ? container.clientHeight || height : height;
    const colors = getChartColors(theme);

    const chart = createChart(container, getDefaultChartOptions(
      { width: container.clientWidth, height: chartHeight },
      { timeVisible: !compact, secondsVisible: false },
      theme,
      locale
    ));

    const effectiveLineColor = lineColor || colors.lineColor;
    // Generate area gradient colors from line color
    const areaTopColor = lineColor ? `${lineColor}40` : colors.areaTopColor;
    const areaBottomColor = lineColor ? `${lineColor}00` : colors.areaBottomColor;

    let series;
    if (type === 'line') {
      series = chart.addSeries(LineSeries, {
        color: effectiveLineColor,
        lineWidth: 2,
      });
    } else if (type === 'area') {
      series = chart.addSeries(AreaSeries, {
        topColor: areaTopColor,
        bottomColor: areaBottomColor,
        lineColor: effectiveLineColor,
        lineWidth: 2,
      });
    } else {
      series = chart.addSeries(CandlestickSeries, {
        upColor: colors.upColor,
        downColor: colors.downColor,
        borderVisible: false,
        wickUpColor: colors.upColor,
        wickDownColor: colors.downColor,
      });
    }

    chartRef.current = chart;
    seriesRef.current = series;

    // Set initial data using ref (not dependency) to avoid recreating chart on data changes
    setChartData(series, chart, dataRef.current, type);

    const handleResize = createResizeHandler({
      container,
      chart,
      autoHeight,
      fallbackHeight: height,
    });

    return setupResizeListeners(container, chart, handleResize);
    // Note: data is NOT a dependency here - data updates are handled by the second useEffect
    // to avoid recreating the entire chart on every price update
  }, [type, height, compact, autoHeight, theme, lineColor, locale]);

  // Update data when only data changes (chart already exists)
  useEffect(() => {
    if (seriesRef.current && chartRef.current && data.length > 0) {
      setChartData(seriesRef.current, chartRef.current, data, type);
    }
  }, [data, type]);

  return (
    <div className={`candlestick-chart${autoHeight ? ' candlestick-chart--auto-height' : ''}`}>
      <div ref={chartContainerRef} className="candlestick-chart__canvas" />
    </div>
  );
}
export default CandlestickChart

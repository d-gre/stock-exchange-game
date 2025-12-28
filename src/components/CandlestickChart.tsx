import { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, LineSeries, AreaSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, CandlestickData, LineData, AreaData, Time } from 'lightweight-charts';
import type { CandleData } from '../types';
import type { Theme } from '../hooks/useTheme';
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
}

const CandlestickChart = ({ data, type = 'candlestick', height = 400, compact = false, autoHeight = false, theme = 'dark' }: ChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<ISeriesApi<any> | null>(null);

  // Create chart and recreate on type/size changes
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const chartHeight = autoHeight ? container.clientHeight || height : height;
    const colors = getChartColors(theme);

    const chart = createChart(container, getDefaultChartOptions(
      { width: container.clientWidth, height: chartHeight },
      { timeVisible: !compact, secondsVisible: false },
      theme
    ));

    let series;
    if (type === 'line') {
      series = chart.addSeries(LineSeries, {
        color: colors.lineColor,
        lineWidth: 2,
      });
    } else if (type === 'area') {
      series = chart.addSeries(AreaSeries, {
        topColor: colors.areaTopColor,
        bottomColor: colors.areaBottomColor,
        lineColor: colors.lineColor,
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

    const handleResize = createResizeHandler({
      container,
      chart,
      autoHeight,
      fallbackHeight: height,
    });

    return setupResizeListeners(container, chart, handleResize);
  }, [type, height, compact, autoHeight, theme]);

  useEffect(() => {
    if (seriesRef.current && data.length > 0) {
      if (type === 'line') {
        const lineData: LineData[] = data.map(candle => ({
          time: candle.time as Time,
          value: candle.close,
        }));
        seriesRef.current.setData(lineData);
      } else if (type === 'area') {
        const areaData: AreaData[] = data.map(candle => ({
          time: candle.time as Time,
          value: candle.close,
        }));
        seriesRef.current.setData(areaData);
      } else {
        const chartData: CandlestickData[] = data.map(candle => ({
          time: candle.time as Time,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        }));
        seriesRef.current.setData(chartData);
      }
      chartRef.current?.timeScale().fitContent();
    }
  }, [data, type]);

  return (
    <div className={`candlestick-chart${autoHeight ? ' candlestick-chart--auto-height' : ''}`}>
      <div ref={chartContainerRef} className="candlestick-chart__canvas" />
    </div>
  );
}
export default CandlestickChart

import { useEffect, useRef } from 'react';
import { createChart, LineSeries, ColorType } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, LineData, Time } from 'lightweight-charts';
import type { Theme } from '../hooks/useTheme';
import type { ClimateHistoryEntry } from '../store/marketPhaseSlice';
import { getChartColors, createResizeHandler, setupResizeListeners } from '../utils/chartUtils';

interface ClimateHistoryChartProps {
  data: ClimateHistoryEntry[];
  height?: number;
  theme?: Theme;
}

/**
 * Line chart showing Fear & Greed index over time
 */
export const ClimateHistoryChart = ({
  data,
  height = 150,
  theme = 'dark',
}: ClimateHistoryChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const fearGreedSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const colors = getChartColors(theme);

    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: colors.textColor,
        fontFamily: colors.fontFamily,
      },
      grid: {
        vertLines: { color: colors.gridColor },
        horzLines: { color: colors.gridColor },
      },
      rightPriceScale: {
        borderColor: colors.borderColor,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: colors.borderColor,
        timeVisible: false,
        tickMarkFormatter: (time: number) => `${time}`,
      },
      handleScroll: false,
      handleScale: false,
    });

    // Fear & Greed line (orange)
    const fearGreedSeries = chart.addSeries(LineSeries, {
      color: theme === 'medieval' ? '#c9a227' : '#f59e0b',
      lineWidth: 2,
      priceScaleId: 'right',
      title: 'F&G',
    });

    chartRef.current = chart;
    fearGreedSeriesRef.current = fearGreedSeries;

    const handleResize = createResizeHandler({
      container,
      chart,
      autoHeight: false,
      fallbackHeight: height,
    });

    return setupResizeListeners(container, chart, handleResize);
  }, [height, theme]);

  // Update data when it changes
  useEffect(() => {
    if (fearGreedSeriesRef.current && chartRef.current && data.length > 0) {
      const fearGreedData: LineData[] = data.map(entry => ({
        time: entry.cycle as Time,
        value: entry.fearGreedIndex,
      }));

      fearGreedSeriesRef.current.setData(fearGreedData);
      chartRef.current.timeScale().fitContent();
    }
  }, [data, height, theme]);

  return (
    <div className="climate-history-chart">
      <div ref={chartContainerRef} className="climate-history-chart__canvas" />
    </div>
  );
};

import { ColorType } from 'lightweight-charts';
import type { ChartOptions, DeepPartial, IChartApi } from 'lightweight-charts';
import type { Theme } from '../hooks/useTheme';

interface ChartSizeOptions {
  width: number;
  height: number;
}

interface TimeScaleOptions {
  timeVisible?: boolean;
  secondsVisible?: boolean;
}

/**
 * Theme-basierte Farbkonfiguration für Charts
 */
export const getChartColors = (theme: Theme) => {
  if (theme === 'light') {
    return {
      background: '#ffffff',
      textColor: '#333333',
      gridColor: '#e0e0e0',
      borderColor: '#cccccc',
      upColor: '#198754',
      downColor: '#dc3545',
      lineColor: '#0099cc',
      areaTopColor: 'rgba(0, 153, 204, 0.3)',
      areaBottomColor: 'rgba(0, 153, 204, 0.0)',
    };
  }
  // Dark theme (default)
  return {
    background: '#1a1a2e',
    textColor: '#d1d4dc',
    gridColor: '#2a2a4a',
    borderColor: '#3a3a5a',
    upColor: '#26a69a',
    downColor: '#ef5350',
    lineColor: '#00d4ff',
    areaTopColor: 'rgba(0, 212, 255, 0.4)',
    areaBottomColor: 'rgba(0, 212, 255, 0.0)',
  };
};

/**
 * Erstellt Standard-Chart-Optionen für alle Charts in der App
 */
export const getDefaultChartOptions = (
  size: ChartSizeOptions,
  timeScale?: TimeScaleOptions,
  theme: Theme = 'dark'
): DeepPartial<ChartOptions> => {
  const colors = getChartColors(theme);
  return {
    width: size.width,
    height: size.height,
    layout: {
      background: { type: ColorType.Solid, color: colors.background },
      textColor: colors.textColor,
    },
    grid: {
      vertLines: { color: colors.gridColor },
      horzLines: { color: colors.gridColor },
    },
    crosshair: {
      mode: 1,
    },
    rightPriceScale: {
      borderColor: colors.borderColor,
    },
    timeScale: {
      borderColor: colors.borderColor,
      timeVisible: timeScale?.timeVisible ?? true,
      secondsVisible: timeScale?.secondsVisible ?? false,
    },
  };
};

interface ResizeHandlerOptions {
  container: HTMLDivElement;
  chart: IChartApi;
  autoHeight: boolean;
  fallbackHeight: number;
}

/**
 * Erstellt einen Resize-Handler für Chart-Container
 */
export const createResizeHandler = ({
  container,
  chart,
  autoHeight,
  fallbackHeight,
}: ResizeHandlerOptions): (() => void) => {
  return () => {
    const newHeight = autoHeight
      ? container.clientHeight || fallbackHeight
      : fallbackHeight;
    chart.applyOptions({
      width: container.clientWidth,
      height: newHeight,
    });
    chart.timeScale().fitContent();
  };
};

/**
 * Richtet Resize-Listener ein und gibt eine Cleanup-Funktion zurück
 */
export const setupResizeListeners = (
  container: HTMLDivElement,
  chart: IChartApi,
  handleResize: () => void
): (() => void) => {
  window.addEventListener('resize', handleResize);

  const resizeObserver = new ResizeObserver(() => {
    handleResize();
  });
  resizeObserver.observe(container);

  return () => {
    window.removeEventListener('resize', handleResize);
    resizeObserver.disconnect();
    chart.remove();
  };
};

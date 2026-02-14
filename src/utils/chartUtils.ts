import { ColorType } from 'lightweight-charts';
import type { ChartOptions, DeepPartial, IChartApi } from 'lightweight-charts';
import type { Theme } from '../hooks/useTheme';
import type { FormatLocale } from './formatting';

interface ChartSizeOptions {
  width: number;
  height: number;
}

interface TimeScaleOptions {
  timeVisible?: boolean;
  secondsVisible?: boolean;
}

/**
 * Formats price values for the chart Y-axis based on locale.
 */
const createPriceFormatter = (locale: FormatLocale) => {
  const localeString = locale === 'de' ? 'de-DE' : 'en-US';
  return (price: number): string => {
    return price.toLocaleString(localeString, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };
};

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
      fontFamily: undefined,
    };
  }
  if (theme === 'medieval') {
    return {
      background: 'rgba(221, 208, 184, 0.2)',
      textColor: '#1a1410',
      gridColor: '#c8b898',
      borderColor: '#8b7355',
      upColor: '#2d5a3d',
      downColor: '#8b2c2c',
      lineColor: '#4a3728',
      areaTopColor: 'rgba(74, 55, 40, 0.3)',
      areaBottomColor: 'rgba(74, 55, 40, 0.0)',
      fontFamily: "'Pirata One', serif",
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
    fontFamily: undefined,
  };
};

/**
 * Formats a UTC timestamp to local time string.
 * lightweight-charts passes UTC timestamps, we convert to local time display.
 */
const formatTimeToLocal = (utcTimestamp: number): string => {
  const date = new Date(utcTimestamp * 1000);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/**
 * Formats tick marks on the X-axis to local time.
 * This is used for the timescale labels.
 */
const formatTickMarkToLocal = (utcTimestamp: number): string => {
  const date = new Date(utcTimestamp * 1000);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/**
 * Erstellt Standard-Chart-Optionen für alle Charts in der App
 */
export const getDefaultChartOptions = (
  size: ChartSizeOptions,
  timeScale?: TimeScaleOptions,
  theme: Theme = 'dark',
  locale: FormatLocale = 'en'
): DeepPartial<ChartOptions> => {
  const colors = getChartColors(theme);
  return {
    width: size.width,
    height: size.height,
    layout: {
      background: { type: ColorType.Solid, color: colors.background },
      textColor: colors.textColor,
      fontFamily: colors.fontFamily,
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
      tickMarkFormatter: formatTickMarkToLocal,
    },
    localization: {
      timeFormatter: formatTimeToLocal,
      priceFormatter: createPriceFormatter(locale),
    },
    // Disable zoom and scroll interactions
    handleScroll: false,
    handleScale: false,
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

  // Trigger initial resize after layout stabilizes (fixes theme switch issues)
  const rafId = requestAnimationFrame(() => {
    handleResize();
  });

  return () => {
    window.removeEventListener('resize', handleResize);
    resizeObserver.disconnect();
    cancelAnimationFrame(rafId);
    chart.remove();
  };
};

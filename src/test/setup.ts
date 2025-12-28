import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Import actual i18n to make translations work in tests
import '../i18n';

// Global mock for lightweight-charts (needed by all chart tests)
vi.mock('lightweight-charts', () => ({
  createChart: () => ({
    addSeries: () => ({
      setData: vi.fn(),
      applyOptions: vi.fn(),
    }),
    applyOptions: vi.fn(),
    timeScale: () => ({
      fitContent: vi.fn(),
    }),
    priceScale: () => ({
      applyOptions: vi.fn(),
    }),
    remove: vi.fn(),
  }),
  ColorType: { Solid: 'solid' },
  CandlestickSeries: 'CandlestickSeries',
  LineSeries: 'LineSeries',
  AreaSeries: 'AreaSeries',
}));

// Global mock for ResizeObserver
global.ResizeObserver = vi.fn(function () {
  return {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  };
}) as unknown as typeof ResizeObserver;

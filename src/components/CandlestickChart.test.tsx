import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import CandlestickChart from './CandlestickChart';
import type { CandleData } from '../types';

// Mock lightweight-charts
const mockSetData = vi.fn();
const mockFitContent = vi.fn();
const mockApplyOptions = vi.fn();
const mockRemove = vi.fn();
const mockAddSeries = vi.fn(() => ({
  setData: mockSetData,
}));
const mockTimeScale = vi.fn(() => ({
  fitContent: mockFitContent,
}));

const mockChart = {
  addSeries: mockAddSeries,
  applyOptions: mockApplyOptions,
  timeScale: mockTimeScale,
  remove: mockRemove,
};

vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => mockChart),
  ColorType: { Solid: 'solid' },
  CandlestickSeries: 'CandlestickSeries',
  LineSeries: 'LineSeries',
  AreaSeries: 'AreaSeries',
}));

// Mock ResizeObserver as a class
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();
class MockResizeObserver {
  observe = mockObserve;
  unobserve = vi.fn();
  disconnect = mockDisconnect;
  constructor(_callback: ResizeObserverCallback) {}
}

describe('CandlestickChart', () => {
  const mockData: CandleData[] = [
    { time: 1000, open: 100, high: 110, low: 95, close: 105 },
    { time: 2000, open: 105, high: 115, low: 100, close: 110 },
    { time: 3000, open: 110, high: 120, low: 108, close: 115 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('should render chart container', () => {
      const { container } = render(<CandlestickChart data={mockData} />);
      expect(container.querySelector('.candlestick-chart')).toBeInTheDocument();
      expect(container.querySelector('.candlestick-chart__canvas')).toBeInTheDocument();
    });

    it('should create chart on mount', async () => {
      const { createChart } = await import('lightweight-charts');
      render(<CandlestickChart data={mockData} />);
      expect(createChart).toHaveBeenCalled();
    });

    it('should add candlestick series by default', () => {
      render(<CandlestickChart data={mockData} />);
      expect(mockAddSeries).toHaveBeenCalledWith('CandlestickSeries', expect.objectContaining({
        upColor: '#26a69a',
        downColor: '#ef5350',
      }));
    });

    it('should add line series when type is line', () => {
      render(<CandlestickChart data={mockData} type="line" />);
      expect(mockAddSeries).toHaveBeenCalledWith('LineSeries', expect.objectContaining({
        color: '#00d4ff',
        lineWidth: 2,
      }));
    });

    it('should add area series when type is area', () => {
      render(<CandlestickChart data={mockData} type="area" />);
      expect(mockAddSeries).toHaveBeenCalledWith('AreaSeries', expect.objectContaining({
        topColor: 'rgba(0, 212, 255, 0.4)',
        bottomColor: 'rgba(0, 212, 255, 0.0)',
        lineColor: '#00d4ff',
        lineWidth: 2,
      }));
    });
  });

  describe('data handling', () => {
    it('should set candlestick data when type is candlestick', () => {
      render(<CandlestickChart data={mockData} type="candlestick" />);

      expect(mockSetData).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            time: 1000,
            open: 100,
            high: 110,
            low: 95,
            close: 105,
          }),
        ])
      );
    });

    it('should set line data when type is line', () => {
      render(<CandlestickChart data={mockData} type="line" />);

      expect(mockSetData).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            time: 1000,
            value: 105, // close price
          }),
        ])
      );
    });

    it('should set area data when type is area', () => {
      render(<CandlestickChart data={mockData} type="area" />);

      expect(mockSetData).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            time: 1000,
            value: 105, // close price
          }),
        ])
      );
    });

    it('should not set data when data array is empty', () => {
      mockSetData.mockClear();
      render(<CandlestickChart data={[]} />);
      expect(mockSetData).not.toHaveBeenCalled();
    });

    it('should call fitContent after setting data', () => {
      render(<CandlestickChart data={mockData} />);
      expect(mockTimeScale).toHaveBeenCalled();
      expect(mockFitContent).toHaveBeenCalled();
    });
  });

  describe('chart configuration', () => {
    it('should create chart with dark theme colors', async () => {
      const { createChart } = await import('lightweight-charts');
      render(<CandlestickChart data={mockData} />);

      expect(createChart).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({
          height: 400,
          layout: expect.objectContaining({
            background: expect.objectContaining({ color: '#1a1a2e' }),
            textColor: '#d1d4dc',
          }),
        })
      );
    });

    it('should configure grid with dark colors', async () => {
      const { createChart } = await import('lightweight-charts');
      render(<CandlestickChart data={mockData} />);

      expect(createChart).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({
          grid: expect.objectContaining({
            vertLines: { color: '#2a2a4a' },
            horzLines: { color: '#2a2a4a' },
          }),
        })
      );
    });

    it('should enable time visibility on time scale (without seconds)', async () => {
      const { createChart } = await import('lightweight-charts');
      render(<CandlestickChart data={mockData} />);

      expect(createChart).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({
          timeScale: expect.objectContaining({
            timeVisible: true,
            secondsVisible: false,
          }),
        })
      );
    });
  });

  describe('cleanup', () => {
    it('should remove chart on unmount', () => {
      const { unmount } = render(<CandlestickChart data={mockData} />);
      unmount();
      expect(mockRemove).toHaveBeenCalled();
    });

    it('should disconnect ResizeObserver on unmount', () => {
      const { unmount } = render(<CandlestickChart data={mockData} />);
      unmount();
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  describe('resize handling', () => {
    it('should set up ResizeObserver on mount', () => {
      render(<CandlestickChart data={mockData} />);
      expect(mockObserve).toHaveBeenCalled();
    });

    it('should add window resize listener on mount', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      render(<CandlestickChart data={mockData} />);
      expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
      addEventListenerSpy.mockRestore();
    });

    it('should remove window resize listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const { unmount } = render(<CandlestickChart data={mockData} />);
      unmount();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('data updates', () => {
    it('should update chart data when props change', () => {
      const { rerender } = render(<CandlestickChart data={mockData} />);

      const newData: CandleData[] = [
        { time: 4000, open: 115, high: 125, low: 112, close: 120 },
      ];

      mockSetData.mockClear();
      rerender(<CandlestickChart data={newData} />);

      expect(mockSetData).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            time: 4000,
            open: 115,
            close: 120,
          }),
        ])
      );
    });
  });
});

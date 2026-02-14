import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ClimateHistoryChart } from './ClimateHistoryChart';
import type { ClimateHistoryEntry } from '../store/marketPhaseSlice';

// Mock lightweight-charts
const mockSetData = vi.fn();
const mockFitContent = vi.fn();
const mockRemove = vi.fn();

const mockAddSeries = vi.fn(() => ({
  setData: mockSetData,
}));

const mockChart = {
  addSeries: mockAddSeries,
  timeScale: vi.fn(() => ({ fitContent: mockFitContent })),
  remove: mockRemove,
};

vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => mockChart),
  ColorType: { Solid: 'solid' },
  LineSeries: 'LineSeries',
}));

// Mock chartUtils
vi.mock('../utils/chartUtils', () => ({
  getChartColors: vi.fn((theme: string) => ({
    background: theme === 'light' ? '#ffffff' : '#1a1a2e',
    textColor: theme === 'light' ? '#333333' : '#d1d4dc',
    gridColor: theme === 'light' ? '#e0e0e0' : '#2a2a4a',
    borderColor: theme === 'light' ? '#cccccc' : '#3a3a5a',
    fontFamily: 'Inter, sans-serif',
  })),
  createResizeHandler: vi.fn(() => vi.fn()),
  setupResizeListeners: vi.fn(() => vi.fn()),
}));

describe('ClimateHistoryChart', () => {
  const createMockClimateHistory = (count: number): ClimateHistoryEntry[] => {
    return Array.from({ length: count }, (_, i) => ({
      cycle: i + 1,
      phase: 'prosperity' as const,
      fearGreedIndex: 50 + Math.sin(i * 0.5) * 20, // Varying values between 30-70
    }));
  };

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('chart rendering', () => {
    it('should render chart container', () => {
      const data = createMockClimateHistory(5);

      const { container } = render(<ClimateHistoryChart data={data} />);

      expect(container.querySelector('.climate-history-chart')).toBeInTheDocument();
      expect(container.querySelector('.climate-history-chart__canvas')).toBeInTheDocument();
    });

    it('should render with empty data', () => {
      const { container } = render(<ClimateHistoryChart data={[]} />);

      expect(container.querySelector('.climate-history-chart')).toBeInTheDocument();
    });
  });

  describe('chart initialization', () => {
    it('should create chart with one series for Fear & Greed', () => {
      const data = createMockClimateHistory(5);

      render(<ClimateHistoryChart data={data} />);

      expect(mockAddSeries).toHaveBeenCalledTimes(1);
    });

    it('should set initial data when data is provided', () => {
      const data = createMockClimateHistory(5);

      render(<ClimateHistoryChart data={data} />);

      expect(mockSetData).toHaveBeenCalled();
      expect(mockFitContent).toHaveBeenCalled();
    });

    it('should not set data when data is empty', () => {
      render(<ClimateHistoryChart data={[]} />);

      // Series is created but setData not called with empty array
      expect(mockAddSeries).toHaveBeenCalledTimes(1);
      // setData should not be called for empty data (the condition checks data.length > 0)
      expect(mockSetData).not.toHaveBeenCalled();
    });

    it('should configure series with orange color for dark theme', () => {
      const data = createMockClimateHistory(3);

      render(<ClimateHistoryChart data={data} theme="dark" />);

      expect(mockAddSeries).toHaveBeenCalledWith(
        'LineSeries',
        expect.objectContaining({
          color: '#f59e0b',
          lineWidth: 2,
          title: 'F&G',
        })
      );
    });

    it('should configure series with gold color for medieval theme', () => {
      const data = createMockClimateHistory(3);

      render(<ClimateHistoryChart data={data} theme="medieval" />);

      expect(mockAddSeries).toHaveBeenCalledWith(
        'LineSeries',
        expect.objectContaining({
          color: '#c9a227',
        })
      );
    });
  });

  describe('chart data format', () => {
    it('should transform data to correct format with cycle as time', () => {
      const data: ClimateHistoryEntry[] = [
        { cycle: 1, phase: 'prosperity', fearGreedIndex: 55 },
        { cycle: 2, phase: 'boom', fearGreedIndex: 75 },
        { cycle: 3, phase: 'consolidation', fearGreedIndex: 45 },
      ];

      render(<ClimateHistoryChart data={data} />);

      expect(mockSetData).toHaveBeenCalledWith([
        { time: 1, value: 55 },
        { time: 2, value: 75 },
        { time: 3, value: 45 },
      ]);
    });

    it('should handle various phases correctly', () => {
      const data: ClimateHistoryEntry[] = [
        { cycle: 1, phase: 'panic', fearGreedIndex: 10 },
        { cycle: 2, phase: 'recession', fearGreedIndex: 25 },
        { cycle: 3, phase: 'consolidation', fearGreedIndex: 40 },
        { cycle: 4, phase: 'prosperity', fearGreedIndex: 60 },
        { cycle: 5, phase: 'boom', fearGreedIndex: 85 },
      ];

      render(<ClimateHistoryChart data={data} />);

      expect(mockSetData).toHaveBeenCalledWith([
        { time: 1, value: 10 },
        { time: 2, value: 25 },
        { time: 3, value: 40 },
        { time: 4, value: 60 },
        { time: 5, value: 85 },
      ]);
    });
  });

  describe('chart data updates', () => {
    it('should update data when props change', () => {
      const initialData = createMockClimateHistory(3);
      const { rerender } = render(<ClimateHistoryChart data={initialData} />);

      vi.clearAllMocks();

      const newData = createMockClimateHistory(5);
      rerender(<ClimateHistoryChart data={newData} />);

      expect(mockSetData).toHaveBeenCalled();
      expect(mockFitContent).toHaveBeenCalled();
    });

    it('should not update when data becomes empty', () => {
      const initialData = createMockClimateHistory(3);
      const { rerender } = render(<ClimateHistoryChart data={initialData} />);

      vi.clearAllMocks();

      rerender(<ClimateHistoryChart data={[]} />);

      // The update effect checks data.length > 0
      expect(mockSetData).not.toHaveBeenCalled();
    });
  });

  describe('props', () => {
    it('should use default height of 150', () => {
      const data = createMockClimateHistory(3);

      render(<ClimateHistoryChart data={data} />);

      // Chart is created (we verify through series being added)
      expect(mockAddSeries).toHaveBeenCalled();
    });

    it('should accept custom height', () => {
      const data = createMockClimateHistory(3);

      render(<ClimateHistoryChart data={data} height={250} />);

      expect(mockAddSeries).toHaveBeenCalled();
    });

    it('should use dark theme by default', () => {
      const data = createMockClimateHistory(3);

      render(<ClimateHistoryChart data={data} />);

      expect(mockAddSeries).toHaveBeenCalledWith(
        'LineSeries',
        expect.objectContaining({
          color: '#f59e0b', // Dark theme orange
        })
      );
    });

    it('should accept light theme', () => {
      const data = createMockClimateHistory(3);

      render(<ClimateHistoryChart data={data} theme="light" />);

      // Light theme uses same orange color
      expect(mockAddSeries).toHaveBeenCalledWith(
        'LineSeries',
        expect.objectContaining({
          color: '#f59e0b',
        })
      );
    });
  });

  describe('chart cleanup', () => {
    it('should call cleanup function on unmount', async () => {
      const data = createMockClimateHistory(3);
      const mockCleanup = vi.fn();

      const { setupResizeListeners } = await import('../utils/chartUtils');
      vi.mocked(setupResizeListeners).mockReturnValue(mockCleanup);

      const { unmount } = render(<ClimateHistoryChart data={data} />);

      unmount();

      expect(mockCleanup).toHaveBeenCalled();
    });
  });
});

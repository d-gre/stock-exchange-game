import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TradeHistoryChart } from './TradeHistoryChart';
import type { CompletedTrade } from '../types';

// Mock lightweight-charts
const mockSetData = vi.fn();
const mockApplyOptions = vi.fn();
const mockFitContent = vi.fn();
const mockRemove = vi.fn();
const mockPriceScaleApplyOptions = vi.fn();

const mockAddSeries = vi.fn(() => ({
  setData: mockSetData,
  applyOptions: mockApplyOptions,
}));

const mockChart = {
  addSeries: mockAddSeries,
  applyOptions: vi.fn(),
  timeScale: vi.fn(() => ({ fitContent: mockFitContent })),
  priceScale: vi.fn(() => ({ applyOptions: mockPriceScaleApplyOptions })),
  remove: mockRemove,
};

vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => mockChart),
  ColorType: { Solid: 'solid' },
  LineSeries: 'LineSeries',
  AreaSeries: 'AreaSeries',
}));

// Mock chartUtils
vi.mock('../utils/chartUtils', () => ({
  getDefaultChartOptions: vi.fn(() => ({})),
  getChartColors: vi.fn((theme: string) => ({
    background: theme === 'light' ? '#ffffff' : '#1a1a2e',
    textColor: theme === 'light' ? '#333333' : '#d1d4dc',
    gridColor: theme === 'light' ? '#e0e0e0' : '#2a2a4a',
    borderColor: theme === 'light' ? '#cccccc' : '#3a3a5a',
    upColor: theme === 'light' ? '#198754' : '#26a69a',
    downColor: theme === 'light' ? '#dc3545' : '#ef5350',
    lineColor: theme === 'light' ? '#0099cc' : '#00d4ff',
    areaTopColor: theme === 'light' ? 'rgba(0, 153, 204, 0.3)' : 'rgba(0, 212, 255, 0.4)',
    areaBottomColor: theme === 'light' ? 'rgba(0, 153, 204, 0.0)' : 'rgba(0, 212, 255, 0.0)',
  })),
  createResizeHandler: vi.fn(() => vi.fn()),
  setupResizeListeners: vi.fn(() => vi.fn()),
}));

describe('TradeHistoryChart', () => {
  const createMockTrade = (overrides: Partial<CompletedTrade> = {}): CompletedTrade => ({
    id: 'trade-1',
    symbol: 'AAPL',
    type: 'buy',
    shares: 10,
    pricePerShare: 150,
    totalAmount: 1500,
    timestamp: Date.now(),
    ...overrides,
  });

  const createMockPortfolioHistory = (count: number, startPL = 0) => {
    return Array.from({ length: count }, (_, i) => ({
      timestamp: Date.now() + i * 1000,
      value: 10000 + i * 100,
      realizedProfitLoss: startPL + i * 10,
    }));
  };

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('empty state', () => {
    it('should show empty message when no trades and minimal history', () => {
      render(
        <TradeHistoryChart
          trades={[]}
          portfolioValueHistory={[{ timestamp: Date.now(), value: 10000, realizedProfitLoss: 0 }]}
        />
      );

      expect(screen.getByText('Noch keine Trades durchgeführt')).toBeInTheDocument();
      expect(screen.getByText(/Kaufen oder verkaufen Sie Aktien/)).toBeInTheDocument();
    });

    it('should show empty message when no trades and empty history', () => {
      render(
        <TradeHistoryChart
          trades={[]}
          portfolioValueHistory={[]}
        />
      );

      expect(screen.getByText('Noch keine Trades durchgeführt')).toBeInTheDocument();
    });
  });

  describe('chart rendering', () => {
    it('should render chart when trades exist', () => {
      const trades = [createMockTrade()];
      const history = createMockPortfolioHistory(5);

      const { container } = render(
        <TradeHistoryChart trades={trades} portfolioValueHistory={history} />
      );

      expect(container.querySelector('.trade-history-chart')).toBeInTheDocument();
      expect(container.querySelector('.trade-history-chart__canvas')).toBeInTheDocument();
    });

    it('should render chart when history has more than one entry', () => {
      const history = createMockPortfolioHistory(3);

      const { container } = render(
        <TradeHistoryChart trades={[]} portfolioValueHistory={history} />
      );

      expect(container.querySelector('.trade-history-chart')).toBeInTheDocument();
    });

    it('should render legend with correct labels', () => {
      const trades = [createMockTrade()];
      const history = createMockPortfolioHistory(2);

      render(<TradeHistoryChart trades={trades} portfolioValueHistory={history} />);

      expect(screen.getByText('Portfolio-Wert')).toBeInTheDocument();
      expect(screen.getByText('Realisierter G/V')).toBeInTheDocument();
    });

    it('should add auto-height class when autoHeight is true', () => {
      const trades = [createMockTrade()];
      const history = createMockPortfolioHistory(2);

      const { container } = render(
        <TradeHistoryChart trades={trades} portfolioValueHistory={history} autoHeight />
      );

      expect(container.querySelector('.trade-history-chart.trade-history-chart--auto-height')).toBeInTheDocument();
    });

    it('should not have auto-height class when autoHeight is false', () => {
      const trades = [createMockTrade()];
      const history = createMockPortfolioHistory(2);

      const { container } = render(
        <TradeHistoryChart trades={trades} portfolioValueHistory={history} autoHeight={false} />
      );

      expect(container.querySelector('.trade-history-chart.trade-history-chart--auto-height')).not.toBeInTheDocument();
    });
  });

  describe('chart data updates', () => {
    it('should set chart data when portfolioValueHistory changes', () => {
      const trades = [createMockTrade()];
      const history = createMockPortfolioHistory(3);

      render(<TradeHistoryChart trades={trades} portfolioValueHistory={history} />);

      // setData should be called for both P&L and value series
      expect(mockSetData).toHaveBeenCalled();
    });

    it('should apply green colors for positive P/L', () => {
      const trades = [createMockTrade()];
      const history = createMockPortfolioHistory(3, 100); // Positive P/L

      render(<TradeHistoryChart trades={trades} portfolioValueHistory={history} />);

      expect(mockApplyOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          lineColor: '#26a69a',
        })
      );
    });

    it('should apply red colors for negative P/L', () => {
      const trades = [createMockTrade()];
      const history = [
        { timestamp: Date.now(), value: 10000, realizedProfitLoss: -50 },
        { timestamp: Date.now() + 1000, value: 9900, realizedProfitLoss: -100 },
      ];

      render(<TradeHistoryChart trades={trades} portfolioValueHistory={history} />);

      expect(mockApplyOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          lineColor: '#ef5350',
        })
      );
    });
  });

  describe('chart initialization', () => {
    it('should create chart with two series', () => {
      const trades = [createMockTrade()];
      const history = createMockPortfolioHistory(2);

      render(<TradeHistoryChart trades={trades} portfolioValueHistory={history} />);

      // Should add Area series for P&L and Line series for value
      expect(mockAddSeries).toHaveBeenCalledTimes(2);
    });

    it('should configure left price scale', () => {
      const trades = [createMockTrade()];
      const history = createMockPortfolioHistory(2);

      render(<TradeHistoryChart trades={trades} portfolioValueHistory={history} />);

      expect(mockChart.priceScale).toHaveBeenCalledWith('left');
      expect(mockPriceScaleApplyOptions).toHaveBeenCalledWith(
        expect.objectContaining({ visible: true })
      );
    });
  });

  describe('props', () => {
    it('should use default height of 300', () => {
      const trades = [createMockTrade()];
      const history = createMockPortfolioHistory(2);

      render(<TradeHistoryChart trades={trades} portfolioValueHistory={history} />);

      // Chart should be created (we can't easily check height without more mocking)
      expect(mockChart.addSeries).toHaveBeenCalled();
    });

    it('should accept custom height', () => {
      const trades = [createMockTrade()];
      const history = createMockPortfolioHistory(2);

      render(<TradeHistoryChart trades={trades} portfolioValueHistory={history} height={500} />);

      expect(mockChart.addSeries).toHaveBeenCalled();
    });
  });

  describe('duplicate timestamp handling', () => {
    it('should deduplicate entries with same second timestamp', () => {
      const trades = [createMockTrade()];
      const baseTime = 1700000000000; // Fixed base timestamp in ms
      // Multiple entries that map to same second (within 1000ms)
      const history = [
        { timestamp: baseTime, value: 10000, realizedProfitLoss: 0 },
        { timestamp: baseTime + 100, value: 10050, realizedProfitLoss: 10 },
        { timestamp: baseTime + 500, value: 10100, realizedProfitLoss: 20 },
        { timestamp: baseTime + 1000, value: 10200, realizedProfitLoss: 30 }, // Next second
      ];

      render(<TradeHistoryChart trades={trades} portfolioValueHistory={history} />);

      // setData should be called with deduplicated data
      expect(mockSetData).toHaveBeenCalled();

      // Get the data passed to setData (called for both P&L and value series)
      const setDataCalls = mockSetData.mock.calls;
      // Each series gets called once, check that data has no duplicate times
      setDataCalls.forEach(([data]) => {
        const times = data.map((d: { time: number }) => d.time);
        const uniqueTimes = [...new Set(times)];
        expect(times.length).toBe(uniqueTimes.length);
      });
    });

    it('should keep last value when deduplicating same-second entries', () => {
      const trades = [createMockTrade()];
      const baseTime = 1700000000000;
      // All entries map to same second - should keep the last one (value: 10300)
      const history = [
        { timestamp: baseTime, value: 10000, realizedProfitLoss: 0 },
        { timestamp: baseTime + 100, value: 10100, realizedProfitLoss: 10 },
        { timestamp: baseTime + 200, value: 10200, realizedProfitLoss: 20 },
        { timestamp: baseTime + 300, value: 10300, realizedProfitLoss: 30 },
      ];

      render(<TradeHistoryChart trades={trades} portfolioValueHistory={history} />);

      // Find the value series data (second call to setData)
      const valueSeriesData = mockSetData.mock.calls[1][0];

      // Should only have 1 entry (all mapped to same second)
      expect(valueSeriesData.length).toBe(1);
      // Should keep the last value
      expect(valueSeriesData[0].value).toBe(10300);
    });

    it('should sort entries by time in ascending order', () => {
      const trades = [createMockTrade()];
      // Unsorted history entries
      const history = [
        { timestamp: 1700003000000, value: 10300, realizedProfitLoss: 30 },
        { timestamp: 1700001000000, value: 10100, realizedProfitLoss: 10 },
        { timestamp: 1700002000000, value: 10200, realizedProfitLoss: 20 },
      ];

      render(<TradeHistoryChart trades={trades} portfolioValueHistory={history} />);

      // Get the data passed to setData
      const setDataCalls = mockSetData.mock.calls;
      setDataCalls.forEach(([data]) => {
        for (let i = 1; i < data.length; i++) {
          expect(data[i].time).toBeGreaterThan(data[i - 1].time);
        }
      });
    });
  });
});

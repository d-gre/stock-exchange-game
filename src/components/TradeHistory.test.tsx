import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TradeHistory } from './TradeHistory';
import type { CompletedTrade, RiskProfileAnalysis } from '../types';
import {
  selectAllTrades,
  selectPortfolioValueHistory,
  selectRiskProfile,
} from '../store/tradeHistorySlice';

// Mock data
let mockTrades: CompletedTrade[] = [];
let mockPortfolioHistory: Array<{ timestamp: number; value: number; realizedProfitLoss: number }> = [];
let mockRiskProfile: RiskProfileAnalysis | null = null;

vi.mock('../store/hooks', () => ({
  useAppSelector: (selector: unknown) => {
    if (selector === selectAllTrades) return mockTrades;
    if (selector === selectPortfolioValueHistory) return mockPortfolioHistory;
    if (selector === selectRiskProfile) return mockRiskProfile;
    return null;
  },
}));

// Mock TradeHistoryChart to simplify testing
vi.mock('./TradeHistoryChart', () => ({
  TradeHistoryChart: ({ trades, portfolioValueHistory, autoHeight }: {
    trades: CompletedTrade[];
    portfolioValueHistory: unknown[];
    autoHeight?: boolean;
  }) => (
    <div
      data-testid="trade-history-chart"
      data-trades={trades.length}
      data-history={portfolioValueHistory.length}
      data-autoheight={autoHeight}
    >
      Mocked Chart
    </div>
  ),
}));

describe('TradeHistory', () => {
  const createMockTrade = (overrides: Partial<CompletedTrade> = {}): CompletedTrade => ({
    id: `trade-${Date.now()}-${Math.random()}`,
    symbol: 'AAPL',
    type: 'buy',
    shares: 10,
    pricePerShare: 150,
    totalAmount: 1500,
    timestamp: Date.now(),
    ...overrides,
  });

  const createMockRiskProfile = (overrides: Partial<RiskProfileAnalysis> = {}): RiskProfileAnalysis => ({
    riskScore: 25,
    category: 'moderate',
    avgPositionSizePercent: 15,
    avgHoldingDuration: 120,
    totalTrades: 10,
    winLossRatio: 1.5,
    avgWin: 100,
    avgLoss: 50,
    totalRealizedProfitLoss: 500,
    ...overrides,
  });

  beforeEach(() => {
    cleanup();
    mockTrades = [];
    mockPortfolioHistory = [];
    mockRiskProfile = null;
  });

  describe('header', () => {
    it('should render header with title', () => {
      render(<TradeHistory />);
      expect(screen.getByText('Order-Historie')).toBeInTheDocument();
    });

    it('should show buy stats', () => {
      mockTrades = [
        createMockTrade({ type: 'buy', totalAmount: 1000 }),
        createMockTrade({ type: 'buy', totalAmount: 500 }),
      ];

      render(<TradeHistory />);

      expect(screen.getByText(/2 Käufe/)).toBeInTheDocument();
    });

    it('should show sell stats', () => {
      mockTrades = [
        createMockTrade({ type: 'sell', totalAmount: 2000 }),
      ];

      render(<TradeHistory />);

      expect(screen.getByText(/1 Verkäufe/)).toBeInTheDocument();
    });
  });

  describe('chart section', () => {
    it('should render TradeHistoryChart with autoHeight', () => {
      mockTrades = [createMockTrade()];
      mockPortfolioHistory = [{ timestamp: Date.now(), value: 10000, realizedProfitLoss: 0 }];

      render(<TradeHistory />);

      const chart = screen.getByTestId('trade-history-chart');
      expect(chart).toBeInTheDocument();
      expect(chart).toHaveAttribute('data-autoheight', 'true');
    });
  });

  describe('risk profile card', () => {
    it('should not render risk profile when null', () => {
      mockRiskProfile = null;

      render(<TradeHistory />);

      expect(screen.queryByText('Ihr Risikoprofil')).not.toBeInTheDocument();
    });

    it('should render risk profile when available', () => {
      mockRiskProfile = createMockRiskProfile();

      render(<TradeHistory />);

      expect(screen.getByText('Ihr Risikoprofil')).toBeInTheDocument();
    });

    it('should show correct category label for conservative', () => {
      mockRiskProfile = createMockRiskProfile({ category: 'conservative', riskScore: -50 });

      render(<TradeHistory />);

      expect(screen.getByText('Konservativ')).toBeInTheDocument();
    });

    it('should show correct category label for moderate', () => {
      mockRiskProfile = createMockRiskProfile({ category: 'moderate', riskScore: 0 });

      render(<TradeHistory />);

      expect(screen.getByText('Moderat')).toBeInTheDocument();
    });

    it('should show correct category label for aggressive', () => {
      mockRiskProfile = createMockRiskProfile({ category: 'aggressive', riskScore: 75 });

      render(<TradeHistory />);

      expect(screen.getByText('Aggressiv')).toBeInTheDocument();
    });

    it('should display risk stats', () => {
      mockRiskProfile = createMockRiskProfile({
        totalTrades: 15,
        avgPositionSizePercent: 20.5,
        winLossRatio: 2.0,
      });

      render(<TradeHistory />);

      expect(screen.getByText('Trades')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('Avg. Position')).toBeInTheDocument();
      expect(screen.getByText('20.5%')).toBeInTheDocument();
      expect(screen.getByText('Win/Loss')).toBeInTheDocument();
      expect(screen.getByText('2.00')).toBeInTheDocument();
    });

    it('should show 100% for infinite win/loss ratio', () => {
      mockRiskProfile = createMockRiskProfile({ winLossRatio: Infinity });

      render(<TradeHistory />);

      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('should show positive realized P/L with correct styling', () => {
      mockRiskProfile = createMockRiskProfile({ totalRealizedProfitLoss: 1000 });

      const { container } = render(<TradeHistory />);

      const plElement = container.querySelector('.trade-history__total-pl.trade-history__total-pl--positive');
      expect(plElement).toBeInTheDocument();
    });

    it('should show negative realized P/L with correct styling', () => {
      mockRiskProfile = createMockRiskProfile({ totalRealizedProfitLoss: -500 });

      const { container } = render(<TradeHistory />);

      const plElement = container.querySelector('.trade-history__total-pl.trade-history__total-pl--negative');
      expect(plElement).toBeInTheDocument();
    });
  });

  describe('trade list', () => {
    it('should show empty message when no trades', () => {
      mockTrades = [];

      render(<TradeHistory />);

      expect(screen.getByText('Noch keine Trades vorhanden')).toBeInTheDocument();
    });

    it('should render trade list header', () => {
      mockTrades = [createMockTrade()];

      render(<TradeHistory />);

      expect(screen.getByText('Zeit')).toBeInTheDocument();
      expect(screen.getByText('Typ')).toBeInTheDocument();
      expect(screen.getByText('Symbol')).toBeInTheDocument();
      expect(screen.getByText('Stk.')).toBeInTheDocument();
      expect(screen.getByText('Preis')).toBeInTheDocument();
      expect(screen.getByText('Gesamt')).toBeInTheDocument();
      expect(screen.getByText('G/V')).toBeInTheDocument();
    });

    it('should display buy trades correctly', () => {
      mockTrades = [createMockTrade({ type: 'buy', symbol: 'GOOGL' })];

      render(<TradeHistory />);

      expect(screen.getByText('KAUF')).toBeInTheDocument();
      expect(screen.getByText('GOOGL')).toBeInTheDocument();
    });

    it('should display sell trades correctly', () => {
      mockTrades = [createMockTrade({ type: 'sell', symbol: 'MSFT' })];

      render(<TradeHistory />);

      expect(screen.getByText('VERKAUF')).toBeInTheDocument();
      expect(screen.getByText('MSFT')).toBeInTheDocument();
    });

    it('should show realized P/L for sell trades', () => {
      mockTrades = [
        createMockTrade({
          type: 'sell',
          realizedProfitLoss: 150.50,
        }),
      ];

      render(<TradeHistory />);

      expect(screen.getByText(/\+\$150,50/)).toBeInTheDocument();
    });

    it('should show negative P/L correctly', () => {
      mockTrades = [
        createMockTrade({
          type: 'sell',
          realizedProfitLoss: -75.25,
        }),
      ];

      render(<TradeHistory />);

      expect(screen.getByText(/\$-75,25/)).toBeInTheDocument();
    });

    it('should show dash for trades without P/L', () => {
      mockTrades = [createMockTrade({ type: 'buy' })];

      render(<TradeHistory />);

      const rows = screen.getAllByText('-');
      expect(rows.length).toBeGreaterThan(0);
    });

    it('should limit displayed trades to 20', () => {
      mockTrades = Array.from({ length: 30 }, (_, i) =>
        createMockTrade({ id: `trade-${i}`, symbol: `SYM${i}` })
      );

      render(<TradeHistory />);

      // Should only show first 20 trades
      expect(screen.getByText('SYM0')).toBeInTheDocument();
      expect(screen.getByText('SYM19')).toBeInTheDocument();
      expect(screen.queryByText('SYM20')).not.toBeInTheDocument();
    });
  });

  describe('formatting', () => {
    it('should format currency with German locale', () => {
      mockTrades = [
        createMockTrade({ pricePerShare: 1234.56, totalAmount: 12345.67 }),
      ];

      render(<TradeHistory />);

      // German format uses comma for decimals
      expect(screen.getByText('$1.234,56')).toBeInTheDocument();
    });

    it('should format time correctly', () => {
      const fixedTime = new Date('2024-01-15T14:30:45').getTime();
      mockTrades = [createMockTrade({ timestamp: fixedTime })];

      render(<TradeHistory />);

      expect(screen.getByText('14:30:45')).toBeInTheDocument();
    });
  });

  describe('failed trades', () => {
    it('should display failed trade with FEHLGESCHLAGEN label', () => {
      mockTrades = [
        createMockTrade({
          type: 'buy',
          symbol: 'AAPL',
          status: 'failed',
          failureReason: 'insufficient_funds',
        }),
      ];

      render(<TradeHistory />);

      expect(screen.getByText('KAUF')).toBeInTheDocument();
      expect(screen.getByText('AAPL')).toBeInTheDocument();
      expect(screen.getByText('FEHLGESCHLAGEN')).toBeInTheDocument();
    });

    it('should show failure reason in tooltip', () => {
      mockTrades = [
        createMockTrade({
          status: 'failed',
          failureReason: 'insufficient_funds',
        }),
      ];

      render(<TradeHistory />);

      const failedLabel = screen.getByText('FEHLGESCHLAGEN');
      expect(failedLabel).toHaveAttribute('title', 'Nicht genug Guthaben');
    });

    it('should apply failed CSS class to row', () => {
      mockTrades = [
        createMockTrade({
          status: 'failed',
          failureReason: 'insufficient_funds',
        }),
      ];

      render(<TradeHistory />);

      const row = screen.getByText('FEHLGESCHLAGEN').closest('.trade-history__list-row');
      expect(row).toHaveClass('trade-history__list-row--failed');
    });
  });
});

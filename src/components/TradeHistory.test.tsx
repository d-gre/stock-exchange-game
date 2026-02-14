import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TradeHistory } from './TradeHistory';
import type { CompletedTrade, RiskProfileAnalysis } from '../types';
import {
  selectAllTrades,
  selectPortfolioValueHistory,
  selectRiskProfile,
} from '../store/tradeHistorySlice';
import {
  selectCreditScore,
  selectCreditHistory,
  selectDelinquencyStats,
} from '../store/loansSlice';
import type { CreditScoreEvent } from '../types';

// Mock data
let mockTrades: CompletedTrade[] = [];
let mockPortfolioHistory: Array<{ timestamp: number; value: number; realizedProfitLoss: number }> = [];
let mockRiskProfile: RiskProfileAnalysis | null = null;
let mockCreditScore = 50;
let mockCreditHistory: CreditScoreEvent[] = [];
let mockDelinquencyStats = {
  totalDelinquentLoans: 0,
  activeDelinquencies: 0,
  totalOverdueCycles: 0,
  maxSingleOverdue: 0,
  avgOverdueCycles: 0,
};

vi.mock('../store/hooks', () => ({
  useAppSelector: (selector: unknown) => {
    if (selector === selectAllTrades) return mockTrades;
    if (selector === selectPortfolioValueHistory) return mockPortfolioHistory;
    if (selector === selectRiskProfile) return mockRiskProfile;
    if (selector === selectCreditScore) return mockCreditScore;
    if (selector === selectCreditHistory) return mockCreditHistory;
    if (selector === selectDelinquencyStats) return mockDelinquencyStats;
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
    mockCreditScore = 50;
    mockCreditHistory = [];
    mockDelinquencyStats = {
      totalDelinquentLoans: 0,
      activeDelinquencies: 0,
      totalOverdueCycles: 0,
      maxSingleOverdue: 0,
      avgOverdueCycles: 0,
    };
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
      expect(screen.getByText('Ø Position')).toBeInTheDocument();
      expect(screen.getByText('20.5%')).toBeInTheDocument();
      expect(screen.getByText('G/V-Verhältnis')).toBeInTheDocument();
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

      const plElement = container.querySelector('.trade-history__total-profit-loss.trade-history__total-profit-loss--positive');
      expect(plElement).toBeInTheDocument();
    });

    it('should show negative realized P/L with correct styling', () => {
      mockRiskProfile = createMockRiskProfile({ totalRealizedProfitLoss: -500 });

      const { container } = render(<TradeHistory />);

      const plElement = container.querySelector('.trade-history__total-profit-loss.trade-history__total-profit-loss--negative');
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

      expect(screen.getByText('Runde')).toBeInTheDocument();
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

      // Format is "$X,XX" with German locale (no space between $ and number)
      expect(screen.getByText(/\$150,50/)).toBeInTheDocument();
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

    it('should display cycle number instead of time', () => {
      mockTrades = [createMockTrade({ cycle: 42 })];

      render(<TradeHistory />);

      // Cycle column should show the cycle number
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('should display dash when cycle is not set', () => {
      mockTrades = [createMockTrade({ cycle: undefined })];

      render(<TradeHistory />);

      // Should show dash for missing cycle
      const rows = screen.getAllByText('-');
      expect(rows.length).toBeGreaterThan(0);
    });
  });

  describe('credit score card', () => {
    it('should display credit score gauge', () => {
      mockCreditScore = 75;

      render(<TradeHistory />);

      expect(screen.getByText('Credit Score')).toBeInTheDocument();
      expect(screen.getByText('75')).toBeInTheDocument();
    });

    it('should show excellent category for high score', () => {
      mockCreditScore = 85;

      render(<TradeHistory />);

      expect(screen.getByText('Ausgezeichnet')).toBeInTheDocument();
    });

    it('should show good category for good score', () => {
      mockCreditScore = 70;

      render(<TradeHistory />);

      expect(screen.getByText('Gut')).toBeInTheDocument();
    });

    it('should show fair category for fair score', () => {
      mockCreditScore = 40; // 25-49 = fair

      render(<TradeHistory />);

      expect(screen.getByText('Neutral')).toBeInTheDocument();
    });

    it('should show poor category for low score', () => {
      mockCreditScore = 15; // < 25 = poor

      render(<TradeHistory />);

      expect(screen.getByText('Schlecht')).toBeInTheDocument();
    });

    it('should display credit history events', () => {
      mockCreditScore = 60;
      mockCreditHistory = [
        { type: 'repaid_early', change: 5, timestamp: Date.now() },
        { type: 'repaid_on_time', change: 2, timestamp: Date.now() },
      ];

      render(<TradeHistory />);

      expect(screen.getByText('Vorzeitig getilgt')).toBeInTheDocument();
      expect(screen.getByText('Pünktlich getilgt')).toBeInTheDocument();
    });

    it('should display auto-repaid event', () => {
      mockCreditHistory = [
        { type: 'auto_repaid', change: 1, timestamp: Date.now() },
      ];

      render(<TradeHistory />);

      expect(screen.getByText('Automatisch getilgt')).toBeInTheDocument();
    });

    it('should display overdue event', () => {
      mockCreditHistory = [
        { type: 'overdue', change: -10, timestamp: Date.now() },
      ];

      render(<TradeHistory />);

      expect(screen.getByText('Überfällig')).toBeInTheDocument();
    });

    it('should display multiple overdue events with plural label', () => {
      mockCreditHistory = [
        { type: 'overdue', change: -10, timestamp: Date.now() },
        { type: 'overdue', change: -10, timestamp: Date.now() + 1000 },
      ];

      render(<TradeHistory />);

      expect(screen.getByText('Überfälligkeiten')).toBeInTheDocument();
    });

    it('should display default penalty event', () => {
      mockCreditHistory = [
        { type: 'default_penalty', change: -20, timestamp: Date.now() },
      ];

      render(<TradeHistory />);

      expect(screen.getByText('Zahlungsausfall')).toBeInTheDocument();
    });

    it('should summarize multiple events of same type', () => {
      mockCreditHistory = [
        { type: 'repaid_early', change: 5, timestamp: Date.now() },
        { type: 'repaid_early', change: 5, timestamp: Date.now() + 1000 },
      ];

      render(<TradeHistory />);

      // Should show total change of +10
      expect(screen.getByText('+10')).toBeInTheDocument();
    });
  });

  describe('delinquency stats', () => {
    it('should not show delinquency stats when no delinquent loans', () => {
      mockDelinquencyStats = {
        totalDelinquentLoans: 0,
        activeDelinquencies: 0,
        totalOverdueCycles: 0,
        maxSingleOverdue: 0,
        avgOverdueCycles: 0,
      };

      render(<TradeHistory />);

      expect(screen.queryByText('Überfälligkeiten')).not.toBeInTheDocument();
    });

    it('should show delinquency stats when there are delinquent loans', () => {
      mockDelinquencyStats = {
        totalDelinquentLoans: 2,
        activeDelinquencies: 1,
        totalOverdueCycles: 10,
        maxSingleOverdue: 6,
        avgOverdueCycles: 5,
      };

      render(<TradeHistory />);

      expect(screen.getByText('Überfälligkeiten')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // total loans
      expect(screen.getByText('10')).toBeInTheDocument(); // total cycles
      expect(screen.getByText('6')).toBeInTheDocument(); // max overdue
      expect(screen.getByText('5.0')).toBeInTheDocument(); // avg overdue
    });
  });

  describe('failed trades', () => {
    it('should display failed trade with failure reason', () => {
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
      expect(screen.getByText(/Verfallen.*Nicht genug Guthaben/)).toBeInTheDocument();
    });

    it('should show failure reason in tooltip and text', () => {
      mockTrades = [
        createMockTrade({
          status: 'failed',
          failureReason: 'insufficient_funds',
        }),
      ];

      render(<TradeHistory />);

      const failedLabel = screen.getByText(/Verfallen.*Nicht genug Guthaben/);
      expect(failedLabel).toHaveAttribute('title', 'Nicht genug Guthaben');
    });

    it('should display detailed failure reason when available', () => {
      mockTrades = [
        createMockTrade({
          status: 'failed',
          failureReason: 'expired',
          failureDetails: 'Limit von $80,00 nicht erreicht (aktuell: $100,00)',
        }),
      ];

      render(<TradeHistory />);

      // Should show "Verfallen (detailed reason)"
      expect(screen.getByText(/Verfallen.*Limit von \$80,00 nicht erreicht/)).toBeInTheDocument();
    });

    it('should apply failed CSS class to row', () => {
      mockTrades = [
        createMockTrade({
          status: 'failed',
          failureReason: 'insufficient_funds',
        }),
      ];

      render(<TradeHistory />);

      const row = screen.getByText(/Verfallen.*Nicht genug Guthaben/).closest('.trade-history__list-row');
      expect(row).toHaveClass('trade-history__list-row--failed');
    });

    it('should show insufficient_shares failure reason', () => {
      mockTrades = [
        createMockTrade({
          type: 'sell',
          status: 'failed',
          failureReason: 'insufficient_shares',
        }),
      ];

      render(<TradeHistory />);

      expect(screen.getByText(/Verfallen.*Nicht genug Aktien/)).toBeInTheDocument();
    });

    it('should show expired failure reason', () => {
      mockTrades = [
        createMockTrade({
          status: 'failed',
          failureReason: 'expired',
        }),
      ];

      render(<TradeHistory />);

      expect(screen.getByText(/Verfallen.*Order verfallen/)).toBeInTheDocument();
    });

    it('should show unknown failure reason as fallback', () => {
      mockTrades = [
        createMockTrade({
          status: 'failed',
          // No failureReason specified
        }),
      ];

      render(<TradeHistory />);

      expect(screen.getByText(/Verfallen.*Unbekannter Grund/)).toBeInTheDocument();
    });
  });

  describe('profit/loss percentage', () => {
    it('should show profit percentage for sell trades', () => {
      mockTrades = [
        createMockTrade({
          type: 'sell',
          shares: 10,
          pricePerShare: 110,
          totalAmount: 1100,
          realizedProfitLoss: 100,
          avgBuyPrice: 100, // Bought at $100, sold at $110 = 10% profit
        }),
      ];

      render(<TradeHistory />);

      // Should show P/L with percentage
      expect(screen.getByText(/\$100,00.*\(.*10.*%\)/)).toBeInTheDocument();
    });

    it('should show loss percentage for sell trades', () => {
      mockTrades = [
        createMockTrade({
          type: 'sell',
          shares: 10,
          pricePerShare: 90,
          totalAmount: 900,
          realizedProfitLoss: -100,
          avgBuyPrice: 100, // Bought at $100, sold at $90 = -10% loss
        }),
      ];

      render(<TradeHistory />);

      // Should show negative P/L with percentage
      expect(screen.getByText(/\$-100,00.*\(.*-10.*%\)/)).toBeInTheDocument();
    });

    it('should not show percentage when avgBuyPrice is missing', () => {
      mockTrades = [
        createMockTrade({
          type: 'sell',
          shares: 10,
          realizedProfitLoss: 100,
          // No avgBuyPrice
        }),
      ];

      render(<TradeHistory />);

      // Should show P/L without percentage
      const plElement = screen.getByText(/\$100,00/);
      expect(plElement.textContent).not.toMatch(/\(/);
    });
  });
});

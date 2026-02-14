import { useTranslation } from 'react-i18next';
import { PortfolioSummary } from './PortfolioSummary';
import { PortfolioAssets } from './PortfolioAssets';
import { PortfolioOrders } from './PortfolioOrders';
import { PortfolioShorts } from './PortfolioShorts';
import { LoansList } from './LoansList';
import type { Portfolio as PortfolioType, Stock, PendingOrder } from '../types';

interface PortfolioProps {
  portfolio: PortfolioType;
  stocks: Stock[];
  selectedStock: string;
  pendingOrders: PendingOrder[];
  failedOrderIds: string[];
  reservedCash: number;
  totalDebt: number;
  onSelectStock: (symbol: string) => void;
  onCancelOrder: (orderId: string) => void;
  onEditOrder: (order: PendingOrder) => void;
  onCoverPosition: (symbol: string) => void;
  onAddMargin: (symbol: string) => void;
}

export const Portfolio = ({
  portfolio,
  stocks,
  selectedStock,
  pendingOrders,
  failedOrderIds,
  reservedCash,
  totalDebt,
  onSelectStock,
  onCancelOrder,
  onEditOrder,
  onCoverPosition,
  onAddMargin,
}: PortfolioProps) => {
  const { t } = useTranslation();

  const getStockPrice = (symbol: string): number => {
    const stock = stocks.find((s) => s.symbol === symbol);
    return stock?.currentPrice ?? 0;
  };

  const calculateHoldingValue = (symbol: string, shares: number): number => {
    return shares * getStockPrice(symbol);
  };

  const totalHoldingsValue = portfolio.holdings.reduce((sum, holding) => {
    return sum + calculateHoldingValue(holding.symbol, holding.shares);
  }, 0);

  // Available cash = total cash - reserved cash for pending orders
  // Math.max prevents negative display during race conditions
  const availableCash = Math.max(0, portfolio.cash - reservedCash);

  // Total value = cash + holdings - debt
  const totalValue = portfolio.cash + totalHoldingsValue - totalDebt;

  const totalProfitLoss = portfolio.holdings.reduce((sum, holding) => {
    const currentValue = calculateHoldingValue(holding.symbol, holding.shares);
    const costBasis = holding.shares * holding.avgBuyPrice;
    return sum + (currentValue - costBasis);
  }, 0);

  return (
    <div className="portfolio">
      <h2 className="portfolio__title">{t('portfolio.title')}</h2>

      <PortfolioSummary
        availableCash={availableCash}
        reservedCash={reservedCash}
        totalHoldingsValue={totalHoldingsValue}
        totalDebt={totalDebt}
        totalValue={totalValue}
        totalProfitLoss={totalProfitLoss}
      />

      <PortfolioAssets
        holdings={portfolio.holdings}
        stocks={stocks}
        selectedStock={selectedStock}
        onSelectStock={onSelectStock}
      />

      <PortfolioOrders
        pendingOrders={pendingOrders}
        failedOrderIds={failedOrderIds}
        onCancelOrder={onCancelOrder}
        onEditOrder={onEditOrder}
      />

      <PortfolioShorts
        stocks={stocks}
        portfolio={portfolio}
        selectedStock={selectedStock}
        onSelectStock={onSelectStock}
        onCoverPosition={onCoverPosition}
        onAddMargin={onAddMargin}
      />

      <LoansList />
    </div>
  );
};

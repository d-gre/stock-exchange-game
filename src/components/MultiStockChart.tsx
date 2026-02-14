import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../store/hooks';
import { selectCreditLineInfo, selectCanTakeLoanEffective } from '../store/loansSlice';
import { selectAllFloats } from '../store/floatSlice';
import { selectAllShortPositions } from '../store/shortPositionsSlice';
import { LOAN_CONFIG, SHORT_SELLING_CONFIG } from '../config';
import CandlestickChart from './CandlestickChart';
import { PlusCircleIcon, MinusCircleIcon, TrendingDownIcon } from './Icons';
import type { Stock, PortfolioItem } from '../types';
import type { Theme } from '../hooks/useTheme';
import type { TradeType } from '../store/uiSlice';
import { formatCurrency, formatPercent, getFormatLocale } from '../utils/formatting';

interface MultiStockChartProps {
  stocks: Stock[];
  holdings: PortfolioItem[];
  selectedStock: string;
  cash: number;
  symbolsWithPendingOrders: string[];
  onSelectStock: (symbol: string) => void;
  onTrade: (symbol: string, type: TradeType) => void;
  theme?: Theme;
}

const MultiStockChart = ({
  stocks,
  holdings,
  selectedStock,
  cash,
  symbolsWithPendingOrders,
  onSelectStock,
  onTrade,
  theme = 'dark',
}: MultiStockChartProps) => {
  const { t, i18n } = useTranslation();
  const locale = getFormatLocale(i18n.language);

  // Credit line information for determining if purchase is possible with loan
  const creditLineInfo = useAppSelector(selectCreditLineInfo);
  const canTakeLoan = useAppSelector(selectCanTakeLoanEffective);
  const hasCollateral = creditLineInfo.collateralBreakdown.total >= LOAN_CONFIG.minCollateralForLoan;
  const canUseLoan = canTakeLoan && hasCollateral;

  // Short selling margin (only credit line, which is backed by stock holdings)
  const availableMarginForShort = creditLineInfo.availableCredit;
  const shortSellingEnabled = SHORT_SELLING_CONFIG.enabled;

  // Float and short position data for checking shortability
  const floats = useAppSelector(selectAllFloats);
  const shortPositions = useAppSelector(selectAllShortPositions);

  // Check if user can afford a stock: either with cash or with available credit
  const canAfford = (price: number): boolean => {
    if (cash >= price) return true;
    // If loan is possible, check if cash + available credit covers the price
    return canUseLoan && cash + creditLineInfo.availableCredit >= price;
  };

  // Check if user can short a stock (has enough margin and shares available to borrow)
  const canShort = (symbol: string, price: number): boolean => {
    if (!shortSellingEnabled) return false;

    // Check float availability
    const floatInfo = floats[symbol];
    if (!floatInfo || floatInfo.totalFloat === 0) return false;

    // Calculate current short interest for this symbol
    const totalShorts = shortPositions
      .filter(p => p.symbol === symbol)
      .reduce((sum, p) => sum + p.shares, 0);

    // Check if there are shares available to short
    const maxShortable = floatInfo.totalFloat * SHORT_SELLING_CONFIG.maxShortPercentOfFloat;
    const availableShares = Math.max(0, maxShortable - totalShorts);
    if (availableShares < 1) return false;

    // Check if user has enough margin for at least 1 share
    const marginRequired = price * SHORT_SELLING_CONFIG.initialMarginPercent;
    return availableMarginForShort >= marginRequired;
  };

  const hasPendingOrder = (symbol: string): boolean => symbolsWithPendingOrders.includes(symbol);
  const getHoldingShares = (symbol: string): number => {
    const holding = holdings.find(h => h.symbol === symbol);
    return holding?.shares ?? 0;
  };
  // Sort owned stocks alphabetically and enrich with stock data
  const ownedStocks = useMemo(() => {
    return holdings
      .map(holding => {
        const stock = stocks.find(s => s.symbol === holding.symbol);
        return stock ? { ...stock, holding } : null;
      })
      .filter((item): item is Stock & { holding: PortfolioItem } => item !== null)
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [stocks, holdings]);

  // Only allow card clicks when there are multiple holdings (switching between overview and detail makes sense)
  const hasMultipleHoldings = ownedStocks.length > 1;

  // If a stock is selected, show only this one
  if (selectedStock) {
    const selected = stocks.find(s => s.symbol === selectedStock);
    if (!selected) {
      return (
        <div className="multi-stock-chart__empty">
          <p>{t('chart.stockNotFound')}</p>
        </div>
      );
    }

    const holding = holdings.find(h => h.symbol === selectedStock);
    const profitLoss = holding ? (selected.currentPrice - holding.avgBuyPrice) * holding.shares : 0;

    return (
      <div className="multi-stock-chart__grid multi-stock-chart__grid--single">
        <div
          className={`multi-stock-chart__card multi-stock-chart__card--selected${hasMultipleHoldings ? '' : ' multi-stock-chart__card--no-click'}`}
          onClick={hasMultipleHoldings ? () => onSelectStock(selectedStock) : undefined}
        >
          <div className="multi-stock-chart__card-header">
            <div className="multi-stock-chart__card-info">
              <span className="multi-stock-chart__card-symbol">{selected.symbol}</span>
              <span className="multi-stock-chart__card-name">{selected.name}</span>
              <span
                className={`multi-stock-chart__card-sector multi-stock-chart__card-sector--${selected.sector}`}
                title={t(`stockList.sectors.${selected.sector}`)}
              >
                {t(`stockList.sectors.${selected.sector}Short`)}
              </span>
              <span className="multi-stock-chart__card-marketcap">
                {t('settings.marketCap', { value: selected.marketCapBillions.toLocaleString(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })}
              </span>
            </div>
            <div className={`multi-stock-chart__card-price ${selected.change >= 0 ? 'positive' : 'negative'}`}>
              {formatCurrency(selected.currentPrice, 2, locale)}
              <span className="multi-stock-chart__card-change">
                {formatCurrency(selected.change, 2, locale)} ({formatPercent(selected.changePercent / 100, 2, true, locale)})
              </span>
            </div>
            <div className="multi-stock-chart__card-actions-row">
              {holding && (
                <div className="multi-stock-chart__card-holding-info">
                  <span>{holding.shares} {t('chart.pieces')} @ {formatCurrency(holding.avgBuyPrice, 2, locale)}</span>
                  <span className={`multi-stock-chart__card-pnl ${profitLoss >= 0 ? 'multi-stock-chart__card-pnl--positive' : 'multi-stock-chart__card-pnl--negative'}`}>
                    {formatCurrency(profitLoss, 2, locale)}
                  </span>
                </div>
              )}
              <div className="multi-stock-chart__card-actions">
              <button
                className="multi-stock-chart__action-btn multi-stock-chart__action-btn--buy"
                onClick={(e) => {
                  e.stopPropagation();
                  onTrade(selected.symbol, 'buy');
                }}
                disabled={!canAfford(selected.currentPrice) || hasPendingOrder(selected.symbol)}
                title={hasPendingOrder(selected.symbol) ? t('chart.pendingOrder') : t('trading.buy')}
              >
                <PlusCircleIcon size={16} />
                <span>{t('trading.buy')}</span>
              </button>
              <button
                className="multi-stock-chart__action-btn multi-stock-chart__action-btn--sell"
                onClick={(e) => {
                  e.stopPropagation();
                  onTrade(selected.symbol, 'sell');
                }}
                disabled={getHoldingShares(selected.symbol) === 0 || hasPendingOrder(selected.symbol)}
                title={hasPendingOrder(selected.symbol) ? t('chart.pendingOrder') : t('trading.sell')}
              >
                <MinusCircleIcon size={16} />
                <span>{t('trading.sell')}</span>
              </button>
              {shortSellingEnabled && (
                <button
                  className="multi-stock-chart__action-btn multi-stock-chart__action-btn--short"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTrade(selected.symbol, 'shortSell');
                  }}
                  disabled={!canShort(selected.symbol, selected.currentPrice) || hasPendingOrder(selected.symbol)}
                  title={hasPendingOrder(selected.symbol) ? t('chart.pendingOrder') : t('shorts.shortSell')}
                >
                  <TrendingDownIcon size={16} />
                  <span>{t('shorts.shortSell')}</span>
                </button>
              )}
              </div>
            </div>
          </div>
          <div className="multi-stock-chart__card-body">
            <CandlestickChart data={selected.priceHistory} autoHeight theme={theme} locale={locale} />
          </div>
        </div>
      </div>
    );
  }

  // No selection: Show all owned stocks
  if (ownedStocks.length === 0) {
    return (
      <div className="multi-stock-chart__empty">
        <p>{t('chart.noStocksInPortfolio')}</p>
        <p className="multi-stock-chart__empty-hint">{t('chart.clickToShowChart')}</p>
      </div>
    );
  }

  // Chart height based on number of stocks (with only one stock: autoHeight)
  const useAutoHeight = ownedStocks.length === 1;
  const chartHeight = ownedStocks.length <= 4 ? 220 : 180;

  return (
    <div className={`multi-stock-chart__grid multi-stock-chart__grid--count-${Math.min(ownedStocks.length, 6)}`}>
      {ownedStocks.map(stock => {
        const profitLoss = (stock.currentPrice - stock.holding.avgBuyPrice) * stock.holding.shares;

        return (
          <div
            key={stock.symbol}
            className={`multi-stock-chart__card${hasMultipleHoldings ? '' : ' multi-stock-chart__card--no-click'}`}
            onClick={hasMultipleHoldings ? () => onSelectStock(stock.symbol) : undefined}
          >
            <div className="multi-stock-chart__card-header">
              <div className="multi-stock-chart__card-info">
                <span className="multi-stock-chart__card-symbol">{stock.symbol}</span>
                <span className="multi-stock-chart__card-name">{stock.name}</span>
                <span
                  className={`multi-stock-chart__card-sector multi-stock-chart__card-sector--${stock.sector}`}
                  title={t(`stockList.sectors.${stock.sector}`)}
                >
                  {t(`stockList.sectors.${stock.sector}Short`)}
                </span>
                <span className="multi-stock-chart__card-marketcap">
                  {t('settings.marketCap', { value: stock.marketCapBillions.toLocaleString(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })}
                </span>
              </div>
              <div className={`multi-stock-chart__card-price ${stock.change >= 0 ? 'positive' : 'negative'}`}>
                {formatCurrency(stock.currentPrice, 2, locale)}
                <span className={`multi-stock-chart__card-change-display ${stock.change >= 0 ? 'multi-stock-chart__card-change-display--positive' : 'multi-stock-chart__card-change-display--negative'}`}>
                  {formatPercent(stock.changePercent / 100, 1, true, locale)}
                </span>
              </div>
              <div className="multi-stock-chart__card-actions-row">
                <div className="multi-stock-chart__card-holding-info">
                  <span>{stock.holding.shares} {t('chart.pieces')} @ {formatCurrency(stock.holding.avgBuyPrice, 2, locale)}</span>
                  <span className={`multi-stock-chart__card-pnl ${profitLoss >= 0 ? 'multi-stock-chart__card-pnl--positive' : 'multi-stock-chart__card-pnl--negative'}`}>
                    {formatCurrency(profitLoss, 2, locale)}
                  </span>
                </div>
                <div className="multi-stock-chart__card-actions multi-stock-chart__card-actions--compact">
                  <button
                    className="multi-stock-chart__action-btn multi-stock-chart__action-btn--buy"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTrade(stock.symbol, 'buy');
                    }}
                    disabled={!canAfford(stock.currentPrice) || hasPendingOrder(stock.symbol)}
                    title={hasPendingOrder(stock.symbol) ? t('chart.pendingOrder') : t('trading.buy')}
                  >
                    <PlusCircleIcon size={14} />
                  </button>
                  <button
                    className="multi-stock-chart__action-btn multi-stock-chart__action-btn--sell"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTrade(stock.symbol, 'sell');
                    }}
                    disabled={getHoldingShares(stock.symbol) === 0 || hasPendingOrder(stock.symbol)}
                    title={hasPendingOrder(stock.symbol) ? t('chart.pendingOrder') : t('trading.sell')}
                  >
                    <MinusCircleIcon size={14} />
                  </button>
                  {shortSellingEnabled && (
                    <button
                      className="multi-stock-chart__action-btn multi-stock-chart__action-btn--short"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTrade(stock.symbol, 'shortSell');
                      }}
                      disabled={!canShort(stock.symbol, stock.currentPrice) || hasPendingOrder(stock.symbol)}
                      title={hasPendingOrder(stock.symbol) ? t('chart.pendingOrder') : t('shorts.shortSell')}
                    >
                      <TrendingDownIcon size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="multi-stock-chart__card-body">
              <CandlestickChart
                data={stock.priceHistory}
                height={chartHeight}
                compact={ownedStocks.length > 1}
                autoHeight={useAutoHeight}
                theme={theme}
                locale={locale}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
export default MultiStockChart

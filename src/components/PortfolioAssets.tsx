import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { PortfolioItem, Stock } from '../types';
import { formatCurrency, formatNumber as formatNumberUtil, formatPercent, getFormatLocale } from '../utils/formatting';

interface PortfolioAssetsProps {
  holdings: PortfolioItem[];
  stocks: Stock[];
  selectedStock: string;
  onSelectStock: (symbol: string) => void;
}

/**
 * Displays the portfolio holdings/assets table
 */
export const PortfolioAssets = ({
  holdings,
  stocks,
  selectedStock,
  onSelectStock,
}: PortfolioAssetsProps) => {
  const { i18n, t } = useTranslation();
  const locale = getFormatLocale(i18n.language);

  const formatNumber = (num: number, decimals: number = 0): string => {
    return formatNumberUtil(num, decimals, locale);
  };

  // Sort holdings alphabetically
  const sortedHoldings = useMemo(
    () => [...holdings].sort((a, b) => a.symbol.localeCompare(b.symbol)),
    [holdings]
  );

  const getStockPrice = (symbol: string): number => {
    const stock = stocks.find((s) => s.symbol === symbol);
    return stock?.currentPrice ?? 0;
  };

  const getStockName = (symbol: string): string => {
    const stock = stocks.find((s) => s.symbol === symbol);
    return stock?.name ?? symbol;
  };

  const calculateProfitLoss = (
    symbol: string,
    shares: number,
    avgBuyPrice: number
  ): number => {
    const currentValue = shares * getStockPrice(symbol);
    const costBasis = shares * avgBuyPrice;
    return currentValue - costBasis;
  };

  return (
    <div className="portfolio-assets">
      <h3 className="portfolio-assets__title">{t('portfolio.assets')}</h3>
      {holdings.length > 0 ? (
        <div className="portfolio-assets__table">
          <div className="portfolio-assets__header">
            <span>{t('portfolio.symbol')}</span>
            <span>{t('portfolio.qty')}</span>
            <span>{t('portfolio.buyPrice')}</span>
            <span>{t('portfolio.current')}</span>
            <span>{t('portfolio.pl')}</span>
          </div>
          {sortedHoldings.map((holding) => {
            const currentPrice = getStockPrice(holding.symbol);
            const profitLoss = calculateProfitLoss(
              holding.symbol,
              holding.shares,
              holding.avgBuyPrice
            );
            const profitLossPercent =
              ((currentPrice - holding.avgBuyPrice) / holding.avgBuyPrice) * 100;

            return (
              <div
                key={holding.symbol}
                className={`portfolio-assets__row ${
                  selectedStock === holding.symbol
                    ? 'portfolio-assets__row--selected'
                    : ''
                }`}
                onClick={() => onSelectStock(holding.symbol)}
              >
                <span
                  className="portfolio-assets__symbol"
                  title={getStockName(holding.symbol)}
                >
                  {holding.symbol}
                </span>
                <span>{formatNumber(holding.shares, 0)}</span>
                <span>{formatCurrency(holding.avgBuyPrice, 0, locale)}</span>
                <span>{formatCurrency(currentPrice, 0, locale)}</span>
                <span
                  className={`portfolio-assets__pl ${
                    profitLoss >= 0
                      ? 'portfolio-assets__pl--positive'
                      : 'portfolio-assets__pl--negative'
                  }`}
                >
                  {formatPercent(profitLossPercent / 100, 1, true, locale)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="portfolio-assets__empty">{t('portfolio.noHoldings')}</p>
      )}
    </div>
  );
};

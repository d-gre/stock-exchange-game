import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Stock } from '../types';

/** Market Maker inventory level data */
export interface MarketMakerLevel {
  level: number;          // Inventory level as ratio (1.0 = 100%)
  spreadMultiplier: number;
}

interface MarketMakerInventoryProps {
  stocks: Stock[];
  marketMakerLevels: Record<string, MarketMakerLevel>;
  defaultExpanded?: boolean;
}

/**
 * Returns the CSS modifier class based on inventory level.
 * - Low (< 50%): critical (red)
 * - Medium (50-80%): warning (yellow)
 * - Normal (80-120%): normal (green)
 * - High (> 120%): excess (blue)
 */
const getInventoryLevelModifier = (level: number): string => {
  if (level < 0.5) return 'market-maker-inventory__bar--critical';
  if (level < 0.8) return 'market-maker-inventory__bar--warning';
  if (level > 1.2) return 'market-maker-inventory__bar--excess';
  return 'market-maker-inventory__bar--normal';
};

export const MarketMakerInventory = ({
  stocks,
  marketMakerLevels,
  defaultExpanded = true,
}: MarketMakerInventoryProps) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (!marketMakerLevels || Object.keys(marketMakerLevels).length === 0) {
    return null;
  }

  return (
    <div className={`market-maker-inventory ${isExpanded ? 'market-maker-inventory--expanded' : ''}`}>
      <div
        className="market-maker-inventory__header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="market-maker-inventory__title">{t('marketMaker.title')}</span>
        <span className="market-maker-inventory__toggle">▼</span>
      </div>
      <div className="market-maker-inventory__content-wrapper">
        <div className="market-maker-inventory__content">
          <div className="market-maker-inventory__grid">
            {stocks.map(stock => {
              const mmLevel = marketMakerLevels[stock.symbol];
              if (!mmLevel) return null;

              const levelPercent = Math.round(mmLevel.level * 100);
              const spreadPercent = ((mmLevel.spreadMultiplier - 1) * 100).toFixed(1);
              const barWidth = Math.min(100, Math.max(0, levelPercent));
              const levelModifier = getInventoryLevelModifier(mmLevel.level);
              const barTooltip = t('marketMaker.barTooltip', { percent: levelPercent });
              const spreadTooltip = t('marketMaker.spreadTooltip', { percent: spreadPercent });

              return (
                <div key={stock.symbol} className="market-maker-inventory__item">
                  <div className="market-maker-inventory__symbol">{stock.symbol}</div>
                  <div className="market-maker-inventory__bar-container" title={barTooltip}>
                    <div
                      className={`market-maker-inventory__bar ${levelModifier}`}
                      style={{ width: `${barWidth}%` }}
                    />
                    <span className="market-maker-inventory__level">{levelPercent}%</span>
                  </div>
                  <div
                    className={`market-maker-inventory__spread ${mmLevel.spreadMultiplier > 1.5 ? 'market-maker-inventory__spread--high' : ''}`}
                    title={spreadTooltip}
                  >
                    {mmLevel.spreadMultiplier > 1 ? '+' : ''}{spreadPercent}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

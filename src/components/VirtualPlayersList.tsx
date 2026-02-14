import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { VirtualPlayer, Stock, VirtualPlayerTransaction } from '../types';

interface VirtualPlayersListProps {
  players: VirtualPlayer[];
  stocks: Stock[];
  totalTradeCount: number;
}

type RiskKey = 'averse' | 'neutral' | 'seeking';
type VolatilityKey = 'low' | 'medium' | 'high';
type TrendKey = 'strongUp' | 'up' | 'down' | 'strongDown';

/**
 * Returns the key for risk tolerance translation.
 */
const getRiskKey = (riskTolerance: number): { key: RiskKey; badgeModifier: string; detailModifier: string } => {
  if (riskTolerance <= -34) {
    return { key: 'averse', badgeModifier: 'virtual-players-list__risk-badge--averse', detailModifier: 'virtual-players-list__tx-detail-value--risk-averse' };
  } else if (riskTolerance >= 34) {
    return { key: 'seeking', badgeModifier: 'virtual-players-list__risk-badge--seeking', detailModifier: 'virtual-players-list__tx-detail-value--risk-seeking' };
  }
  return { key: 'neutral', badgeModifier: 'virtual-players-list__risk-badge--neutral', detailModifier: 'virtual-players-list__tx-detail-value--risk-neutral' };
};

/**
 * Returns the key for volatility translation.
 */
const getVolatilityKey = (volatility: number): { key: VolatilityKey; modifier: string } => {
  const percent = volatility * 100;
  if (percent < 2) return { key: 'low', modifier: 'virtual-players-list__tx-detail-value--volatility-low' };
  if (percent < 5) return { key: 'medium', modifier: 'virtual-players-list__tx-detail-value--volatility-medium' };
  return { key: 'high', modifier: 'virtual-players-list__tx-detail-value--volatility-high' };
};

/**
 * Returns the key for trend translation.
 */
const getTrendKey = (trend: number): { key: TrendKey; modifier: string; percent: string } => {
  const percent = trend * 100;
  const percentStr = `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`;
  if (percent > 3) return { key: 'strongUp', modifier: 'virtual-players-list__tx-detail-value--trend-up', percent: percentStr };
  if (percent > 0) return { key: 'up', modifier: 'virtual-players-list__tx-detail-value--trend-up', percent: percentStr };
  if (percent > -3) return { key: 'down', modifier: 'virtual-players-list__tx-detail-value--trend-down', percent: percentStr };
  return { key: 'strongDown', modifier: 'virtual-players-list__tx-detail-value--trend-down', percent: percentStr };
};

/**
 * Format a number as currency.
 */
const formatCurrency = (value: number, locale: string): string => {
  return value.toLocaleString(locale === 'de' ? 'de-DE' : 'en-US', { style: 'currency', currency: 'EUR' });
};

/**
 * Format a timestamp as time string.
 */
const formatTime = (timestamp: number, locale: string): string => {
  return new Date(timestamp).toLocaleTimeString(locale === 'de' ? 'de-DE' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const VirtualPlayersList = ({
  players,
  stocks,
  totalTradeCount,
}: VirtualPlayersListProps) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  // Stores which player cards are expanded
  const [expandedPlayerIds, setExpandedPlayerIds] = useState<Set<string>>(new Set());
  // Stores which transactions are expanded (shows details)
  const [expandedTxIds, setExpandedTxIds] = useState<Set<string>>(new Set());
  // Stores IDs of players who recently traded (for flash animation)
  const [recentlyTradedPlayerIds, setRecentlyTradedPlayerIds] = useState<Set<string>>(new Set());
  const prevTradeCount = useRef(totalTradeCount);
  const lastCycleTimestamp = useRef(Date.now());

  useEffect(() => {
    if (totalTradeCount > prevTradeCount.current) {
      // Find players who have traded since the last cycle
      const tradedIds = new Set<string>();
      players.forEach(player => {
        const hasRecentTx = player.transactions.some(
          tx => tx.timestamp > lastCycleTimestamp.current
        );
        if (hasRecentTx) {
          tradedIds.add(player.id);
        }
      });

      setRecentlyTradedPlayerIds(tradedIds);
      const timer = setTimeout(() => setRecentlyTradedPlayerIds(new Set()), 800);

      lastCycleTimestamp.current = Date.now();
      prevTradeCount.current = totalTradeCount;
      return () => clearTimeout(timer);
    }
    prevTradeCount.current = totalTradeCount;
  }, [totalTradeCount, players]);

  const calculatePortfolioValue = (player: VirtualPlayer): number => {
    const holdingsValue = player.portfolio.holdings.reduce((sum, holding) => {
      const stock = stocks.find(s => s.symbol === holding.symbol);
      return sum + (stock ? stock.currentPrice * holding.shares : 0);
    }, 0);
    return player.portfolio.cash + holdingsValue;
  };

  /** Calculate total debt for a virtual player */
  const calculateTotalDebt = (player: VirtualPlayer): number => {
    return player.loans.reduce((sum, loan) => sum + loan.balance, 0);
  };

  const togglePlayerExpanded = (playerId: string) => {
    setExpandedPlayerIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
      }
      return newSet;
    });
  };

  const toggleTxExpanded = (txId: string) => {
    setExpandedTxIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(txId)) {
        newSet.delete(txId);
      } else {
        newSet.add(txId);
      }
      return newSet;
    });
  };

  /**
   * Renders the detail view for a transaction
   */
  const renderTransactionDetails = (tx: VirtualPlayerTransaction) => {
    if (!tx.decisionFactors) {
      return (
        <div className="virtual-players-list__tx-details">
          <div className="virtual-players-list__tx-detail-row">
            <span className="virtual-players-list__tx-detail-label">{t('virtualPlayers.noDecisionData')}</span>
          </div>
        </div>
      );
    }

    const factors = tx.decisionFactors;
    const riskInfo = getRiskKey(factors.riskTolerance);
    const trendInfo = getTrendKey(factors.trend);

    if (factors.kind === 'buy') {
      const volInfo = getVolatilityKey(factors.volatility);
      return (
        <div className="virtual-players-list__tx-details">
          <div className="virtual-players-list__tx-details-header">{t('virtualPlayers.decisionFactors')}</div>
          <div className="virtual-players-list__tx-detail-row">
            <span className="virtual-players-list__tx-detail-label">{t('virtualPlayers.volatility')}:</span>
            <span className={`virtual-players-list__tx-detail-value ${volInfo.modifier}`}>
              {t(`virtualPlayers.volatilityLevel.${volInfo.key}`)} ({(factors.volatility * 100).toFixed(1)}%)
            </span>
          </div>
          <div className="virtual-players-list__tx-detail-row">
            <span className="virtual-players-list__tx-detail-label">{t('virtualPlayers.trend')}:</span>
            <span className={`virtual-players-list__tx-detail-value ${trendInfo.modifier}`}>
              {t(`virtualPlayers.trendLevel.${trendInfo.key}`)} ({trendInfo.percent})
            </span>
          </div>
          <div className="virtual-players-list__tx-detail-row">
            <span className="virtual-players-list__tx-detail-label">{t('virtualPlayers.score')}:</span>
            <span className="virtual-players-list__tx-detail-value">{factors.score.toFixed(0)}/100</span>
          </div>
          <div className="virtual-players-list__tx-detail-row">
            <span className="virtual-players-list__tx-detail-label">{t('virtualPlayers.playerType')}:</span>
            <span className={`virtual-players-list__tx-detail-value ${riskInfo.detailModifier}`}>
              {t(`virtualPlayers.risk.${riskInfo.key}`)} ({factors.riskTolerance})
            </span>
          </div>
          <div className="virtual-players-list__tx-reasoning">
            {factors.riskTolerance <= -34 && (
              <span>→ {t('virtualPlayers.reasoning.prefersStable')}</span>
            )}
            {factors.riskTolerance >= 34 && (
              <span>→ {t('virtualPlayers.reasoning.seeksVolatile')}</span>
            )}
            {factors.riskTolerance > -34 && factors.riskTolerance < 34 && (
              <span>→ {t('virtualPlayers.reasoning.balanced')}</span>
            )}
          </div>
        </div>
      );
    } else {
      // Sell decision
      const profitModifier = factors.profitPercent >= 0 ? 'virtual-players-list__tx-detail-value--profit' : 'virtual-players-list__tx-detail-value--loss';
      return (
        <div className="virtual-players-list__tx-details">
          <div className="virtual-players-list__tx-details-header">{t('virtualPlayers.decisionFactors')}</div>
          <div className="virtual-players-list__tx-detail-row">
            <span className="virtual-players-list__tx-detail-label">{t('virtualPlayers.buyPrice')}:</span>
            <span className="virtual-players-list__tx-detail-value">{formatCurrency(factors.avgBuyPrice, locale)}</span>
          </div>
          <div className="virtual-players-list__tx-detail-row">
            <span className="virtual-players-list__tx-detail-label">{t('portfolio.profitLoss')}:</span>
            <span className={`virtual-players-list__tx-detail-value ${profitModifier}`}>
              {factors.profitPercent >= 0 ? '+' : ''}{(factors.profitPercent * 100).toFixed(1)}%
            </span>
          </div>
          <div className="virtual-players-list__tx-detail-row">
            <span className="virtual-players-list__tx-detail-label">{t('virtualPlayers.trend')}:</span>
            <span className={`virtual-players-list__tx-detail-value ${trendInfo.modifier}`}>
              {t(`virtualPlayers.trendLevel.${trendInfo.key}`)} ({trendInfo.percent})
            </span>
          </div>
          <div className="virtual-players-list__tx-detail-row">
            <span className="virtual-players-list__tx-detail-label">{t('virtualPlayers.sellScore')}:</span>
            <span className="virtual-players-list__tx-detail-value">{factors.score.toFixed(0)} {t('virtualPlayers.sellThreshold')}</span>
          </div>
          <div className="virtual-players-list__tx-detail-row">
            <span className="virtual-players-list__tx-detail-label">{t('virtualPlayers.playerType')}:</span>
            <span className={`virtual-players-list__tx-detail-value ${riskInfo.detailModifier}`}>
              {t(`virtualPlayers.risk.${riskInfo.key}`)} ({factors.riskTolerance})
            </span>
          </div>
          <div className="virtual-players-list__tx-reasoning">
            {factors.profitPercent < 0 && factors.riskTolerance <= -34 && (
              <span>→ {t('virtualPlayers.reasoning.stopLoss')}</span>
            )}
            {factors.profitPercent < 0 && factors.riskTolerance >= 34 && (
              <span>→ {t('virtualPlayers.reasoning.holdsLosses')}</span>
            )}
            {factors.profitPercent >= 0 && factors.riskTolerance >= 34 && (
              <span>→ {t('virtualPlayers.reasoning.takesProfit')}</span>
            )}
            {factors.profitPercent >= 0 && factors.riskTolerance <= -34 && (
              <span>→ {t('virtualPlayers.reasoning.securesProfit')}</span>
            )}
            {factors.riskTolerance > -34 && factors.riskTolerance < 34 && (
              <span>→ {t('virtualPlayers.reasoning.balancedSell')}</span>
            )}
          </div>
        </div>
      );
    }
  };

  return (
    <div className="virtual-players-list">
      {players.map(player => {
        const totalValue = calculatePortfolioValue(player);
        const isPlayerExpanded = expandedPlayerIds.has(player.id);
        const riskInfo = getRiskKey(player.settings.riskTolerance);
        const hasRecentTrade = recentlyTradedPlayerIds.has(player.id);

        const totalDebt = calculateTotalDebt(player);

        return (
          <div
            key={player.id}
            className={`virtual-players-list__player ${isPlayerExpanded ? 'virtual-players-list__player--expanded' : ''} ${hasRecentTrade ? 'virtual-players-list__player--flash' : ''}`}
          >
            {/* Clickable header area */}
            <div
              className="virtual-players-list__player-header"
              onClick={() => togglePlayerExpanded(player.id)}
            >
              <div className="virtual-players-list__player-title">
                <span className="virtual-players-list__player-name">{player.name}</span>
                <span className={`virtual-players-list__risk-badge ${riskInfo.badgeModifier}`}>
                  {t(`virtualPlayers.risk.${riskInfo.key}`)} ({player.settings.riskTolerance})
                </span>
              </div>
              <div className="virtual-players-list__player-summary">
                <div className="virtual-players-list__player-values">
                  <span className="virtual-players-list__player-value">{formatCurrency(totalValue, locale)}</span>
                  <span className="virtual-players-list__cash">{t('virtualPlayers.cash')}: {formatCurrency(player.portfolio.cash, locale)}</span>
                  {totalDebt > 0 && (
                    <span className="virtual-players-list__debt">{t('virtualPlayers.debt')}: {formatCurrency(totalDebt, locale)}</span>
                  )}
                </div>
                <span className="virtual-players-list__expand-icon">{isPlayerExpanded ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Always visible short info (Holdings) */}
            {player.portfolio.holdings.length > 0 && (
              <div className="virtual-players-list__player-details">
                <div className="virtual-players-list__holdings">
                  {player.portfolio.holdings.map(h => (
                    <span key={h.symbol} className="virtual-players-list__holding">
                      {h.symbol}: {h.shares}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Expandable transactions section */}
            {isPlayerExpanded && (
              <div className="virtual-players-list__transactions">
                <div className="virtual-players-list__tx-header">{t('virtualPlayers.transactions')}</div>
                {player.transactions.length === 0 ? (
                  <div className="virtual-players-list__no-transactions">{t('virtualPlayers.noTransactions')}</div>
                ) : (
                  <div className="virtual-players-list__tx-list">
                    {player.transactions.map(tx => {
                      const isTxExpanded = expandedTxIds.has(tx.id);
                      return (
                        <div key={tx.id} className={`virtual-players-list__tx-wrapper ${isTxExpanded ? 'virtual-players-list__tx-wrapper--expanded' : ''}`}>
                          <div
                            className={`virtual-players-list__tx virtual-players-list__tx--${tx.type} ${tx.decisionFactors ? 'virtual-players-list__tx--clickable' : ''}`}
                            onClick={() => tx.decisionFactors && toggleTxExpanded(tx.id)}
                            title={tx.decisionFactors ? t('virtualPlayers.clickDetails') : undefined}
                          >
                            <span className={`virtual-players-list__tx-type virtual-players-list__tx-type--${tx.type}`}>
                              {t(`virtualPlayers.txType.${tx.type}`)}
                            </span>
                            <span className="virtual-players-list__tx-symbol">{tx.symbol}</span>
                            <span className="virtual-players-list__tx-shares">{tx.shares}x</span>
                            <span className="virtual-players-list__tx-price">{formatCurrency(tx.price, locale)}</span>
                            <span className="virtual-players-list__tx-time">{formatTime(tx.timestamp, locale)}</span>
                            {tx.decisionFactors && (
                              <span className="virtual-players-list__tx-expand-icon">{isTxExpanded ? '▲' : '▼'}</span>
                            )}
                          </div>
                          {isTxExpanded && renderTransactionDetails(tx)}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

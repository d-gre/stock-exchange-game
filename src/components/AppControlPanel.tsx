import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { VirtualPlayer, Stock, VirtualPlayerTransaction } from '../types';
import type { SpeedMultiplier } from '../store/settingsSlice';

interface AppControlPanelProps {
  players: VirtualPlayer[];
  stocks: Stock[];
  totalTradeCount: number;
  // Mobile controls
  isPaused?: boolean;
  isEffectivelyPaused?: boolean; // True when paused for any reason (manually, trade panel open, etc.)
  countdown?: number;
  updateInterval?: number;
  onTogglePause?: () => void;
  onOpenSettings?: () => void;
  onOpenHelp?: () => void;
  // Speed controls
  speedMultiplier?: SpeedMultiplier;
  onSetSpeed?: (speed: SpeedMultiplier) => void;
}

type RiskKey = 'averse' | 'neutral' | 'seeking';
type VolatilityKey = 'low' | 'medium' | 'high';
type TrendKey = 'strongUp' | 'up' | 'down' | 'strongDown';

/**
 * Returns the key for risk tolerance translation.
 */
const getRiskKey = (riskTolerance: number): { key: RiskKey; badgeModifier: string; detailModifier: string } => {
  if (riskTolerance <= -34) {
    return { key: 'averse', badgeModifier: 'app-control-panel__risk-badge--averse', detailModifier: 'app-control-panel__tx-detail-value--risk-averse' };
  } else if (riskTolerance >= 34) {
    return { key: 'seeking', badgeModifier: 'app-control-panel__risk-badge--seeking', detailModifier: 'app-control-panel__tx-detail-value--risk-seeking' };
  }
  return { key: 'neutral', badgeModifier: 'app-control-panel__risk-badge--neutral', detailModifier: 'app-control-panel__tx-detail-value--risk-neutral' };
};

/**
 * Returns the key for volatility translation.
 */
const getVolatilityKey = (volatility: number): { key: VolatilityKey; modifier: string } => {
  const percent = volatility * 100;
  if (percent < 2) return { key: 'low', modifier: 'app-control-panel__tx-detail-value--volatility-low' };
  if (percent < 5) return { key: 'medium', modifier: 'app-control-panel__tx-detail-value--volatility-medium' };
  return { key: 'high', modifier: 'app-control-panel__tx-detail-value--volatility-high' };
};

/**
 * Returns the key for trend translation.
 */
const getTrendKey = (trend: number): { key: TrendKey; modifier: string; percent: string } => {
  const percent = trend * 100;
  const percentStr = `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`;
  if (percent > 3) return { key: 'strongUp', modifier: 'app-control-panel__tx-detail-value--trend-up', percent: percentStr };
  if (percent > 0) return { key: 'up', modifier: 'app-control-panel__tx-detail-value--trend-up', percent: percentStr };
  if (percent > -3) return { key: 'down', modifier: 'app-control-panel__tx-detail-value--trend-down', percent: percentStr };
  return { key: 'strongDown', modifier: 'app-control-panel__tx-detail-value--trend-down', percent: percentStr };
};

export const AppControlPanel = ({
  players,
  stocks,
  totalTradeCount,
  isPaused,
  isEffectivelyPaused,
  countdown,
  updateInterval,
  onTogglePause,
  onOpenSettings,
  onOpenHelp,
  speedMultiplier = 1,
  onSetSpeed,
}: AppControlPanelProps) => {
  const { t, i18n } = useTranslation();
  // For visual display: effectively paused (manually or by trade panel etc.)
  const showAsPaused = isEffectivelyPaused ?? isPaused;
  const [isExpanded, setIsExpanded] = useState(false);
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

  const formatCurrency = (value: number): string => {
    return value.toLocaleString(i18n.language === 'de' ? 'de-DE' : 'en-US', { style: 'currency', currency: 'EUR' });
  };

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString(i18n.language === 'de' ? 'de-DE' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
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
        <div className="app-control-panel__tx-details">
          <div className="app-control-panel__tx-detail-row">
            <span className="app-control-panel__tx-detail-label">{t('virtualPlayers.noDecisionData')}</span>
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
        <div className="app-control-panel__tx-details">
          <div className="app-control-panel__tx-details-header">{t('virtualPlayers.decisionFactors')}</div>
          <div className="app-control-panel__tx-detail-row">
            <span className="app-control-panel__tx-detail-label">{t('virtualPlayers.volatility')}:</span>
            <span className={`app-control-panel__tx-detail-value ${volInfo.modifier}`}>
              {t(`virtualPlayers.volatilityLevel.${volInfo.key}`)} ({(factors.volatility * 100).toFixed(1)}%)
            </span>
          </div>
          <div className="app-control-panel__tx-detail-row">
            <span className="app-control-panel__tx-detail-label">{t('virtualPlayers.trend')}:</span>
            <span className={`app-control-panel__tx-detail-value ${trendInfo.modifier}`}>
              {t(`virtualPlayers.trendLevel.${trendInfo.key}`)} ({trendInfo.percent})
            </span>
          </div>
          <div className="app-control-panel__tx-detail-row">
            <span className="app-control-panel__tx-detail-label">{t('virtualPlayers.score')}:</span>
            <span className="app-control-panel__tx-detail-value">{factors.score.toFixed(0)}/100</span>
          </div>
          <div className="app-control-panel__tx-detail-row">
            <span className="app-control-panel__tx-detail-label">{t('virtualPlayers.playerType')}:</span>
            <span className={`app-control-panel__tx-detail-value ${riskInfo.detailModifier}`}>
              {t(`virtualPlayers.risk.${riskInfo.key}`)} ({factors.riskTolerance})
            </span>
          </div>
          <div className="app-control-panel__tx-reasoning">
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
      const profitModifier = factors.profitPercent >= 0 ? 'app-control-panel__tx-detail-value--profit' : 'app-control-panel__tx-detail-value--loss';
      return (
        <div className="app-control-panel__tx-details">
          <div className="app-control-panel__tx-details-header">{t('virtualPlayers.decisionFactors')}</div>
          <div className="app-control-panel__tx-detail-row">
            <span className="app-control-panel__tx-detail-label">{t('virtualPlayers.buyPrice')}:</span>
            <span className="app-control-panel__tx-detail-value">{formatCurrency(factors.avgBuyPrice)}</span>
          </div>
          <div className="app-control-panel__tx-detail-row">
            <span className="app-control-panel__tx-detail-label">{t('portfolio.profitLoss')}:</span>
            <span className={`app-control-panel__tx-detail-value ${profitModifier}`}>
              {factors.profitPercent >= 0 ? '+' : ''}{(factors.profitPercent * 100).toFixed(1)}%
            </span>
          </div>
          <div className="app-control-panel__tx-detail-row">
            <span className="app-control-panel__tx-detail-label">{t('virtualPlayers.trend')}:</span>
            <span className={`app-control-panel__tx-detail-value ${trendInfo.modifier}`}>
              {t(`virtualPlayers.trendLevel.${trendInfo.key}`)} ({trendInfo.percent})
            </span>
          </div>
          <div className="app-control-panel__tx-detail-row">
            <span className="app-control-panel__tx-detail-label">{t('virtualPlayers.sellScore')}:</span>
            <span className="app-control-panel__tx-detail-value">{factors.score.toFixed(0)} {t('virtualPlayers.sellThreshold')}</span>
          </div>
          <div className="app-control-panel__tx-detail-row">
            <span className="app-control-panel__tx-detail-label">{t('virtualPlayers.playerType')}:</span>
            <span className={`app-control-panel__tx-detail-value ${riskInfo.detailModifier}`}>
              {t(`virtualPlayers.risk.${riskInfo.key}`)} ({factors.riskTolerance})
            </span>
          </div>
          <div className="app-control-panel__tx-reasoning">
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

  // Timer progress: countdown goes from updateInterval to 0
  // We divide by (updateInterval - 1) so that when countdown = updateInterval AND updateInterval - 1
  // the bar is at 100% (buffer for the first second after reset)
  const timerProgress = updateInterval && updateInterval > 1
    ? Math.min(100, ((countdown ?? 0) / (updateInterval - 1)) * 100)
    : (countdown ?? 0) > 0 ? 100 : 0;

  return (
    <div className={`app-control-panel ${isExpanded ? 'app-control-panel--expanded' : ''}`}>
      <div className="app-control-panel__bar">
        <div className="app-control-panel__left">
          {players.length > 0 && (
            <button
              className={`app-control-panel__badge app-control-panel__badge--clickable ${isExpanded ? 'app-control-panel__badge--expanded' : ''}`}
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? t('game.hidePlayers') : t('game.showPlayers')}
            >
              {totalTradeCount > 0 ? t('game.trades', { count: totalTradeCount }) : t('game.players', { count: players.length })}
              <span className="app-control-panel__badge-icon">{isExpanded ? '▲' : '▼'}</span>
            </button>
          )}
        </div>

        <div className="app-control-panel__center">
          <div className={`app-control-panel__timer ${showAsPaused ? 'app-control-panel__timer--paused' : ''}`}>
            <span className="app-control-panel__timer-label">{t('game.nextCycle')}</span>
            <div className="app-control-panel__timer-bar">
              <div className="app-control-panel__timer-fill" style={{ width: `${timerProgress}%` }} />
            </div>
            <span className="app-control-panel__timer-text">{countdown}s</span>
          </div>

          {onSetSpeed && (
            <button
              className={`app-control-panel__btn app-control-panel__btn--speed app-control-panel__btn--speed-${speedMultiplier}x`}
              onClick={() => {
                if (isPaused && onTogglePause) {
                  // If paused: Resume
                  onTogglePause();
                } else {
                  // If running: Increase speed cyclically (1->2->3->1)
                  const nextSpeed = speedMultiplier === 3 ? 1 : ((speedMultiplier + 1) as 1 | 2 | 3);
                  onSetSpeed(nextSpeed);
                }
              }}
              title={isPaused ? t('game.resume') : t('game.speed', { speed: speedMultiplier, next: speedMultiplier === 3 ? 1 : speedMultiplier + 1 })}
            >
              {/* 1x = one arrow, 2x = two arrows, 3x = three arrows */}
              {speedMultiplier === 1 && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
              {speedMultiplier === 2 && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/>
                </svg>
              )}
              {speedMultiplier === 3 && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.5 18l6-6-6-6v12zm7 0l6-6-6-6v12zm7 0l6-6-6-6v12z"/>
                </svg>
              )}
            </button>
          )}

          {onTogglePause && (
            <button
              className={`app-control-panel__btn app-control-panel__btn--pause ${showAsPaused ? 'app-control-panel__btn--paused' : ''}`}
              onClick={onTogglePause}
              disabled={showAsPaused && !isPaused}
              title={isPaused ? t('game.resume') : t('game.pause')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            </button>
          )}
        </div>

        <div className="app-control-panel__right">
          {onOpenHelp && (
            <button
              className="app-control-panel__btn app-control-panel__btn--help"
              onClick={onOpenHelp}
              title={t('help.linkText')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </button>
          )}
          {onOpenSettings && (
            <button
              className="app-control-panel__btn app-control-panel__btn--settings"
              onClick={onOpenSettings}
              title={t('settings.settings')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="app-control-panel__players">
          <div className="app-control-panel__players-list">
            {players.map(player => {
              const totalValue = calculatePortfolioValue(player);
              const isPlayerExpanded = expandedPlayerIds.has(player.id);
              const riskInfo = getRiskKey(player.settings.riskTolerance);

              const hasRecentTrade = recentlyTradedPlayerIds.has(player.id);

              return (
                <div
                  key={player.id}
                  className={`app-control-panel__player ${isPlayerExpanded ? 'app-control-panel__player--expanded' : ''} ${hasRecentTrade ? 'app-control-panel__player--flash' : ''}`}
                >
                  {/* Clickable header area */}
                  <div
                    className="app-control-panel__player-header"
                    onClick={() => togglePlayerExpanded(player.id)}
                  >
                    <div className="app-control-panel__player-title">
                      <span className="app-control-panel__player-name">{player.name}</span>
                      <span className={`app-control-panel__risk-badge ${riskInfo.badgeModifier}`}>
                        {t(`virtualPlayers.risk.${riskInfo.key}`)} ({player.settings.riskTolerance})
                      </span>
                    </div>
                    <div className="app-control-panel__player-summary">
                      <div className="app-control-panel__player-values">
                        <span className="app-control-panel__player-value">{formatCurrency(totalValue)}</span>
                        <span className="app-control-panel__cash">{t('virtualPlayers.cash')}: {formatCurrency(player.portfolio.cash)}</span>
                      </div>
                      <span className="app-control-panel__expand-icon">{isPlayerExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Always visible short info (Holdings) */}
                  {player.portfolio.holdings.length > 0 && (
                    <div className="app-control-panel__player-details">
                      <div className="app-control-panel__holdings">
                        {player.portfolio.holdings.map(h => (
                          <span key={h.symbol} className="app-control-panel__holding">
                            {h.symbol}: {h.shares}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Expandable transactions section */}
                  {isPlayerExpanded && (
                    <div className="app-control-panel__transactions">
                      <div className="app-control-panel__tx-header">{t('virtualPlayers.transactions')}</div>
                      {player.transactions.length === 0 ? (
                        <div className="app-control-panel__no-transactions">{t('virtualPlayers.noTransactions')}</div>
                      ) : (
                        <div className="app-control-panel__tx-list">
                          {player.transactions.map(tx => {
                            const isTxExpanded = expandedTxIds.has(tx.id);
                            return (
                              <div key={tx.id} className={`app-control-panel__tx-wrapper ${isTxExpanded ? 'app-control-panel__tx-wrapper--expanded' : ''}`}>
                                <div
                                  className={`app-control-panel__tx app-control-panel__tx--${tx.type} ${tx.decisionFactors ? 'app-control-panel__tx--clickable' : ''}`}
                                  onClick={() => tx.decisionFactors && toggleTxExpanded(tx.id)}
                                  title={tx.decisionFactors ? t('virtualPlayers.clickDetails') : undefined}
                                >
                                  <span className={`app-control-panel__tx-type app-control-panel__tx-type--${tx.type}`}>
                                    {t(`virtualPlayers.txType.${tx.type}`)}
                                  </span>
                                  <span className="app-control-panel__tx-symbol">{tx.symbol}</span>
                                  <span className="app-control-panel__tx-shares">{tx.shares}x</span>
                                  <span className="app-control-panel__tx-price">{formatCurrency(tx.price)}</span>
                                  <span className="app-control-panel__tx-time">{formatTime(tx.timestamp)}</span>
                                  {tx.decisionFactors && (
                                    <span className="app-control-panel__tx-expand-icon">{isTxExpanded ? '▲' : '▼'}</span>
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
        </div>
      )}
    </div>
  );
};

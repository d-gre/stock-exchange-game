import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { VirtualPlayer, Stock } from '../types';
import { VirtualPlayersList } from './VirtualPlayersList';

interface VirtualPlayersPanelProps {
  players: VirtualPlayer[];
  stocks: Stock[];
  totalTradeCount: number;
  defaultExpanded?: boolean;
}

export const VirtualPlayersPanel = ({
  players,
  stocks,
  totalTradeCount,
  defaultExpanded = true,
}: VirtualPlayersPanelProps) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (players.length === 0) {
    return null;
  }

  return (
    <div className={`virtual-players-panel ${isExpanded ? 'virtual-players-panel--expanded' : ''}`}>
      <div
        className="virtual-players-panel__header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="virtual-players-panel__title">
          {t('virtualPlayers.title')}
          {totalTradeCount > 0 && (
            <span className="virtual-players-panel__count">
              – {t('virtualPlayers.tradesCount', { count: totalTradeCount })}
            </span>
          )}
        </span>
        <span className="virtual-players-panel__toggle">▼</span>
      </div>
      <div className="virtual-players-panel__content-wrapper">
        <div className="virtual-players-panel__content">
          <div className="virtual-players-panel__content-inner">
            <VirtualPlayersList
              players={players}
              stocks={stocks}
              totalTradeCount={totalTradeCount}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

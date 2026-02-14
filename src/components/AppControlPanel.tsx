import { useState, useRef, useEffect, memo, type ReactElement, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { VirtualPlayer, Stock, MarketPhase, Sector, GameMode } from '../types';
import type { SpeedMultiplier } from '../store/settingsSlice';
import { MarketMakerInventory } from './MarketMakerInventory';
import type { MarketMakerLevel } from './MarketMakerInventory';
import { VirtualPlayersPanel } from './VirtualPlayersPanel';
import { EconomicClimate } from './EconomicClimate';
import { CircularTimer } from './CircularTimer';

// Speed slider component - 4-position slider: Pause, 1x, 2x, 3x
type SliderPosition = 0 | 1 | 2 | 3;

interface SpeedSliderProps {
  speedMultiplier: SpeedMultiplier;
  isPaused: boolean;
  showAsPaused: boolean;
  onSetSpeed: (speed: SpeedMultiplier) => void;
  onTogglePause: () => void;
}

const SLIDER_ICONS: Record<SliderPosition, ReactElement> = {
  0: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
    </svg>
  ),
  1: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z"/>
    </svg>
  ),
  2: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/>
    </svg>
  ),
  3: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.5 18l6-6-6-6v12zm7 0l6-6-6-6v12zm7 0l6-6-6-6v12z"/>
    </svg>
  ),
};

const SLIDER_POSITIONS: SliderPosition[] = [0, 1, 2, 3];
// Center of each stop in px (matches CSS: 12px, 36px, 60px, 84px)
const STOP_CENTERS = [12, 36, 60, 84];

const getPositionForX = (left: number): SliderPosition => {
  let closest: SliderPosition = 0;
  let minDist = Infinity;
  STOP_CENTERS.forEach((pos, i) => {
    const dist = Math.abs(left - pos);
    if (dist < minDist) { minDist = dist; closest = SLIDER_POSITIONS[i]; }
  });
  return closest;
};

const SpeedSlider = memo(({ speedMultiplier, isPaused, showAsPaused, onSetSpeed, onTogglePause }: SpeedSliderProps) => {
  const { t } = useTranslation();
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragLeft, setDragLeft] = useState<number | null>(null);

  const activePosition: SliderPosition = showAsPaused ? 0 : speedMultiplier;

  const handlePositionSelect = (position: SliderPosition) => {
    if (position === 0) {
      if (!isPaused) onTogglePause();
    } else {
      if (showAsPaused && !isPaused) return;
      if (isPaused) onTogglePause();
      onSetSpeed(position as SpeedMultiplier);
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!sliderRef.current) return;
      const rect = sliderRef.current.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      setDragLeft(Math.max(STOP_CENTERS[0], Math.min(STOP_CENTERS[3], relX)));
    };

    const handlePointerUp = (e: PointerEvent) => {
      setIsDragging(false);
      setDragLeft(null);
      if (!sliderRef.current) return;
      const rect = sliderRef.current.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      handlePositionSelect(getPositionForX(relX));
    };

    const handlePointerCancel = () => {
      setIsDragging(false);
      setDragLeft(null);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerCancel);
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerCancel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging, isPaused, showAsPaused, onSetSpeed, onTogglePause]);

  const handleThumbPointerDown = (e: ReactPointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const thumbStyle: CSSProperties = isDragging && dragLeft !== null
    ? { left: `${dragLeft}px`, transition: 'none' }
    : {};

  const displayPosition = isDragging && dragLeft !== null
    ? getPositionForX(dragLeft)
    : activePosition;

  const getStopTitle = (pos: SliderPosition): string =>
    pos === 0 ? t('game.pause') : t('game.speed', { speed: pos });

  return (
    <div
      className="app-control-panel__speed-slider"
      role="radiogroup"
      aria-label={t('game.speed', { speed: speedMultiplier })}
      ref={sliderRef}
    >
      {SLIDER_POSITIONS.map((pos) => (
        <button
          key={pos}
          className={`app-control-panel__speed-slider-stop${pos === activePosition ? ' app-control-panel__speed-slider-stop--active' : ''}`}
          onClick={() => handlePositionSelect(pos)}
          role="radio"
          aria-checked={pos === activePosition}
          title={getStopTitle(pos)}
        />
      ))}
      <div
        className={`app-control-panel__speed-slider-thumb app-control-panel__speed-slider-thumb--pos-${activePosition}${isDragging ? ' app-control-panel__speed-slider-thumb--dragging' : ''}`}
        style={thumbStyle}
        onPointerDown={handleThumbPointerDown}
      >
        {SLIDER_ICONS[displayPosition]}
      </div>
    </div>
  );
});

SpeedSlider.displayName = 'SpeedSlider';

interface AppControlPanelProps {
  players: VirtualPlayer[];
  stocks: Stock[];
  totalTradeCount: number;
  // Game mode (affects what is shown)
  gameMode?: GameMode;
  // Debug: Alt+M toggles market overview visibility in Hard Life mode
  debugMarketVisible?: boolean;
  // Market Maker data
  marketMakerLevels?: Record<string, MarketMakerLevel>;
  // Economic Climate data
  globalPhase?: MarketPhase;
  sectorPhases?: Record<Sector, MarketPhase>;
  fearGreedIndex?: number;
  // Mobile controls
  isPaused?: boolean;
  isEffectivelyPaused?: boolean; // True when paused for any reason (manually, trade panel open, etc.)
  countdown?: number;
  updateInterval?: number;
  onTogglePause?: () => void;
  // Speed controls
  speedMultiplier?: SpeedMultiplier;
  onSetSpeed?: (speed: SpeedMultiplier) => void;
  // Timed game progress
  remainingCycles?: number | null;
  gameProgress?: number | null;
  gameDuration?: number | null;
}

export const AppControlPanel = ({
  players,
  stocks,
  totalTradeCount,
  gameMode = 'realLife',
  debugMarketVisible = false,
  marketMakerLevels,
  globalPhase,
  sectorPhases,
  fearGreedIndex,
  isPaused,
  isEffectivelyPaused,
  countdown,
  updateInterval,
  onTogglePause,
  speedMultiplier = 1,
  onSetSpeed,
  remainingCycles,
  gameProgress,
  gameDuration,
}: AppControlPanelProps) => {
  const { t } = useTranslation();
  // For visual display: effectively paused (manually or by trade panel etc.)
  const showAsPaused = isEffectivelyPaused ?? isPaused;
  const [isExpanded, setIsExpanded] = useState(false);

  // Show market overview section: always in Real Life mode, or when debug toggle is active
  const showMarketOverview = gameMode === 'realLife' || debugMarketVisible;

  // Timer progress: countdown goes from updateInterval to 0
  // We divide by (updateInterval - 1) so that when countdown = updateInterval AND updateInterval - 1
  // the bar is at 100% (buffer for the first second after reset)
  const timerProgress = updateInterval && updateInterval > 1
    ? Math.min(100, ((countdown ?? 0) / (updateInterval - 1)) * 100)
    : (countdown ?? 0) > 0 ? 100 : 0;

  // Game progress: how much of the timed game is remaining (inverted: starts at 100%, goes to 0%)
  const isTimedGame = gameDuration !== null && gameDuration !== undefined;
  const gameRemainingProgress = isTimedGame && gameProgress !== null && gameProgress !== undefined
    ? Math.max(0, (1 - gameProgress) * 100)
    : null;

  return (
    <div className={`app-control-panel ${isExpanded ? 'app-control-panel--expanded' : ''}`}>
      <div className="app-control-panel__bar">
        {/* Left section: Market toggle (hidden in Hard Life mode unless debug) */}
        <div className="app-control-panel__left">
          {showMarketOverview && players.length > 0 && (
            <button
              className={`app-control-panel__market-toggle ${isExpanded ? 'app-control-panel__market-toggle--expanded' : ''}`}
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? t('game.hidePlayers') : t('game.showPlayers')}
            >
              {t('game.marketOverview')}
              <span className="app-control-panel__market-toggle-icon">▼</span>
            </button>
          )}
        </div>

        {/* Middle section: wraps center and playback for flexible layout */}
        <div className="app-control-panel__middle">
          {/* Center section: Timers */}
          <div className="app-control-panel__center">
            {/* Current cycle timer */}
            <div className={`app-control-panel__cycle-timer ${showAsPaused ? 'app-control-panel__cycle-timer--paused' : ''}`}>
              <CircularTimer
                progress={timerProgress}
                size={28}
                strokeWidth={3}
                counterClockwise={true}
                isPaused={showAsPaused}
              />
              <span className="app-control-panel__timer-label">{t('game.currentCycle')}</span>
            </div>

            {/* Remaining game time (only for timed games) */}
            {isTimedGame && gameRemainingProgress !== null && (
              <div className={`app-control-panel__game-timer ${showAsPaused ? 'app-control-panel__game-timer--paused' : ''}`}>
                <CircularTimer
                  progress={gameRemainingProgress}
                  size={28}
                  strokeWidth={3}
                  counterClockwise={true}
                  isPaused={showAsPaused}
                  centerText={remainingCycles ?? undefined}
                />
                <span className="app-control-panel__timer-label">{t('game.remainingTime')}</span>
              </div>
            )}
          </div>

          {/* Playback controls (combined Speed + Pause slider) */}
          <div className="app-control-panel__playback">
            {onSetSpeed && onTogglePause && (
              <SpeedSlider
                speedMultiplier={speedMultiplier}
                isPaused={isPaused ?? false}
                showAsPaused={showAsPaused ?? false}
                onSetSpeed={onSetSpeed}
                onTogglePause={onTogglePause}
              />
            )}
          </div>
        </div>
      </div>

      {/* Market overview content (hidden in Hard Life mode unless debug) */}
      {showMarketOverview && (
        <div className="app-control-panel__content-wrapper">
          <div className="app-control-panel__content">
            <div className="app-control-panel__content-inner">
              {/* Economic Climate */}
              {globalPhase && sectorPhases && fearGreedIndex !== undefined && (
                <EconomicClimate
                  globalPhase={globalPhase}
                  sectorPhases={sectorPhases}
                  fearGreedIndex={fearGreedIndex}
                />
              )}

              {/* Virtual Players */}
              <VirtualPlayersPanel
                players={players}
                stocks={stocks}
                totalTradeCount={totalTradeCount}
                defaultExpanded={false}
              />

              {/* Market Maker Inventory (collapsible, collapsed by default) */}
              {marketMakerLevels && Object.keys(marketMakerLevels).length > 0 && (
                <MarketMakerInventory
                  stocks={stocks}
                  marketMakerLevels={marketMakerLevels}
                  defaultExpanded={false}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

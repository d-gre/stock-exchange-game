import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AppControlPanel } from './AppControlPanel';
import type { VirtualPlayer, Stock } from '../types';

describe('AppControlPanel', () => {
  const mockStocks: Stock[] = [
    {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      sector: 'tech',
      currentPrice: 150,
      change: 5,
      changePercent: 3.45,
      priceHistory: [],
      marketCapBillions: 3000,
    },
    {
      symbol: 'GOOGL',
      name: 'Alphabet Inc.',
      sector: 'tech',
      currentPrice: 200,
      change: -3,
      changePercent: -1.48,
      priceHistory: [],
      marketCapBillions: 2000,
    },
  ];

  const createMockPlayer = (
    id: string,
    name: string,
    cash: number = 5000,
    holdings: VirtualPlayer['portfolio']['holdings'] = [],
    transactions: VirtualPlayer['transactions'] = [],
    riskTolerance: number = 0
  ): VirtualPlayer => ({
    id,
    name,
    portfolio: { cash, holdings },
    transactions,
    settings: {
      riskTolerance,
    },
    loans: [],
    cyclesSinceInterest: 0,
    initialCash: cash,
  });

  const mockPlayers: VirtualPlayer[] = [
    createMockPlayer('bot-1', 'Bot Alpha', 5000, [
      { symbol: 'AAPL', shares: 10, avgBuyPrice: 100 },
    ], [
      { id: 'tx-1', symbol: 'AAPL', type: 'buy', shares: 10, price: 100, timestamp: 1700000000000 },
    ], -50),
    createMockPlayer('bot-2', 'Bot Beta', 8000, [
      { symbol: 'GOOGL', shares: 5, avgBuyPrice: 180 },
    ], [], 0),
    createMockPlayer('bot-3', 'Bot Gamma', 10000, [], [], 75),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('collapsed state', () => {
    it('should render market toggle button', () => {
      render(
        <AppControlPanel
          players={mockPlayers}
          stocks={mockStocks}
          totalTradeCount={5}
        />
      );
      expect(screen.getByRole('button', { name: /Marktübersicht/ })).toBeInTheDocument();
    });

    it('should show market toggle regardless of trade count', () => {
      render(
        <AppControlPanel
          players={mockPlayers}
          stocks={mockStocks}
          totalTradeCount={0}
        />
      );
      expect(screen.getByRole('button', { name: /Marktübersicht/ })).toBeInTheDocument();
    });

    it('should not show market toggle when no players', () => {
      render(
        <AppControlPanel
          players={[]}
          stocks={mockStocks}
          totalTradeCount={0}
        />
      );
      expect(screen.queryByRole('button', { name: /Marktübersicht/ })).not.toBeInTheDocument();
    });

    it('should not show content when collapsed', () => {
      const { container } = render(
        <AppControlPanel
          players={mockPlayers}
          stocks={mockStocks}
          totalTradeCount={1}
        />
      );
      // Content wrapper exists but panel is not expanded
      expect(container.querySelector('.app-control-panel--expanded')).not.toBeInTheDocument();
    });

    it('should show expand arrow when collapsed', () => {
      const { container } = render(
        <AppControlPanel
          players={mockPlayers}
          stocks={mockStocks}
          totalTradeCount={1}
        />
      );
      // Check for toggle icon in market toggle button
      expect(container.querySelector('.app-control-panel__market-toggle-icon')).toBeInTheDocument();
    });
  });

  describe('expanded state', () => {
    it('should show player list when expanded', () => {
      render(
        <AppControlPanel
          players={mockPlayers}
          stocks={mockStocks}
          totalTradeCount={1}
        />
      );
      // First expand the control panel
      fireEvent.click(screen.getByRole('button', { name: /Marktübersicht/ }));

      // VirtualPlayersPanel is collapsed by default, expand it
      fireEvent.click(screen.getByText('Virtuelle Spieler'));

      expect(screen.getByText('Bot Alpha')).toBeInTheDocument();
      expect(screen.getByText('Bot Beta')).toBeInTheDocument();
      expect(screen.getByText('Bot Gamma')).toBeInTheDocument();
    });

    it('should show collapse arrow when expanded', () => {
      const { container } = render(
        <AppControlPanel
          players={mockPlayers}
          stocks={mockStocks}
          totalTradeCount={1}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: /Marktübersicht/ }));

      // Panel should have expanded class (arrow rotates via CSS)
      expect(container.querySelector('.app-control-panel--expanded')).toBeInTheDocument();
    });

    it('should toggle back to collapsed when clicking again', () => {
      const { container } = render(
        <AppControlPanel
          players={mockPlayers}
          stocks={mockStocks}
          totalTradeCount={1}
        />
      );
      const marketToggle = screen.getByRole('button', { name: /Marktübersicht/ });

      // Expand control panel
      fireEvent.click(marketToggle);
      expect(container.querySelector('.app-control-panel--expanded')).toBeInTheDocument();

      // Collapse control panel
      fireEvent.click(marketToggle);
      expect(container.querySelector('.app-control-panel--expanded')).not.toBeInTheDocument();
    });

    it('should handle empty players array', () => {
      render(
        <AppControlPanel
          players={[]}
          stocks={mockStocks}
          totalTradeCount={0}
        />
      );
      // No market toggle shown when no players
      expect(screen.queryByRole('button', { name: /Trades|Spieler/ })).not.toBeInTheDocument();
    });
  });

  describe('speed slider', () => {
    const mockOnSetSpeed = vi.fn();
    const mockOnTogglePause = vi.fn();

    const sliderProps = () => ({
      players: [] as VirtualPlayer[],
      stocks: mockStocks,
      totalTradeCount: 0,
      onSetSpeed: mockOnSetSpeed,
      onTogglePause: mockOnTogglePause,
    });

    beforeEach(() => {
      mockOnSetSpeed.mockClear();
      mockOnTogglePause.mockClear();
    });

    it('should render speed slider when onSetSpeed and onTogglePause are provided', () => {
      const { container } = render(
        <AppControlPanel {...sliderProps()} />
      );
      expect(container.querySelector('.app-control-panel__speed-slider')).toBeInTheDocument();
    });

    it('should not render speed slider when onSetSpeed is not provided', () => {
      const { container } = render(
        <AppControlPanel
          players={[]}
          stocks={mockStocks}
          totalTradeCount={0}
        />
      );
      expect(container.querySelector('.app-control-panel__speed-slider')).not.toBeInTheDocument();
    });

    it('should render 4 stop buttons (pause + 3 speeds)', () => {
      const { container } = render(
        <AppControlPanel {...sliderProps()} />
      );
      const stops = container.querySelectorAll('.app-control-panel__speed-slider-stop');
      expect(stops).toHaveLength(4);
    });

    it('should mark active stop for current speed when not paused', () => {
      const { container } = render(
        <AppControlPanel {...sliderProps()} speedMultiplier={2} isPaused={false} isEffectivelyPaused={false} />
      );
      const activeStops = container.querySelectorAll('.app-control-panel__speed-slider-stop--active');
      expect(activeStops).toHaveLength(1);
      expect(activeStops[0]).toHaveAttribute('aria-checked', 'true');
    });

    it('should mark pause stop as active when paused', () => {
      const { container } = render(
        <AppControlPanel {...sliderProps()} speedMultiplier={2} isPaused={true} isEffectivelyPaused={true} />
      );
      const thumb = container.querySelector('.app-control-panel__speed-slider-thumb');
      expect(thumb).toHaveClass('app-control-panel__speed-slider-thumb--pos-0');
    });

    it('should position thumb at current speed when not paused', () => {
      const { container } = render(
        <AppControlPanel {...sliderProps()} speedMultiplier={3} isPaused={false} isEffectivelyPaused={false} />
      );
      const thumb = container.querySelector('.app-control-panel__speed-slider-thumb');
      expect(thumb).toHaveClass('app-control-panel__speed-slider-thumb--pos-3');
    });

    it('should set speed to 1x when clicking 1x stop', () => {
      render(
        <AppControlPanel {...sliderProps()} speedMultiplier={2} isPaused={false} isEffectivelyPaused={false} />
      );
      fireEvent.click(screen.getByTitle('Geschwindigkeit: 1x'));
      expect(mockOnSetSpeed).toHaveBeenCalledWith(1);
    });

    it('should set speed to 2x when clicking 2x stop', () => {
      render(
        <AppControlPanel {...sliderProps()} speedMultiplier={1} isPaused={false} isEffectivelyPaused={false} />
      );
      fireEvent.click(screen.getByTitle('Geschwindigkeit: 2x'));
      expect(mockOnSetSpeed).toHaveBeenCalledWith(2);
    });

    it('should set speed to 3x when clicking 3x stop', () => {
      render(
        <AppControlPanel {...sliderProps()} speedMultiplier={1} isPaused={false} isEffectivelyPaused={false} />
      );
      fireEvent.click(screen.getByTitle('Geschwindigkeit: 3x'));
      expect(mockOnSetSpeed).toHaveBeenCalledWith(3);
    });

    it('should have pause stop on slider', () => {
      render(
        <AppControlPanel {...sliderProps()} isPaused={false} isEffectivelyPaused={false} />
      );
      expect(screen.getByTitle('Pausieren')).toBeInTheDocument();
    });

    it('should call onTogglePause when clicking pause stop while playing', () => {
      render(
        <AppControlPanel {...sliderProps()} isPaused={false} isEffectivelyPaused={false} />
      );
      fireEvent.click(screen.getByTitle('Pausieren'));
      expect(mockOnTogglePause).toHaveBeenCalled();
    });

    it('should show pause icon in thumb when paused', () => {
      const { container } = render(
        <AppControlPanel {...sliderProps()} isPaused={true} isEffectivelyPaused={true} />
      );
      const thumb = container.querySelector('.app-control-panel__speed-slider-thumb');
      // Pause icon path (two bars)
      expect(thumb?.querySelector('path')?.getAttribute('d')).toBe('M6 19h4V5H6v14zm8-14v14h4V5h-4z');
    });

    it('should unpause and set speed when clicking speed stop while paused', () => {
      render(
        <AppControlPanel {...sliderProps()} isPaused={true} isEffectivelyPaused={true} />
      );
      fireEvent.click(screen.getByTitle('Geschwindigkeit: 2x'));
      expect(mockOnTogglePause).toHaveBeenCalled();
      expect(mockOnSetSpeed).toHaveBeenCalledWith(2);
    });

    it('should add dragging class on pointer down on thumb', () => {
      const { container } = render(
        <AppControlPanel {...sliderProps()} speedMultiplier={1} isPaused={false} isEffectivelyPaused={false} />
      );
      const thumb = container.querySelector('.app-control-panel__speed-slider-thumb')!;
      fireEvent.pointerDown(thumb, { clientX: 36 });
      expect(thumb).toHaveClass('app-control-panel__speed-slider-thumb--dragging');
    });

    it('should snap to speed 3 when dragging thumb to rightmost position', () => {
      const { container } = render(
        <AppControlPanel {...sliderProps()} speedMultiplier={1} isPaused={false} isEffectivelyPaused={false} />
      );
      const slider = container.querySelector('.app-control-panel__speed-slider')!;
      const thumb = container.querySelector('.app-control-panel__speed-slider-thumb')!;

      slider.getBoundingClientRect = vi.fn(() => ({
        left: 0, top: 0, right: 96, bottom: 36, width: 96, height: 36, x: 0, y: 0, toJSON: () => {},
      }));

      act(() => { fireEvent.pointerDown(thumb, { clientX: 36 }); });
      act(() => {
        document.dispatchEvent(new MouseEvent('pointermove', { clientX: 84, bubbles: true }));
        document.dispatchEvent(new MouseEvent('pointerup', { clientX: 84, bubbles: true }));
      });

      expect(mockOnSetSpeed).toHaveBeenCalledWith(3);
    });

    it('should snap to pause when dragging thumb to leftmost position', () => {
      const { container } = render(
        <AppControlPanel {...sliderProps()} speedMultiplier={2} isPaused={false} isEffectivelyPaused={false} />
      );
      const slider = container.querySelector('.app-control-panel__speed-slider')!;
      const thumb = container.querySelector('.app-control-panel__speed-slider-thumb')!;

      slider.getBoundingClientRect = vi.fn(() => ({
        left: 0, top: 0, right: 96, bottom: 36, width: 96, height: 36, x: 0, y: 0, toJSON: () => {},
      }));

      act(() => { fireEvent.pointerDown(thumb, { clientX: 60 }); });
      act(() => {
        document.dispatchEvent(new MouseEvent('pointermove', { clientX: 12, bubbles: true }));
        document.dispatchEvent(new MouseEvent('pointerup', { clientX: 12, bubbles: true }));
      });

      expect(mockOnTogglePause).toHaveBeenCalled();
    });

    it('should remove dragging class after pointer up', () => {
      const { container } = render(
        <AppControlPanel {...sliderProps()} speedMultiplier={1} isPaused={false} isEffectivelyPaused={false} />
      );
      const slider = container.querySelector('.app-control-panel__speed-slider')!;
      const thumb = container.querySelector('.app-control-panel__speed-slider-thumb')!;

      slider.getBoundingClientRect = vi.fn(() => ({
        left: 0, top: 0, right: 96, bottom: 36, width: 96, height: 36, x: 0, y: 0, toJSON: () => {},
      }));

      act(() => { fireEvent.pointerDown(thumb, { clientX: 36 }); });
      expect(thumb).toHaveClass('app-control-panel__speed-slider-thumb--dragging');

      act(() => { document.dispatchEvent(new MouseEvent('pointerup', { clientX: 36, bubbles: true })); });
      expect(thumb).not.toHaveClass('app-control-panel__speed-slider-thumb--dragging');
    });

    it('should show speed icon in thumb when playing', () => {
      const { container } = render(
        <AppControlPanel {...sliderProps()} speedMultiplier={1} isPaused={false} isEffectivelyPaused={false} />
      );
      const thumb = container.querySelector('.app-control-panel__speed-slider-thumb');
      // Play/1x icon path (single triangle)
      expect(thumb?.querySelector('path')?.getAttribute('d')).toBe('M8 5v14l11-7z');
    });
  });

  describe('circular timer display', () => {
    it('should show cycle timer with label', () => {
      render(
        <AppControlPanel
          players={[]}
          stocks={mockStocks}
          totalTradeCount={0}
          countdown={5}
          updateInterval={10}
        />
      );
      expect(screen.getByText('Nächste Aktualisierung')).toBeInTheDocument();
    });

    it('should show circular timer component', () => {
      const { container } = render(
        <AppControlPanel
          players={[]}
          stocks={mockStocks}
          totalTradeCount={0}
          countdown={5}
          updateInterval={10}
        />
      );
      expect(container.querySelector('.circular-timer')).toBeInTheDocument();
    });

    it('should show paused state when isPaused is true', () => {
      const { container } = render(
        <AppControlPanel
          players={[]}
          stocks={mockStocks}
          totalTradeCount={0}
          countdown={5}
          updateInterval={10}
          isPaused={true}
        />
      );
      expect(container.querySelector('.app-control-panel__cycle-timer--paused')).toBeInTheDocument();
    });

    it('should show paused state when isEffectivelyPaused is true', () => {
      const { container } = render(
        <AppControlPanel
          players={[]}
          stocks={mockStocks}
          totalTradeCount={0}
          countdown={5}
          updateInterval={10}
          isEffectivelyPaused={true}
        />
      );
      expect(container.querySelector('.app-control-panel__cycle-timer--paused')).toBeInTheDocument();
    });

    it('should show game timer when timed game is active', () => {
      render(
        <AppControlPanel
          players={[]}
          stocks={mockStocks}
          totalTradeCount={0}
          countdown={5}
          updateInterval={10}
          gameDuration={100}
          gameProgress={0.5}
          remainingCycles={50}
        />
      );
      expect(screen.getByText('Verbleibende Runden')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
    });

    it('should not show game timer when not a timed game', () => {
      render(
        <AppControlPanel
          players={[]}
          stocks={mockStocks}
          totalTradeCount={0}
          countdown={5}
          updateInterval={10}
          gameDuration={null}
        />
      );
      expect(screen.queryByText('Verbleibende Spielzeit')).not.toBeInTheDocument();
    });
  });

  describe('market maker inventory integration', () => {
    it('should show market maker section when marketMakerLevels is provided', () => {
      render(
        <AppControlPanel
          players={mockPlayers}
          stocks={mockStocks}
          totalTradeCount={1}
          marketMakerLevels={{
            AAPL: { level: 1.0, spreadMultiplier: 1.0 },
          }}
        />
      );
      // Expand panel
      fireEvent.click(screen.getByRole('button', { name: /Marktübersicht/ }));

      expect(screen.getByText('Market Maker Inventar')).toBeInTheDocument();
    });

    it('should not show market maker section when marketMakerLevels is empty', () => {
      render(
        <AppControlPanel
          players={mockPlayers}
          stocks={mockStocks}
          totalTradeCount={1}
          marketMakerLevels={{}}
        />
      );
      // Expand panel
      fireEvent.click(screen.getByRole('button', { name: /Marktübersicht/ }));

      expect(screen.queryByText('Market Maker Inventar')).not.toBeInTheDocument();
    });
  });
});

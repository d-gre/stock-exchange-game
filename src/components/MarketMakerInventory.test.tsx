import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MarketMakerInventory } from './MarketMakerInventory';
import type { Stock } from '../types';

// Mock i18next - imports actual i18n from setup
import '../test/setup';

const mockStocks: Stock[] = [
  {
    symbol: 'AAPL',
    name: 'Apple',
    sector: 'tech',
    currentPrice: 150,
    priceHistory: [],
    change: 5,
    changePercent: 3.45,
    marketCapBillions: 3000,
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft',
    sector: 'tech',
    currentPrice: 300,
    priceHistory: [],
    change: 5,
    changePercent: 1.69,
    marketCapBillions: 3000,
  },
  {
    symbol: 'GOOGL',
    name: 'Alphabet',
    sector: 'tech',
    currentPrice: 140,
    priceHistory: [],
    change: -2,
    changePercent: -1.41,
    marketCapBillions: 2000,
  },
];

describe('MarketMakerInventory', () => {
  describe('rendering', () => {
    it('should render nothing when marketMakerLevels is empty', () => {
      const { container } = render(
        <MarketMakerInventory
          stocks={mockStocks}
          marketMakerLevels={{}}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render the component with title', () => {
      render(
        <MarketMakerInventory
          stocks={mockStocks}
          marketMakerLevels={{
            AAPL: { level: 1.0, spreadMultiplier: 1.0 },
          }}
        />
      );
      // German translation: "Market Maker Inventar"
      expect(screen.getByText('Market Maker Inventar')).toBeInTheDocument();
    });

    it('should render inventory bars for each stock with data', () => {
      render(
        <MarketMakerInventory
          stocks={mockStocks}
          marketMakerLevels={{
            AAPL: { level: 1.0, spreadMultiplier: 1.0 },
            MSFT: { level: 0.8, spreadMultiplier: 1.2 },
          }}
        />
      );
      expect(screen.getByText('AAPL')).toBeInTheDocument();
      expect(screen.getByText('MSFT')).toBeInTheDocument();
      // GOOGL has no MM data, should not be rendered
      expect(screen.queryByText('GOOGL')).not.toBeInTheDocument();
    });

    it('should display inventory level percentage', () => {
      render(
        <MarketMakerInventory
          stocks={mockStocks}
          marketMakerLevels={{
            AAPL: { level: 0.75, spreadMultiplier: 1.5 },
          }}
        />
      );
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('should display spread percentage', () => {
      render(
        <MarketMakerInventory
          stocks={mockStocks}
          marketMakerLevels={{
            AAPL: { level: 1.0, spreadMultiplier: 1.5 },
          }}
        />
      );
      expect(screen.getByText('+50.0%')).toBeInTheDocument();
    });
  });

  describe('expand/collapse', () => {
    it('should be expanded by default', () => {
      const { container } = render(
        <MarketMakerInventory
          stocks={mockStocks}
          marketMakerLevels={{
            AAPL: { level: 1.0, spreadMultiplier: 1.0 },
          }}
        />
      );
      // Panel should have expanded class
      expect(container.querySelector('.market-maker-inventory--expanded')).toBeInTheDocument();
      // Toggle icon is always ▼ (rotates via CSS when expanded)
      expect(screen.getByText('▼')).toBeInTheDocument();
    });

    it('should collapse when header is clicked', () => {
      const { container } = render(
        <MarketMakerInventory
          stocks={mockStocks}
          marketMakerLevels={{
            AAPL: { level: 1.0, spreadMultiplier: 1.0 },
          }}
        />
      );

      fireEvent.click(screen.getByText('Market Maker Inventar'));

      // Panel should not have expanded class
      expect(container.querySelector('.market-maker-inventory--expanded')).not.toBeInTheDocument();
    });

    it('should expand again when header is clicked twice', () => {
      const { container } = render(
        <MarketMakerInventory
          stocks={mockStocks}
          marketMakerLevels={{
            AAPL: { level: 1.0, spreadMultiplier: 1.0 },
          }}
        />
      );

      // Collapse
      fireEvent.click(screen.getByText('Market Maker Inventar'));
      expect(container.querySelector('.market-maker-inventory--expanded')).not.toBeInTheDocument();

      // Expand
      fireEvent.click(screen.getByText('Market Maker Inventar'));
      expect(container.querySelector('.market-maker-inventory--expanded')).toBeInTheDocument();
    });

    it('should respect defaultExpanded prop', () => {
      const { container } = render(
        <MarketMakerInventory
          stocks={mockStocks}
          marketMakerLevels={{
            AAPL: { level: 1.0, spreadMultiplier: 1.0 },
          }}
          defaultExpanded={false}
        />
      );

      // Panel should not have expanded class
      expect(container.querySelector('.market-maker-inventory--expanded')).not.toBeInTheDocument();
    });
  });

  describe('inventory level modifiers', () => {
    it('should apply normal modifier for level 80-120%', () => {
      const { container } = render(
        <MarketMakerInventory
          stocks={mockStocks}
          marketMakerLevels={{
            AAPL: { level: 1.0, spreadMultiplier: 1.0 },
          }}
        />
      );
      const bar = container.querySelector('.market-maker-inventory__bar--normal');
      expect(bar).toBeInTheDocument();
    });

    it('should apply warning modifier for level 50-80%', () => {
      const { container } = render(
        <MarketMakerInventory
          stocks={mockStocks}
          marketMakerLevels={{
            AAPL: { level: 0.6, spreadMultiplier: 1.5 },
          }}
        />
      );
      const bar = container.querySelector('.market-maker-inventory__bar--warning');
      expect(bar).toBeInTheDocument();
    });

    it('should apply critical modifier for level < 50%', () => {
      const { container } = render(
        <MarketMakerInventory
          stocks={mockStocks}
          marketMakerLevels={{
            AAPL: { level: 0.3, spreadMultiplier: 2.5 },
          }}
        />
      );
      const bar = container.querySelector('.market-maker-inventory__bar--critical');
      expect(bar).toBeInTheDocument();
    });

    it('should apply excess modifier for level > 120%', () => {
      const { container } = render(
        <MarketMakerInventory
          stocks={mockStocks}
          marketMakerLevels={{
            AAPL: { level: 1.5, spreadMultiplier: 0.7 },
          }}
        />
      );
      const bar = container.querySelector('.market-maker-inventory__bar--excess');
      expect(bar).toBeInTheDocument();
    });
  });

  describe('spread display', () => {
    it('should apply high spread modifier when spreadMultiplier > 1.5', () => {
      const { container } = render(
        <MarketMakerInventory
          stocks={mockStocks}
          marketMakerLevels={{
            AAPL: { level: 0.3, spreadMultiplier: 2.0 },
          }}
        />
      );
      const spread = container.querySelector('.market-maker-inventory__spread--high');
      expect(spread).toBeInTheDocument();
    });

    it('should not apply high spread modifier when spreadMultiplier <= 1.5', () => {
      const { container } = render(
        <MarketMakerInventory
          stocks={mockStocks}
          marketMakerLevels={{
            AAPL: { level: 1.0, spreadMultiplier: 1.2 },
          }}
        />
      );
      const spread = container.querySelector('.market-maker-inventory__spread--high');
      expect(spread).not.toBeInTheDocument();
    });

    it('should display negative spread for multiplier < 1', () => {
      render(
        <MarketMakerInventory
          stocks={mockStocks}
          marketMakerLevels={{
            AAPL: { level: 1.5, spreadMultiplier: 0.8 },
          }}
        />
      );
      expect(screen.getByText('-20.0%')).toBeInTheDocument();
    });
  });

  describe('bar width', () => {
    it('should set correct bar width based on level', () => {
      const { container } = render(
        <MarketMakerInventory
          stocks={mockStocks}
          marketMakerLevels={{
            AAPL: { level: 0.75, spreadMultiplier: 1.0 },
          }}
        />
      );
      const bar = container.querySelector('.market-maker-inventory__bar');
      expect(bar).toHaveStyle({ width: '75%' });
    });

    it('should cap bar width at 100%', () => {
      const { container } = render(
        <MarketMakerInventory
          stocks={mockStocks}
          marketMakerLevels={{
            AAPL: { level: 1.5, spreadMultiplier: 0.7 },
          }}
        />
      );
      const bar = container.querySelector('.market-maker-inventory__bar');
      expect(bar).toHaveStyle({ width: '100%' });
    });

    it('should not go below 0%', () => {
      const { container } = render(
        <MarketMakerInventory
          stocks={mockStocks}
          marketMakerLevels={{
            AAPL: { level: -0.1, spreadMultiplier: 3.0 },
          }}
        />
      );
      const bar = container.querySelector('.market-maker-inventory__bar');
      expect(bar).toHaveStyle({ width: '0%' });
    });
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TradePanel } from './TradePanel';
import type { Stock, Portfolio, PendingOrder } from '../types';

describe('TradePanel', () => {
  const mockStock: Stock = {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    currentPrice: 100,
    change: 2.5,
    changePercent: 2.56,
    priceHistory: [{ time: 1000, open: 98, high: 101, low: 97, close: 100 }],
    marketCapBillions: 3000,
  };

  const mockPortfolio: Portfolio = {
    cash: 1000,
    holdings: [{ symbol: 'AAPL', shares: 10, avgBuyPrice: 95 }],
  };

  const mockOnClose = vi.fn();
  const mockOnTrade = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render nothing when stock is null', () => {
      const { container } = render(
        <TradePanel
          stock={null}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="sandbox"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render buy panel with correct title', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="sandbox"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );
      expect(screen.getByText('Kaufen: AAPL')).toBeInTheDocument();
    });

    it('should render sell panel with correct title', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="sell"
          portfolio={mockPortfolio}
          gameMode="sandbox"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );
      expect(screen.getByText('Verkaufen: AAPL')).toBeInTheDocument();
    });

    it('should display stock name and price', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="sandbox"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );
      expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
      expect(screen.getByText(/Aktueller Preis:/)).toBeInTheDocument();
      expect(screen.getByText('$100,00', { selector: '.trade-panel__price' })).toBeInTheDocument();
    });

    it('should default to 0 shares', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="sandbox"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveValue(0);
    });

    it('should show available cash for buy', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="sandbox"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );
      expect(screen.getByText(/Verfügbares Bargeld/)).toBeInTheDocument();
      expect(screen.getByText(/1\.000,00/)).toBeInTheDocument();
    });

    it('should show available shares for sell', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="sell"
          portfolio={mockPortfolio}
          gameMode="sandbox"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );
      expect(screen.getByText(/Verfügbare Aktien: 10/)).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should call onClose when clicking close button', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="sandbox"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );
      fireEvent.click(screen.getByText('×'));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onClose when clicking cancel button', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="sandbox"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );
      fireEvent.click(screen.getByText('Abbrechen'));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should set max shares on Max button click (buy)', async () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="sandbox"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      fireEvent.click(screen.getByText('Max'));
      const input = screen.getByRole('spinbutton') as HTMLInputElement;
      // With spread (1%) and slippage, max affordable shares is 9 instead of 10
      expect(parseInt(input.value)).toBeGreaterThan(0);
      expect(parseInt(input.value)).toBeLessThanOrEqual(10);
    });

    it('should set max shares on Max button click (sell)', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="sell"
          portfolio={mockPortfolio}
          gameMode="sandbox"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      fireEvent.click(screen.getByText('Max'));
      const input = screen.getByRole('spinbutton') as HTMLInputElement;
      expect(input.value).toBe('10'); // has 10 shares
    });

    it('should update total when shares change', async () => {
      const user = userEvent.setup();
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="sandbox"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      const input = screen.getByRole('spinbutton');
      await user.clear(input);
      await user.type(input, '5');

      // Check that the breakdown is displayed with "Gesamtkosten:" label
      expect(screen.getByText('Gesamtkosten:')).toBeInTheDocument();
      // The total should be slightly higher than $500 due to spread and slippage
      const totalRow = screen.getByText('Gesamtkosten:').closest('.trade-panel__breakdown-row');
      expect(totalRow).toBeInTheDocument();
    });
  });

  describe('validation', () => {
    it('should disable confirm button when shares is 0', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="sandbox"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '0' } });

      expect(screen.getByRole('button', { name: /Kaufen/i })).toBeDisabled();
    });

    it('should disable confirm button when buying more than can afford', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="sandbox"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '20' } }); // Would cost $2000, only have $1000

      expect(screen.getByRole('button', { name: /Kaufen/i })).toBeDisabled();
    });

    it('should disable confirm button when selling more than owned', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="sell"
          portfolio={mockPortfolio}
          gameMode="sandbox"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '20' } }); // Only have 10 shares

      expect(screen.getByRole('button', { name: /Verkaufen/i })).toBeDisabled();
    });
  });

  describe('trade execution', () => {
    it('should call onTrade and onClose on successful buy', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="sandbox"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '5' } });
      fireEvent.click(screen.getByRole('button', { name: /Kaufen/i }));

      expect(mockOnTrade).toHaveBeenCalledWith(expect.objectContaining({
        symbol: 'AAPL',
        type: 'buy',
        shares: 5,
        orderType: 'market',
      }));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onTrade and onClose on successful sell', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="sell"
          portfolio={mockPortfolio}
          gameMode="sandbox"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '5' } });
      fireEvent.click(screen.getByRole('button', { name: /Verkaufen/i }));

      expect(mockOnTrade).toHaveBeenCalledWith(expect.objectContaining({
        symbol: 'AAPL',
        type: 'sell',
        shares: 5,
        orderType: 'market',
      }));
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('trade restriction per cycle', () => {
    it('should disable buy button when symbol was already traded this cycle', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="sandbox"
          isSymbolTradedThisCycle={true}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      const buyButton = screen.getByRole('button', { name: /Kaufen/i });
      expect(buyButton).toBeDisabled();
    });

    it('should disable sell button when symbol was already traded this cycle', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="sell"
          portfolio={mockPortfolio}
          gameMode="sandbox"
          isSymbolTradedThisCycle={true}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      const sellButton = screen.getByRole('button', { name: /Verkaufen/i });
      expect(sellButton).toBeDisabled();
    });

    it('should not call onTrade when symbol was already traded and button is clicked', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="sandbox"
          isSymbolTradedThisCycle={true}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      const buyButton = screen.getByRole('button', { name: /Kaufen/i });
      fireEvent.click(buyButton);

      expect(mockOnTrade).not.toHaveBeenCalled();
    });
  });

  describe('game mode dependent display', () => {
    it('should show detailed breakdown in sandbox mode', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="sandbox"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      // Enter a share count to show the breakdown
      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '1' } });

      // Sandbox should show detailed info
      expect(screen.getByText('Effektiver Preis/Aktie:')).toBeInTheDocument();
      expect(screen.getByText('Zwischensumme:')).toBeInTheDocument();
      // Should NOT show the banking hint
      expect(screen.queryByText(/Der tatsächliche Ausführungspreis kann/i)).not.toBeInTheDocument();
    });

    it('should show simplified breakdown in realLife mode', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="realLife"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      // Enter a share count to show the breakdown
      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '1' } });

      // Real Life should show simple banking-style info
      expect(screen.getByText('Anzahl × Kurs:')).toBeInTheDocument();
      expect(screen.getByText(/Der tatsächliche Ausführungspreis kann/i)).toBeInTheDocument();
      // Should NOT show detailed breakdown
      expect(screen.queryByText('Effektiver Preis/Aktie:')).not.toBeInTheDocument();
      expect(screen.queryByText('Zwischensumme:')).not.toBeInTheDocument();
    });

    it('should show simplified breakdown in hardLife mode', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="hardLife"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      // Enter a share count to show the breakdown
      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '1' } });

      // Hard Life should show simple banking-style info
      expect(screen.getByText('Anzahl × Kurs:')).toBeInTheDocument();
      expect(screen.getByText(/Der tatsächliche Ausführungspreis kann/i)).toBeInTheDocument();
      // Should NOT show detailed breakdown
      expect(screen.queryByText('Effektiver Preis/Aktie:')).not.toBeInTheDocument();
    });

    it('should show estimated total with "ca." prefix in non-sandbox modes', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="realLife"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      // Enter a share count to show the breakdown
      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '1' } });

      // Should show "ca." before the total
      expect(screen.getByText(/ca\./)).toBeInTheDocument();
    });

    it('should show exact total without "ca." prefix in sandbox mode', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="sandbox"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      // Enter a share count to show the breakdown
      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '1' } });

      // Should NOT show "ca." in sandbox
      expect(screen.queryByText(/ca\./)).not.toBeInTheDocument();
    });
  });

  describe('order book reservations', () => {
    it('should show reduced available cash when there is reserved cash', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="sandbox"
          isSymbolTradedThisCycle={false}
          reservedCash={300}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      // Available should be 1000 - 300 = 700
      expect(screen.getByText(/Verfügbares Bargeld.*700,00/)).toBeInTheDocument();
    });

    it('should show reserved cash message when there is reserved cash', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="sandbox"
          isSymbolTradedThisCycle={false}
          reservedCash={300}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      expect(screen.getByText(/Reserviert für Orders.*300,00/)).toBeInTheDocument();
    });

    it('should not show reserved message when no cash is reserved', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="sandbox"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      expect(screen.queryByText(/Reserviert für Orders/)).not.toBeInTheDocument();
    });

    it('should show reduced available shares when there are reserved shares for sell', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="sell"
          portfolio={mockPortfolio}
          gameMode="sandbox"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={3}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      // Available should be 10 - 3 = 7
      expect(screen.getByText(/Verfügbare Aktien: 7/)).toBeInTheDocument();
    });

    it('should show reserved shares message when there are reserved shares', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="sell"
          portfolio={mockPortfolio}
          gameMode="sandbox"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={3}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      expect(screen.getByText(/Reserviert für Orders: 3/)).toBeInTheDocument();
    });

    it('should limit max buy shares based on available cash (after reservations)', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="sandbox"
          isSymbolTradedThisCycle={false}
          reservedCash={800}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      fireEvent.click(screen.getByText('Max'));
      const input = screen.getByRole('spinbutton') as HTMLInputElement;
      // With 1000 - 800 = 200 available, at $100 + spread/slippage, max should be 1-2
      expect(parseInt(input.value)).toBeLessThanOrEqual(2);
    });

    it('should limit max sell shares based on available shares (after reservations)', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="sell"
          portfolio={mockPortfolio}
          gameMode="sandbox"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={8}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      fireEvent.click(screen.getByText('Max'));
      const input = screen.getByRole('spinbutton') as HTMLInputElement;
      // With 10 - 8 = 2 available
      expect(input.value).toBe('2');
    });

    it('should disable buy button when all cash is reserved', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="sandbox"
          isSymbolTradedThisCycle={false}
          reservedCash={1000}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '1' } });

      expect(screen.getByRole('button', { name: /Kaufen/i })).toBeDisabled();
    });

    it('should disable sell button when all shares are reserved', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="sell"
          portfolio={mockPortfolio}
          gameMode="sandbox"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={10}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '1' } });

      expect(screen.getByRole('button', { name: /Verkaufen/i })).toBeDisabled();
    });
  });

  describe('order type and validity', () => {
    it('should not show validity options in sandbox mode', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="sandbox"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      // Sandbox mode does not show advanced options
      expect(screen.queryByText('Typ:')).not.toBeInTheDocument();
      expect(screen.queryByText('Gültigkeit:')).not.toBeInTheDocument();
    });

    it('should show order type dropdown in non-sandbox mode', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="realLife"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      expect(screen.getByText('Typ:')).toBeInTheDocument();
      expect(screen.getByText('Billigst')).toBeInTheDocument(); // Default market order for buy
    });

    it('should not show validity options when market order (Billigst) is selected', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="realLife"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      // Market order is default - validity should NOT be shown
      expect(screen.queryByText('Gültigkeit:')).not.toBeInTheDocument();
    });

    it('should not show validity options when market order (Bestens) is selected for sell', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="sell"
          portfolio={mockPortfolio}
          gameMode="realLife"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      // Market order is default - validity should NOT be shown
      expect(screen.queryByText('Gültigkeit:')).not.toBeInTheDocument();
    });

    it('should show validity input with default 10 cycles when limit order is selected', async () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="realLife"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      // Open the order type dropdown
      fireEvent.click(screen.getByText('Billigst'));

      // Select Limit order
      fireEvent.click(screen.getByText('Limit'));

      // Validity input should be shown with default 10 cycles
      expect(screen.getByText('Gültigkeit:')).toBeInTheDocument();
      // shares + limit price + cycles = 3 spinbuttons
      const spinbuttons = screen.getAllByRole('spinbutton');
      expect(spinbuttons.length).toBe(3);
      // The cycles input (index 2) should have value 10 (default)
      // Order: [0] = shares, [1] = limit price, [2] = cycles
      expect(spinbuttons[2]).toHaveValue(10);
    });

    it('should hide validity when switching from limit back to market order', async () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="realLife"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      // Select Limit order
      fireEvent.click(screen.getByText('Billigst'));
      fireEvent.click(screen.getByText('Limit'));
      expect(screen.getByText('Gültigkeit:')).toBeInTheDocument();

      // Switch back to Market order
      fireEvent.click(screen.getByText('Limit'));
      fireEvent.click(screen.getByText('Billigst'));

      // Validity should be hidden again
      expect(screen.queryByText('Gültigkeit:')).not.toBeInTheDocument();
    });
  });

  describe('Stop Limit price validation', () => {
    it('should show warning when Stop Buy Limit has Limit < Stop', async () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="realLife"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      // Select Stop Buy Limit order
      fireEvent.click(screen.getByText('Billigst'));
      fireEvent.click(screen.getByText('Stop Buy Limit'));

      // Set Stop price higher than Limit price (invalid)
      // Order: [0] = shares, [1] = stop price, [2] = limit price, [3] = cycles
      const stopInput = screen.getAllByRole('spinbutton')[1];
      const limitInput = screen.getAllByRole('spinbutton')[2];

      fireEvent.change(stopInput, { target: { value: '150' } });
      fireEvent.change(limitInput, { target: { value: '100' } });

      // Warning should be shown
      expect(screen.getByText(/Ungültige Preiskombination/)).toBeInTheDocument();
      expect(screen.getByText(/Bei Stop Buy Limit muss der Limit-Preis/)).toBeInTheDocument();
    });

    it('should disable confirm button when Stop Buy Limit has invalid prices', async () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="realLife"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      // Select Stop Buy Limit order
      fireEvent.click(screen.getByText('Billigst'));
      fireEvent.click(screen.getByText('Stop Buy Limit'));

      // Set invalid prices
      // Order: [0] = shares, [1] = stop price, [2] = limit price, [3] = cycles
      const sharesInput = screen.getAllByRole('spinbutton')[0];
      const stopInput = screen.getAllByRole('spinbutton')[1];
      const limitInput = screen.getAllByRole('spinbutton')[2];

      fireEvent.change(stopInput, { target: { value: '150' } });
      fireEvent.change(limitInput, { target: { value: '100' } });
      fireEvent.change(sharesInput, { target: { value: '1' } });

      // Button should be disabled
      expect(screen.getByRole('button', { name: /Order aufgeben/i })).toBeDisabled();
    });

    it('should not show warning when Stop Buy Limit has Limit > Stop', async () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="realLife"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      // Select Stop Buy Limit order
      fireEvent.click(screen.getByText('Billigst'));
      fireEvent.click(screen.getByText('Stop Buy Limit'));

      // Set valid prices (Limit > Stop)
      // Order: [0] = shares, [1] = stop price, [2] = limit price, [3] = cycles
      const stopInput = screen.getAllByRole('spinbutton')[1];
      const limitInput = screen.getAllByRole('spinbutton')[2];

      fireEvent.change(stopInput, { target: { value: '100' } });
      fireEvent.change(limitInput, { target: { value: '110' } });

      // Warning should NOT be shown
      expect(screen.queryByText(/Ungültige Preiskombination/)).not.toBeInTheDocument();
    });

    it('should show warning when Stop Loss Limit has Limit > Stop', async () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="sell"
          portfolio={mockPortfolio}
          gameMode="realLife"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      // Select Stop Loss Limit order
      fireEvent.click(screen.getByText('Bestens'));
      fireEvent.click(screen.getByText('Stop Loss Limit'));

      // Set Limit price higher than Stop price (invalid for sell)
      // Order: [0] = shares, [1] = stop price, [2] = limit price, [3] = cycles
      const stopInput = screen.getAllByRole('spinbutton')[1];
      const limitInput = screen.getAllByRole('spinbutton')[2];

      fireEvent.change(stopInput, { target: { value: '80' } });
      fireEvent.change(limitInput, { target: { value: '100' } });

      // Warning should be shown
      expect(screen.getByText(/Ungültige Preiskombination/)).toBeInTheDocument();
      expect(screen.getByText(/Bei Stop Loss Limit muss der Limit-Preis/)).toBeInTheDocument();
    });

    it('should disable confirm button when Stop Loss Limit has invalid prices', async () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="sell"
          portfolio={mockPortfolio}
          gameMode="realLife"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      // Select Stop Loss Limit order
      fireEvent.click(screen.getByText('Bestens'));
      fireEvent.click(screen.getByText('Stop Loss Limit'));

      // Set invalid prices
      // Order: [0] = shares, [1] = stop price, [2] = limit price, [3] = cycles
      const sharesInput = screen.getAllByRole('spinbutton')[0];
      const stopInput = screen.getAllByRole('spinbutton')[1];
      const limitInput = screen.getAllByRole('spinbutton')[2];

      fireEvent.change(stopInput, { target: { value: '80' } });
      fireEvent.change(limitInput, { target: { value: '100' } });
      fireEvent.change(sharesInput, { target: { value: '1' } });

      // Button should be disabled
      expect(screen.getByRole('button', { name: /Order aufgeben/i })).toBeDisabled();
    });

    it('should not show warning when Stop Loss Limit has Limit < Stop', async () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="sell"
          portfolio={mockPortfolio}
          gameMode="realLife"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      // Select Stop Loss Limit order
      fireEvent.click(screen.getByText('Bestens'));
      fireEvent.click(screen.getByText('Stop Loss Limit'));

      // Set valid prices (Limit < Stop)
      // Order: [0] = shares, [1] = stop price, [2] = limit price, [3] = cycles
      const stopInput = screen.getAllByRole('spinbutton')[1];
      const limitInput = screen.getAllByRole('spinbutton')[2];

      fireEvent.change(stopInput, { target: { value: '100' } });
      fireEvent.change(limitInput, { target: { value: '90' } });

      // Warning should NOT be shown
      expect(screen.queryByText(/Ungültige Preiskombination/)).not.toBeInTheDocument();
    });

    it('should show warning when Limit equals Stop for Stop Buy Limit', async () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="realLife"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      // Select Stop Buy Limit order
      fireEvent.click(screen.getByText('Billigst'));
      fireEvent.click(screen.getByText('Stop Buy Limit'));

      // Set prices equal (invalid - Limit must be > Stop)
      // Order: [0] = shares, [1] = stop price, [2] = limit price, [3] = cycles
      const stopInput = screen.getAllByRole('spinbutton')[1];
      const limitInput = screen.getAllByRole('spinbutton')[2];

      fireEvent.change(stopInput, { target: { value: '100' } });
      fireEvent.change(limitInput, { target: { value: '100' } });

      // Warning should be shown
      expect(screen.getByText(/Ungültige Preiskombination/)).toBeInTheDocument();
    });

    it('should show warning when Limit equals Stop for Stop Loss Limit', async () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="sell"
          portfolio={mockPortfolio}
          gameMode="realLife"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      // Select Stop Loss Limit order
      fireEvent.click(screen.getByText('Bestens'));
      fireEvent.click(screen.getByText('Stop Loss Limit'));

      // Set prices equal (invalid - Limit must be < Stop)
      // Order: [0] = shares, [1] = stop price, [2] = limit price, [3] = cycles
      const stopInput = screen.getAllByRole('spinbutton')[1];
      const limitInput = screen.getAllByRole('spinbutton')[2];

      fireEvent.change(stopInput, { target: { value: '100' } });
      fireEvent.change(limitInput, { target: { value: '100' } });

      // Warning should be shown
      expect(screen.getByText(/Ungültige Preiskombination/)).toBeInTheDocument();
    });
  });

  describe('price rounding', () => {
    it('should round default stop price to two decimal places', () => {
      const stockWithOddPrice: Stock = {
        ...mockStock,
        currentPrice: 123.456789,
      };

      render(
        <TradePanel
          stock={stockWithOddPrice}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="realLife"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      // Select Stop Buy order to trigger stop price default
      fireEvent.click(screen.getByText('Billigst'));
      fireEvent.click(screen.getByText('Stop Buy'));

      // Order: [0] = shares, [1] = stop price
      const stopInput = screen.getAllByRole('spinbutton')[1] as HTMLInputElement;
      expect(parseFloat(stopInput.value)).toBe(123.46);
    });

    it('should round default limit price to two decimal places', () => {
      const stockWithOddPrice: Stock = {
        ...mockStock,
        currentPrice: 99.999,
      };

      render(
        <TradePanel
          stock={stockWithOddPrice}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="realLife"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      // Select Limit order to trigger limit price default
      fireEvent.click(screen.getByText('Billigst'));
      fireEvent.click(screen.getByText('Limit'));

      // Order: [0] = shares, [1] = limit price
      const limitInput = screen.getAllByRole('spinbutton')[1] as HTMLInputElement;
      expect(parseFloat(limitInput.value)).toBe(100);
    });

    it('should round Stop Buy Limit prices to two decimal places', () => {
      const stockWithOddPrice: Stock = {
        ...mockStock,
        currentPrice: 50.005,
      };

      render(
        <TradePanel
          stock={stockWithOddPrice}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="realLife"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      // Select Stop Buy Limit order
      fireEvent.click(screen.getByText('Billigst'));
      fireEvent.click(screen.getByText('Stop Buy Limit'));

      // Order: [0] = shares, [1] = stop price, [2] = limit price
      const stopInput = screen.getAllByRole('spinbutton')[1] as HTMLInputElement;
      const limitInput = screen.getAllByRole('spinbutton')[2] as HTMLInputElement;

      // Stop should be rounded to 50.01 (from 50.005)
      expect(parseFloat(stopInput.value)).toBe(50.01);
      // Limit should be stop + 0.01 = 50.02 (rounded)
      expect(parseFloat(limitInput.value)).toBe(50.02);
    });
  });

  describe('edit mode', () => {
    const mockBuyOrder: PendingOrder = {
      id: 'order-1',
      symbol: 'AAPL',
      type: 'buy',
      shares: 5,
      orderType: 'limit',
      limitPrice: 95,
      orderPrice: 100,
      remainingCycles: 8,
      timestamp: Date.now(),
    };

    const mockSellOrder: PendingOrder = {
      id: 'order-2',
      symbol: 'AAPL',
      type: 'sell',
      shares: 3,
      orderType: 'limit',
      limitPrice: 105,
      orderPrice: 100,
      remainingCycles: 5,
      timestamp: Date.now(),
    };

    it('should render edit mode title for buy order', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="realLife"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          editingOrder={mockBuyOrder}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      expect(screen.getByText('Bearbeiten: AAPL')).toBeInTheDocument();
    });

    it('should render edit mode title for sell order', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="sell"
          portfolio={mockPortfolio}
          gameMode="realLife"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          editingOrder={mockSellOrder}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      expect(screen.getByText('Bearbeiten: AAPL')).toBeInTheDocument();
    });

    it('should initialize with order shares', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="realLife"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          editingOrder={mockBuyOrder}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      // Find the shares input (should be initialized with order shares)
      const sharesInput = screen.getAllByRole('spinbutton').find(
        input => (input as HTMLInputElement).value === '5'
      );
      expect(sharesInput).toBeDefined();
    });

    it('should initialize with order limit price', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="realLife"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          editingOrder={mockBuyOrder}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      // Find the limit price input (should be initialized with order limit price)
      const limitInput = screen.getAllByRole('spinbutton').find(
        input => (input as HTMLInputElement).value === '95'
      );
      expect(limitInput).toBeDefined();
    });

    it('should show "Order aktualisieren" button text', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="realLife"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          editingOrder={mockBuyOrder}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      expect(screen.getByRole('button', { name: /Order aktualisieren/i })).toBeInTheDocument();
    });

    it('should enable button in edit mode even when isSymbolTradedThisCycle is true', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="realLife"
          isSymbolTradedThisCycle={true}
          reservedCash={0}
          reservedSharesForSymbol={0}
          editingOrder={mockBuyOrder}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      // Button should NOT be disabled in edit mode, even though isSymbolTradedThisCycle is true
      expect(screen.getByRole('button', { name: /Order aktualisieren/i })).not.toBeDisabled();
    });

    it('should allow editing when symbol was already traded this cycle (edit mode)', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="sell"
          portfolio={mockPortfolio}
          gameMode="realLife"
          isSymbolTradedThisCycle={true}
          reservedCash={0}
          reservedSharesForSymbol={0}
          editingOrder={mockSellOrder}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      // Button should be enabled
      expect(screen.getByRole('button', { name: /Order aktualisieren/i })).not.toBeDisabled();
    });

    it('should add back reserved cash from editing buy order to available cash', () => {
      // Portfolio has 1000 cash, 500 is reserved, but the order being edited reserved 500
      // So effective available should be 1000 - 500 + 500 = 1000
      const editingBuyOrder: PendingOrder = {
        ...mockBuyOrder,
        shares: 5,
        orderPrice: 100, // 5 * 100 = 500 reserved
      };

      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="realLife"
          isSymbolTradedThisCycle={false}
          reservedCash={500}
          reservedSharesForSymbol={0}
          editingOrder={editingBuyOrder}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      // Available should be full 1000 (1000 - 500 + 500)
      expect(screen.getByText(/Verfügbares Bargeld.*1\.000,00/)).toBeInTheDocument();
    });

    it('should add back reserved shares from editing sell order to available shares', () => {
      // Portfolio has 10 shares, 3 are reserved, but the order being edited reserved 3
      // So effective available should be 10 - 3 + 3 = 10
      const editingSellOrder: PendingOrder = {
        ...mockSellOrder,
        shares: 3,
      };

      render(
        <TradePanel
          stock={mockStock}
          tradeType="sell"
          portfolio={mockPortfolio}
          gameMode="realLife"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={3}
          editingOrder={editingSellOrder}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      // Available should be full 10 (10 - 3 + 3)
      expect(screen.getByText(/Verfügbare Aktien: 10/)).toBeInTheDocument();
    });

    it('should allow increasing shares when editing buy order (using released reserved cash)', () => {
      // Order reserved 500 (5 shares @ 100), total reservedCash is 500
      // So all available cash (1000) should be usable
      const editingBuyOrder: PendingOrder = {
        ...mockBuyOrder,
        shares: 5,
        orderPrice: 100,
      };

      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="realLife"
          isSymbolTradedThisCycle={false}
          reservedCash={500}
          reservedSharesForSymbol={0}
          editingOrder={editingBuyOrder}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      // Click Max - should allow buying with full 1000 available
      fireEvent.click(screen.getByText('Max'));
      // Order: [0] = shares (first element now)
      const sharesInput = screen.getAllByRole('spinbutton')[0] as HTMLInputElement;

      // Should be able to buy more than 5 shares
      expect(parseInt(sharesInput.value)).toBeGreaterThan(5);
    });

    it('should allow increasing shares when editing sell order (using released reserved shares)', () => {
      // Order reserved 3 shares, total reservedSharesForSymbol is 3
      // So all 10 shares should be available
      const editingSellOrder: PendingOrder = {
        ...mockSellOrder,
        shares: 3,
      };

      render(
        <TradePanel
          stock={mockStock}
          tradeType="sell"
          portfolio={mockPortfolio}
          gameMode="realLife"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={3}
          editingOrder={editingSellOrder}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      // Click Max - should allow selling all 10 shares
      fireEvent.click(screen.getByText('Max'));
      // Order: [0] = shares (first element now)
      const sharesInput = screen.getAllByRole('spinbutton')[0] as HTMLInputElement;

      expect(sharesInput.value).toBe('10');
    });

    it('should call onTrade with updated order data', () => {
      render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="realLife"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          editingOrder={mockBuyOrder}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      // Change shares
      // Order: [0] = shares (first element now)
      const sharesInput = screen.getAllByRole('spinbutton')[0];
      fireEvent.change(sharesInput, { target: { value: '7' } });

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /Order aktualisieren/i }));

      expect(mockOnTrade).toHaveBeenCalledWith(expect.objectContaining({
        symbol: 'AAPL',
        type: 'buy',
        shares: 7,
      }));
    });

    it('should have editing CSS class when in edit mode', () => {
      const { container } = render(
        <TradePanel
          stock={mockStock}
          tradeType="buy"
          portfolio={mockPortfolio}
          gameMode="realLife"
          isSymbolTradedThisCycle={false}
          reservedCash={0}
          reservedSharesForSymbol={0}
          editingOrder={mockBuyOrder}
          onClose={mockOnClose}
          onTrade={mockOnTrade}
        />
      );

      const panel = container.querySelector('.trade-panel');
      expect(panel).toHaveClass('trade-panel--editing');
    });
  });
});

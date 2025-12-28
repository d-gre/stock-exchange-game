# Stock Exchange Game

An interactive stock market game where you can trade stocks with virtual money.

## Features

- **Virtual Stock Trading**: Start with customizable starting capital (default: $100,000)
- **Real-time Price Updates**: Stock prices update every 10 seconds (adjustable in settings)
- **Candlestick Charts**: Visualize price movements with professional charts (powered by Lightweight Charts)
- **D-GREX Prime**: Market-cap weighted index of all 14 stocks (similar to DAX/S&P 500)
- **Portfolio Management**: Track your investments and profit/loss
- **Order History**: Complete record of all buys and sells with realized profit/loss
- **Risk Profile Analysis**: Automatic assessment of your trading style (comparable to virtual players)
- **Buy & Sell**: Trade various stocks like AAPL, GOOGL, MSFT and more
- **Various Order Types**: Market, Limit, Stop Buy, Stop Loss, Stop Buy Limit and Stop Loss Limit orders
- **Order Validity**: Orders can be configured with validity in rounds (default: 10 rounds)
- **Order Editing**: Open orders can be edited or cancelled
- **One Trade per Stock per Cycle**: Each stock can only be traded once per update cycle
- **Order Book with Reservations**: For delayed orders, cash/shares are reserved to prevent overdrafts
- **Automatic Pause**: The cycle pauses automatically when the trade panel is open and trading is possible
- **Virtual Players**: AI-controlled bots with variable starting capital (50%-200% of your starting capital) also trade and influence prices
- **Settings**: Update interval and number of virtual players (0-50) adjustable, pause function
- **Multilingual**: German, English, Japanese - Language setting is saved in browser
- **Theme**: Dark/Light Mode - Setting is saved in browser
- **Game Modes**: Different difficulty levels with varying trading costs
- **Market Warmup Phase**: At game start, 128 trading cycles are automatically simulated so charts already show realistic price movements

## Game Modes

> **Note**: The game mode selection is currently hidden. The game starts in "Real Life" mode.

The game offers three different modes:

| Mode | Description |
|------|-------------|
| **Real Life** | Realistic market conditions with fees and order delay. (Default) |
| **Hard Life** | Difficult mode with higher costs and challenges. |
| **Sandbox** | Free play with basic market mechanics. |

### Trading Mechanics per Game Mode

The game simulates realistic market conditions with various cost components:

| Mechanic | Sandbox | Real Life | Hard Life |
|----------|---------|-----------|-----------|
| **Spread** | 1% | 2% | 3% |
| **Slippage/Share** | 0.05% | 0.1% | 0.15% |
| **Max Slippage** | 5% | 10% | 15% |
| **Transaction Fee** | 0% | 0.5% (min. $1) | 1% (min. $2) |
| **Order Delay** | Instant | 1 Cycle | 1 Cycle |

#### Spread (Bid-Ask Spread)

The difference between buy and sell price. The buyer pays half the spread more, the seller receives half less. This prevents risk-free arbitrage through immediate buying and selling.

#### Slippage (Price Deviation)

Simulates market depth: The more shares traded in an order, the more the price moves during execution. The calculation is progressive - each additional share worsens the average price.

#### Transaction Fees

Fixed or percentage costs per trade (only in Real Life and Hard Life). The higher of the two fees (percent vs. minimum) always applies.

#### Order Delay

In harder modes, orders are not executed immediately but in the next update cycle. The effective price is calculated at execution time - the price can change until then.

## Order Types

The game supports various order types for advanced trading strategies:

| Order Type | Description |
|------------|-------------|
| **Market** | Immediate execution at current market price (in Sandbox mode) or delayed (Real Life/Hard Life). |
| **Limit** | Buy only when price ≤ limit, sell only when price ≥ limit. |
| **Stop Buy** | Buy is triggered when price ≥ stop price (for breakout strategies). |
| **Stop Loss** | Sell is triggered when price ≤ stop price (loss limitation). |
| **Stop Buy Limit** | Combination: At stop price, a limit buy order is activated. |
| **Stop Loss Limit** | Combination: At stop price, a limit sell order is activated. |

### Order Validity

Non-market orders have a configurable validity in rounds:
- **Default validity: 10 rounds** (adjustable when placing order)
- After validity expires, the order is automatically cancelled
- Reserved cash (for buy orders) or reserved shares (for sell orders) are released
- Remaining validity is shown in portfolio under "Open Orders"

### Stop Limit Validation

For Stop Limit orders, the price combination is validated to be sensible:
- **Stop Buy Limit**: Limit price must be higher than stop price
- **Stop Loss Limit**: Limit price must be lower than stop price

For invalid combinations, a warning is displayed and the order cannot be placed.

## Stock Split

The game automatically simulates **stock splits** as they occur with real companies (e.g., Apple, Tesla, NVIDIA).

### How It Works

- **Trigger**: When a stock price exceeds **$750**, a split is automatically performed
- **Split Ratio**: 3:1 (price is divided by three, number of shares is tripled)
- **Value Neutral**: The total value of the position remains unchanged

### Example

| Before | After (3:1 Split) |
|--------|-------------------|
| 10 shares × $900 = $9,000 | 30 shares × $300 = $9,000 |

### Effects

A split automatically adjusts:
- **Stock Price**: All historical price data (for correct charts)
- **Portfolio**: Number of held shares is tripled, average purchase price is divided by three
- **Open Orders**: Limit/stop prices and share quantities are adjusted

An **info notification** with details appears during a split.

### Why Splits?

In reality, companies perform splits to:
- Keep stock prices affordable for retail investors
- Increase liquidity
- Lower psychological buying barriers

In the game, splits prevent individual stocks from becoming disproportionately expensive and restricting trading.

## D-GREX Prime

The **D-GREX Prime** is a market-cap weighted stock index that reflects the performance of all 14 stocks in the game - similar to the DAX or S&P 500 in the real world.

### Calculation Method

The index uses **market cap weighting**:

```
Index = (Σ Stock Price × Market Cap) / (Σ Market Cap) × Divisor
```

- Stocks with higher market cap have more influence on the index
- Starting value is **10,000 points**
- Changes are calculated relative to the starting value

### Market Capitalizations

| Stock | Sector | Market Cap |
|-------|--------|------------|
| AAPL (Apple) | Tech | $3,000B |
| MSFT (Microsoft) | Tech | $3,000B |
| NVDA (NVIDIA) | Tech | $3,000B |
| GOOGL (Alphabet) | Tech | $2,000B |
| AMZN (Amazon) | Tech | $1,900B |
| META (Meta) | Tech | $1,400B |
| TSLA (Tesla) | Tech | $800B |
| JPM (JPMorgan Chase) | Finance | $600B |
| V (Visa) | Finance | $580B |
| BAC (Bank of America) | Finance | $280B |
| GS (Goldman Sachs) | Finance | $130B |
| CAT (Caterpillar) | Industrial | $150B |
| BA (Boeing) | Industrial | $150B |
| HON (Honeywell) | Industrial | $130B |

### Significance for the Game

- Large companies (AAPL, MSFT, NVDA) influence the index more strongly
- A +10% in NVDA has more impact than +10% in HON
- The index provides a realistic overview of overall market development

## Trading Info per Game Mode

In **Sandbox mode**, all trading costs are displayed transparently:
- Effective price per share (including spread and slippage)
- Breakdown of spread and slippage
- Exact total costs

In **Real Life** and **Hard Life** mode, the display is simplified (like a real banking app):
- Quantity × Price
- Estimated total costs (marked with "approx.")
- Note about possible price deviations

## Virtual Player AI

The virtual players use an intelligent trading strategy based on multiple factors.

### Starting Capital and Portfolio

Virtual players start with a random total wealth between **50% and 200%** of the player-chosen starting capital. With a starting capital of $100,000, virtual players have between $50,000 and $200,000.

Additionally, virtual players begin with **1-4 different stocks** in their portfolio:
- **30-70%** of starting capital is invested in stocks (depending on risk tolerance)
- Risk-seeking players invest more (40-70%), cautious ones less (30-50%)
- Stock selection and quantity is random

This ensures a balanced market from the start - prices can rise AND fall since both buyers and sellers are active from the beginning.

### Risk Tolerance

Each virtual player has a randomly assigned **risk tolerance** between -100 and +100:

| Value | Type | Behavior |
|-------|------|----------|
| -100 to -34 | Cautious | Prefers stable stocks, sells quickly on losses |
| -33 to +33 | Neutral | Balanced strategy |
| +34 to +100 | Risk-seeking | Buys volatile stocks, holds even with losses |

### Buy Decision

When buying, the AI analyzes:

1. **Volatility**: Standard deviation of price changes
   - Risk-seekers prefer volatile stocks (more profit potential)
   - Cautious players prefer stable stocks

2. **Trend**: Price change over last 5 candlesticks
   - Cautious only buy on uptrend
   - Risk-seekers also buy falling stocks ("Buy the dip")

3. **Score Calculation**: Combination of volatility, trend and risk tolerance (0-100)

### Sell Decision

When selling, the AI analyzes:

1. **Profit/Loss**: Percentage change from purchase price
2. **Trend**: Current price development
3. **Sell Score**: Sells when score >= 40

Behavioral differences:
- Cautious sell quickly on losses (stop-loss mentality)
- Risk-seekers hold even with losses but take profits

### Position Size

Risk tolerance determines how much is bought:

| Risk Tolerance | Purchase Amount |
|----------------|-----------------|
| -100 (cautious) | 15-25% of maximum possible |
| 0 (neutral) | 35-50% |
| +100 (risk-seeking) | 55-80% |

### Trading Frequency

- Cautious trade in 35% of rounds
- Risk-seekers trade in 75% of rounds

### Transparency

Each transaction saves the **decision factors**. In the UI, transactions can be clicked to see:
- Volatility and trend of the stock
- Calculated score
- Player type and reasoning

## Order History & Risk Profile

The order history provides a complete record of all player buys and sells.

### Features

- **Trade List**: All completed trades with timestamp, stock, quantity, price and realized profit/loss
- **Performance Chart**: Visualization of portfolio value and realized profit/loss over time
- **Statistics**: Total number of buys and sells with volume

### Risk Profile Analysis

Based on trading behavior, a **risk profile** is calculated (comparable to virtual players):

| Value | Category | Description |
|-------|----------|-------------|
| -100 to -34 | Conservative | Small positions, quick stop-losses, longer holding duration |
| -33 to +33 | Moderate | Balanced strategy between risk and safety |
| +34 to +100 | Aggressive | Large positions, high trading frequency, holds even with losses |

### Evaluation Factors

The risk assessment is based on:

1. **Position Size**: Larger positions relative to portfolio = higher risk
2. **Trading Frequency**: More trades = tends to higher risk
3. **Holding Duration**: Shorter holding duration (day trading) = higher risk
4. **Loss Acceptance**: Holding with losses vs. quick stop-losses

### Statistics

- **Win/Loss Ratio**: Ratio of winning trades to losing trades
- **Average Win**: Mean of profits on successful trades
- **Average Loss**: Mean of losses on losing trades
- **Total Realized Profit/Loss**: Sum of all realized profits and losses

## Tech Stack

- **React 19** - UI Framework
- **TypeScript** - Type Safety
- **Vite 7** - Build Tool & Dev Server
- **Vitest** - Unit Testing
- **Redux Toolkit** - State Management
- **Lightweight Charts** - Candlestick Charts
- **react-i18next** - Internationalization (DE, EN, JP)

## Project Structure

```
src/
├── components/                 # React Components
│   ├── AppControlPanel.tsx     # App controls and virtual players
│   ├── CandlestickChart.tsx    # Candlestick/line chart (Lightweight Charts)
│   ├── ChartPanel.tsx          # Chart panel with stock tabs and mini trends
│   ├── MultiStockChart.tsx     # Multi-chart view for all owned stocks
│   ├── NotificationToast.tsx   # Toast notifications (warnings, errors)
│   ├── Portfolio.tsx           # Portfolio display with holdings and open orders
│   ├── SettingsModal.tsx       # Settings dialog (interval, player count)
│   ├── GameStart.tsx           # Start screen with starting capital input and warmup
│   ├── StockList.tsx           # List of all stocks with buy/sell buttons
│   ├── TradeHistory.tsx        # Order history with risk profile analysis
│   ├── TradeHistoryChart.tsx   # Performance chart for order history
│   └── TradePanel.tsx          # Buy/sell panel with order types
├── config/
│   └── index.ts                # App configuration (game modes, trading mechanics)
├── hooks/                      # Custom React Hooks
│   ├── useGameCycle.ts         # Game cycle logic (countdown, speed, pause)
│   ├── useTheme.ts             # Dark/Light theme management
│   └── useTrading.ts           # Trading logic (buy, sell, order management)
├── i18n/                       # Internationalization
│   ├── index.ts                # i18n configuration (react-i18next)
│   ├── de.json                 # German translations
│   ├── en.json                 # English translations
│   └── ja.json                 # Japanese translations
├── store/                      # Redux Store (Redux Toolkit)
│   ├── index.ts                # Store configuration
│   ├── hooks.ts                # Typed Redux hooks (useAppDispatch, useAppSelector)
│   ├── notificationsSlice.ts   # Notification state (warnings for failed orders)
│   ├── pendingOrdersSlice.ts   # Pending orders, reservations, order execution logic
│   ├── portfolioSlice.ts       # Portfolio state (cash, holdings)
│   ├── settingsSlice.ts        # Settings state (interval, pause, game mode)
│   ├── stocksSlice.ts          # Stock state (prices, price history)
│   ├── tradeHistorySlice.ts    # Order history (trades, risk profile)
│   ├── uiSlice.ts              # UI state (selection, modals, tabs)
│   └── virtualPlayersSlice.ts  # Virtual player state and AI trades
├── test/
│   └── setup.ts                # Vitest test setup
├── utils/
│   ├── chartUtils.ts           # Shared chart configuration (Lightweight Charts)
│   ├── indexCalculation.ts     # D-GREX Prime index (market-cap weighted)
│   ├── stockData.ts            # Stock initialization and price logic
│   ├── tradingMechanics.ts     # Trading mechanics (spread, slippage, fees)
│   └── virtualPlayers.ts       # AI player logic (volatility, trend, scoring)
├── types.ts                    # TypeScript types (Stock, Portfolio, Order, etc.)
├── App.tsx                     # Main app component
├── App.css                     # Main styling
├── index.css                   # Global styles
└── main.tsx                    # React entry point
```

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

### Bundle Size

The production bundle is ~570 KB (uncompressed) or ~176 KB (gzip) due to the combination of React, Redux Toolkit, i18next and Lightweight Charts. Since the app is a single-page application without routing, code splitting was omitted. The `chunkSizeWarningLimit` in `vite.config.ts` is set to 600 KB accordingly.

## Tests

```bash
# Run once
npm run test:run

# Watch mode
npm run test
```

## Preview

```bash
npm run preview
```

## Deployment

1. Copy `.env.example` to `.env` and enter SFTP credentials:
   ```bash
   cp .env.example .env
   ```

2. Deploy (builds and uploads via SFTP):
   ```bash
   npm run deploy
   ```

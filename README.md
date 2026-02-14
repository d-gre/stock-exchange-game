# Stock Exchange Game

An interactive stock market game where you can trade stocks with virtual money.

## Features

- **Virtual Stock Trading**: Start with customizable starting capital (default: $100,000)
- **Real-time Price Updates**: Stock prices update every 10 seconds (adjustable in settings)
- **Candlestick Charts**: Visualize price movements with professional charts (powered by Lightweight Charts)
- **D-GREX Prime**: Market-cap weighted index of all 16 stocks (similar to DAX/S&P 500)
- **Sector System**: 16 stocks grouped into 4 sectors (Tech, Finance, Industrial, Commodities) with realistic correlations
- **Portfolio Management**: Track your investments and profit/loss
- **Order History**: Complete record of all buys and sells with realized profit/loss
- **Risk Profile Analysis**: Automatic assessment of your trading style (comparable to virtual players)
- **Buy & Sell**: Trade various stocks like AAPL, GOOGL, MSFT and more
- **Various Order Types**: Market, Limit, Stop Buy, Stop Loss, Stop Buy Limit and Stop Loss Limit orders
- **Order Validity**: Orders can be configured with validity in rounds (default: 10 rounds)
- **Order Editing**: Open orders can be edited or canceled
- **One Trade per Stock per Cycle**: Each stock can only be traded once per update cycle
- **Order Book with Reservations**: For delayed orders, cash/shares are reserved to prevent overdrafts
- **Automatic Pause**: The cycle pauses automatically when the trade panel is open and trading is possible
- **Virtual Players**: AI-controlled bots with variable starting capital (50%-200% of your starting capital) also trade and influence prices
- **Save & Load Game**: Save your progress to browser storage and continue later
- **Settings Sidebar**: Quick access to all settings via slide-out sidebar
- **Settings**: Update interval and number of virtual players (0-50) adjustable, pause function
- **Multilingual**: German, English, Japanese - Language setting is saved in browser
- **Theme**: Dark/Light Mode - Setting is saved in browser
- **Game Modes**: Different difficulty levels with varying trading costs
- **Timed Game Mode**: Optional time limit (5, 10, 20, or 30 minutes) with end-game ranking against virtual players
- **Market Warmup Phase**: At game start, 128 trading cycles are automatically simulated so charts already show realistic price movements
- **Economic Climate**: Dynamic market phases (Bull, Bear, Stagnation, Crash) per sector with Fear & Greed sentiment index
- **Short Selling**: Open short positions with margin requirements and borrowing fees
- **Order Book**: Realistic bid/ask order book with price-time priority matching
- **Stock Float**: Dynamic float shares affecting stock liquidity

## Game Modes

> **Note**: The game mode selection is currently hidden. The game starts in "Real Life" mode.

The game offers two different modes:

| Mode          | Description                                                      |
|---------------|------------------------------------------------------------------|
| **Real Life** | Realistic market conditions with fees and order delay. (Default) |
| **Hard Life** | Difficult mode with higher costs and challenges.                 |

### Trading Mechanics per Game Mode

The game simulates realistic market conditions with various cost components:

| Mechanic             | Real Life        | Hard Life       |
|----------------------|------------------|-----------------|
| **Spread**           | 2%               | 3%              |
| **Slippage/Share**   | 0.1%             | 0.15%           |
| **Max Slippage**     | 10%              | 15%             |
| **Transaction Fee**  | 0.5% (min. $1)   | 1% (min. $2)    |
| **Order Delay**      | 1 Cycle          | 1 Cycle         |

#### Spread (Bid-Ask Spread)

The difference between buy and sell price. The buyer pays half the spread more, the seller receives half less. This prevents risk-free arbitrage through immediate buying and selling.

#### Slippage (Price Deviation)

Simulates market depth: The more shares traded in an order, the more the price moves during execution. The calculation is progressive - each additional share worsens the average price.

#### Transaction Fees

Fixed or percentage costs per trade (only in Real Life and Hard Life). The higher of the two fees (percent vs. minimum) always applies.

#### Order Delay

In harder modes, orders are not executed immediately but in the next update cycle. The effective price is calculated at execution time - the price can change until then.

## Timed Game Mode

The game supports an optional time limit that creates a competitive experience against virtual players.

### Duration Options

| Option       | Rounds | Approx. Duration |
|--------------|--------|------------------|
| Quick Game   | 60     | ~5 minutes       |
| Short Game   | 120    | ~10 minutes      |
| Medium Game  | 240    | ~20 minutes      |
| Long Game    | 360    | ~30 minutes      |
| Unlimited    | ∞      | No time limit    |

### Game End Evaluation

When a timed game ends, players are ranked by **net worth** (cash + stock value - debt). The end-game modal displays:

1. **Your Result**: Final ranking, net worth, profit/loss, and risk profile
2. **D-GREX Ranking**: Leaderboard showing top 3 players, bottom 3 players, and your position (if not in top/bottom)

### Risk Profile Assessment

At game end, each player's trading behavior is assessed and classified:

| Profile      | Characteristics                                                |
|--------------|----------------------------------------------------------------|
| Conservative | Low trade frequency, diversified portfolio, minimal loan usage |
| Moderate     | Balanced trading approach                                      |
| Aggressive   | High trade frequency, concentrated positions, heavy loan usage |

The assessment considers:
- **Trade frequency**: Trades per cycle
- **Portfolio diversification**: Number of different stocks held
- **Loan utilization**: Debt relative to net worth
- **Position concentration**: Largest holding as percentage of portfolio

## Save & Load Game

The game supports saving and loading game progress to browser storage (localStorage).

### Saving

- Click the **Settings** button (gear icon) in the control panel
- Click **Save Game** to save your current progress
- A confirmation toast appears when saving is successful
- The save includes: stocks, portfolio, loans, pending orders, virtual players, trade history, and all settings

### Loading

- When a saved game exists, the **Load Game** button appears in the settings sidebar
- Loading restores all game state exactly as it was when saved
- The game time continues from where you left off

### New Game vs. Continue

On the start screen:
- **Continue Game**: Only appears when a saved game exists - resumes your saved progress
- **New Game**: Starts a fresh game (overwrites any existing save when you save again)

### Storage

Game data is stored in browser localStorage under the key `stock-exchange-game-save`. Starting a new game clears any existing save.

## Order Types

The game supports various order types for advanced trading strategies:

| Order Type          | Description                                                         |
|---------------------|---------------------------------------------------------------------|
| **Market**          | Execution at current market price, delayed by 1 cycle.              |
| **Limit**           | Buy only when price ≤ limit, sell only when price ≥ limit.          |
| **Stop Buy**        | Buy is triggered when price ≥ stop price (for breakout strategies). |
| **Stop Loss**       | Sell is triggered when price ≤ stop price (loss limitation).        |
| **Stop Buy Limit**  | Combination: At stop price, a limit buy order is activated.         |
| **Stop Loss Limit** | Combination: At stop price, a limit sell order is activated.        |

### Order Validity

Non-market orders have a configurable validity in rounds:
- **Default validity: 10 rounds** (adjustable when placing order)
- After validity expires, the order is automatically canceled
- Reserved cash (for buy orders) or reserved shares (for sale orders) are released
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

| Before                    | After (3:1 Split)         |
|---------------------------|---------------------------|
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

## Sector System

The game features a realistic sector system with **16 stocks grouped into 4 sectors**. Stocks within the same sector tend to move together, and different sectors influence each other based on economic relationships.

### Sectors and Stocks

| Sector          | Stocks                  | Description                           |
|-----------------|-------------------------|---------------------------------------|
| **Technology**  | AAPL, MSFT, NVDA, GOOGL | Software, hardware, cloud computing   |
| **Finance**     | V, BAC, JPM, GS         | Banks, payment processing, investment |
| **Industrial**  | BA, EADSY, TSLA, HON    | Aerospace, automotive, manufacturing  |
| **Commodities** | XOM, BHP, BAYN, NEM     | Oil, mining, chemicals, gold          |

### Sector Correlations

Sectors influence each other based on realistic economic relationships:

| When...                | ...effect on                               |
|------------------------|--------------------------------------------|
| Tech ↑                 | Finance slightly ↑ (investment activity)   |
| Finance ↑              | Tech ↑, Industrial ↑ (credit availability) |
| Industrial ↑           | Commodities ↑ (demand for raw materials)   |
| Commodities strongly ↑ | Industrial ↓ (high input costs)            |

### Sector Momentum

Each sector builds momentum over time based on stock performance:
- Strong performance in one sector increases its momentum
- Momentum affects future price movements of stocks in that sector
- Momentum decays gradually over time (mean reversion)
- Maximum sector influence on prices is capped at ±3%

### UI Display

The stock list shows a **sector tag** for each stock:
- **T** (blue) - Technology
- **F** (green) - Finance
- **I** (orange) - Industrial
- **R** (purple) - Commodities (Raw materials)

Click on the column headers to sort by any field including sector.

## D-GREX Prime

The **D-GREX Prime** is a market-cap weighted stock index that reflects the performance of all 16 stocks in the game - similar to the DAX or S&P 500 in the real world.

### Calculation Method

The index uses **market cap weighting**:

```
Index = (Σ Stock Price × Market Cap) / (Σ Market Cap) × Divisor
```

- Stocks with higher market cap have more influence on the index
- Starting value is **10,000 points**
- Changes are calculated relative to the starting value

### Market Capitalization

| Stock                 | Sector      | Market Cap |
|-----------------------|-------------|------------|
| AAPL (Apple)          | Tech        | $3,000B    |
| MSFT (Microsoft)      | Tech        | $3,000B    |
| NVDA (NVIDIA)         | Tech        | $3,000B    |
| GOOGL (Alphabet)      | Tech        | $2,000B    |
| TSLA (Tesla)          | Industrial  | $800B      |
| JPM (JPMorgan Chase)  | Finance     | $600B      |
| V (Visa)              | Finance     | $580B      |
| XOM (Exxon Mobil)     | Commodities | $450B      |
| BAC (Bank of America) | Finance     | $280B      |
| BA (Boeing)           | Industrial  | $150B      |
| BHP (BHP Group)       | Commodities | $150B      |
| GS (Goldman Sachs)    | Finance     | $130B      |
| EADSY (Airbus)        | Industrial  | $130B      |
| HON (Honeywell)       | Industrial  | $130B      |
| BAYN (Bayer AG)       | Commodities | $50B       |
| NEM (Newmont Corp.)   | Commodities | $45B       |

### Significance for the Game

- Large companies (AAPL, MSFT, NVDA) influence the index more strongly
- A +10% in NVDA has more impact than +10% in NEM
- The index provides a realistic overview of overall market development
- Sector movements can cause correlated index changes

## Sector Indices

In addition to the main D-GREX Prime index, the game features **four sector-specific indices** that track the performance of each industry sector:

| Index            | Sector      | Stocks                  |
|------------------|-------------|-------------------------|
| **D-GREX Tek**   | Technology  | AAPL, MSFT, NVDA, GOOGL |
| **D-GREX Fin**   | Finance     | V, BAC, JPM, GS         |
| **D-GREX Ind**   | Industrial  | BA, EADSY, TSLA, HON    |
| **D-GREX Raw**   | Commodities | XOM, BHP, BAYN, NEM     |

### Calculation

Each sector index uses the same **market-cap weighted** calculation as D-GREX Prime, but only considers stocks within that sector:

```
Sector Index = (Σ Stock Price × Market Cap) / (Σ Market Cap) × Divisor
```

All sector indices start at **10,000 points**.

### UI Display

The indices are shown in the **Market Index** tab:
- **D-GREX Prime** at the top with a full-width chart
- **Four sector indices** in a responsive 2-column grid below
- Each index shows: current value, percentage change, and 5-candle mini trend
- Sector index headers and chart lines use **matching colors**:
  - Technology: Blue (#3b82f6)
  - Finance: Green (#10b981)
  - Industrial: Orange (#f59e0b)
  - Commodities: Purple (#8b5cf6)

### Strategic Value

Sector indices help identify:
- **Sector rotation**: Which industries are currently leading or lagging
- **Correlation patterns**: How sectors move relative to each other
- **Entry/exit timing**: When a sector builds momentum, individual stocks may follow
- **Diversification**: Spreading investments across sectors with different performance

## Trading Info Display

The trade panel displays trading costs in a simplified format (like a real banking app):
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

| Value        | Type         | Behavior                                       |
|--------------|--------------|------------------------------------------------|
| -100 to -34  | Cautious     | Prefers stable stocks, sells quickly on losses |
| -33 to +33   | Neutral      | Balanced strategy                              |
| +34 to +100  | Risk-seeking | Buys volatile stocks, holds even with losses   |

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

| Risk Tolerance       | Purchase Amount            |
|----------------------|----------------------------|
| -100 (cautious)      | 15-25% of maximum possible |
| 0 (neutral)          | 35-50%                     |
| +100 (risk-seeking)  | 55-80%                     |

### Trading Frequency

- Cautious trade in 35% of rounds
- Risk-seekers trade in 75% of rounds

### Market Impact

When virtual players (or the human player) trade, the stock price is affected:

| Parameter         | Value                   |
|-------------------|-------------------------|
| Base Impact       | 0.01% - 0.05% per share |
| Volume Multiplier | max 20 shares           |
| Circuit Breaker   | max ±2% per trade       |

This prevents unrealistic price explosions during the warmup phase while still creating dynamic market movements. The circuit breaker ensures that even large trades cannot move a stock price by more than 2% in a single transaction.

## Market Maker System

The game features a Market Maker system that simulates realistic stock availability and dynamic spreads.

### How It Works

The Market Maker (MM) acts as an invisible counterparty for all trades:
- **Player buys** → MM sells from inventory → inventory decreases
- **Player sells** → MM buys into inventory → inventory increases
- **Low inventory** → higher spread (stock becomes "scarcer")
- **High inventory** → lower spread (MM wants to sell off)

### Configuration

| Parameter             | Value   | Description                    |
|-----------------------|---------|--------------------------------|
| Base Inventory        | 100,000 | Shares per stock symbol        |
| Min Threshold         | 10%     | Inventory level for max spread |
| Max Threshold         | 190%    | Inventory level for min spread |
| Min Spread Multiplier | 0.5x    | At 190%+ inventory             |
| Max Spread Multiplier | 3x      | At 10% or less inventory       |
| Rebalance Rate        | 1%      | Inventory recovery per cycle   |

### Spread Calculation

The spread multiplier is calculated based on inventory level:

| Inventory Level | Spread Multiplier | Effect                    |
|-----------------|-------------------|---------------------------|
| ≤10%            | 3.0x              | Maximum spread (scarcity) |
| 50%             | ~2.0x             | High spread               |
| 100%            | 1.0x              | Normal spread             |
| 150%            | ~0.75x            | Lower spread              |
| ≥190%           | 0.5x              | Minimum spread (excess)   |

### UI Display

The Market Maker inventory is visible in the **App Control Panel** (footer):
- **Inventory bar** per stock with color-coded level:
  - 🟢 Green (80-120%): Normal inventory
  - 🟡 Yellow (50-80%): Low inventory
  - 🔴 Red (<50%): Critical inventory
  - 🔵 Blue (>120%): Excess inventory
- **Spread modifier** showing current additional spread percentage
- **Tooltips** on hover explaining the values
- Click to expand/collapse the Market Maker section

### Virtual Player Integration

Virtual player trades also affect the Market Maker inventory, but with **50% reduced impact** compared to player trades. This creates a more stable market while still simulating realistic supply and demand dynamics.

### Rebalancing

Each game cycle, the Market Maker inventory slowly moves back towards the base level at the configured rebalance rate (1% per cycle). This prevents extreme inventory imbalances from persisting indefinitely.

### Transparency

Each transaction saves the **decision factors**. In the UI, transactions can be clicked to see:
- Volatility and trend of the stock
- Calculated score
- Player type and reasoning

### Virtual Player Loans

Virtual players can take and repay loans using the same mechanics as the human player - no cheating!

**Taking Loans:**
- Risk tolerance affects loan probability:
  - Cautious players (≤-34): 5% chance to consider a loan
  - Neutral players (-33 to +33): 15% chance
  - Risk-seeking players (≥34): 35% chance
- Loan amount based on risk tolerance (20-60% of available credit)
- Interest rates calculated the same way as player loans
- Maximum 3 loans per virtual player

**Repaying Loans:**
- Cautious players (30% base chance) prefer to be debt-free
- Risk-seeking players (8% base chance) are comfortable with leverage
- High debt-to-asset ratio increases repayment probability
- Highest interest rate loan is repaid first

**UI Display:**
- Virtual player debt is shown in the player card header
- Displayed in orange below the cash amount (only when debt > 0)

**Configuration:**
- VP loans can be disabled via `virtualPlayerLoansEnabled` in config

## Order History & Risk Profile

The order history provides a complete record of all player buys and sells.

### Features

- **Trade List**: All completed trades with timestamp, stock, quantity, price and realized profit/loss
- **Performance Chart**: Visualization of portfolio value and realized profit/loss over time
- **Statistics**: Total number of buys and sells with volume

### Risk Profile Analysis

Based on trading behavior, a **risk profile** is calculated (comparable to virtual players):

| Value       | Category     | Description                                                      |
|-------------|--------------|------------------------------------------------------------------|
| -100 to -34 | Conservative | Small positions, quick stop-losses, longer holding duration      |
| -33 to +33  | Moderate     | Balanced strategy between risk and safety                        |
| +34 to +100 | Aggressive   | Large positions, high trading frequency, holds even with losses  |

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

## Credit System (Loans)

The game features a credit system that allows players to borrow money against their portfolio to increase buying power.

### Credit Line

Your credit line is calculated from your stock holdings. **Cash does NOT count as collateral!**

| Asset Type                | Collateral Value |
|---------------------------|------------------|
| Large-Cap Stocks (>$200B) | 70%              |
| Small-Cap Stocks (≤$200B) | 50%              |

The **recommended credit line** is your total collateral rounded down to the nearest $1,000. The **maximum credit line** is **2.5×** the recommended amount.

**Example**: With $5,000 in AAPL (large-cap) and $3,000 in a small-cap stock:
- Collateral = $5,000 × 70% + $3,000 × 50% = $5,000
- Recommended Credit Line = floor($5,000 / $1,000) × $1,000 = $5,000
- Maximum Credit Line = $5,000 × 2.5 = $12,500

### Multiple Loans

You can have up to **3 loans** at the same time. Each additional loan increases your interest rate:

| Loan #   | Interest Rate Adjustment |
|----------|--------------------------|
| 1st loan | No penalty               |
| 2nd loan | +1%                      |
| 3rd loan | +2%                      |

### Interest Rates

Interest is charged every **20 trading cycles** with a base rate of **6%**. The effective rate is adjusted by:

| Factor                     | Adjustment                      |
|----------------------------|---------------------------------|
| Conservative trading style | -1%                             |
| Aggressive trading style   | +2%                             |
| Realized loss >$5,000      | +1% per $1,000 excess (max +3%) |
| 50%+ utilization           | +1%                             |
| 75%+ utilization           | +3%                             |
| 100% utilization           | +6%                             |
| Per additional loan        | +1%                             |

**Note**: Profits do NOT reduce the interest rate. Only significant realized losses (>$5,000) increase the rate.

### Origination Fee

A one-time fee of **1.5%** is deducted from each loan amount upon disbursement.

### Repayment Fee

A **0.5%** repayment fee is charged when repaying loans. This is calculated on the principal being repaid.

### Repayment

Loans can be repaid partially or fully at any time. The repay button is available next to each loan in the portfolio panel.

### Buying with Credit

When you own stocks (collateral), the trade panel shows your available credit line below your cash balance. You can buy stocks that exceed your cash balance by using credit:

1. **Max Button**: Calculates the maximum buyable shares including available credit
2. **Credit Warning**: When a purchase requires a loan, details are shown above the breakdown:
   - Loan amount needed
   - Interest rate (locked at order creation)
   - Origination fee
3. **Button Label**: Changes to "Kredit aufnehmen und kaufen" when a loan is required
4. **Pending Orders**: Orders with loan requests count toward the 3-loan limit

For **Market Orders** and **Stop Orders**, a **5% cash buffer** is applied to the Max button calculation. This accounts for price fluctuations between order placement and execution.

**Important**: The interest rate is **locked at order creation time**. Even if your risk profile changes before the order executes, the original rate applies.

### Loan Orders in Portfolio

Pending orders that require a loan are marked in the portfolio with:
- **Kredit: $5.000,00 @ 8,50%** - showing the loan amount and locked interest rate

When the order executes, the loan is automatically taken before the stock purchase.

### Documentation

For detailed calculations and examples, see `tmp/loans.md`.

## Tech Stack

- **React 19** - UI Framework
- **TypeScript** - Type Safety
- **Vite 7** - Build Tool & Dev Server
- **Vitest** - Unit Testing
- **Redux Toolkit** - State Management
- **Lightweight Charts** - Candlestick Charts
- **react-i18next** - Internationalization (DE, EN, JA)

## Project Structure

```
src/
├── components/                 # React Components
│   ├── AppControlPanel.tsx     # App controls (timer, pause, speed, settings)
│   ├── AppHeader.tsx           # App header with logo, title and mobile buttons
│   ├── CandlestickChart.tsx    # Candlestick/line chart (Lightweight Charts)
│   ├── ChartPanel.tsx          # Chart panel with index/stock tabs
│   ├── CircularTimer.tsx       # Circular countdown timer with progress ring
│   ├── ClimateHistoryChart.tsx # Fear & Greed index history line chart
│   ├── DebugModal.tsx          # Debug output modal with copy-to-clipboard (Alt+D)
│   ├── EconomicClimate.tsx     # Market phase and Fear & Greed sentiment display
│   ├── GameEnd.tsx             # End-game modal with ranking and results
│   ├── GameStart.tsx           # Start screen with starting capital and warmup
│   ├── Help.tsx                # Help dialog explaining game mechanics
│   ├── Icons.tsx               # Shared icon components (SVG icons)
│   ├── Loan.tsx                # Loan detail component for individual loans
│   ├── LoanInfoDetails.tsx     # Expandable loan conditions and interest breakdown
│   ├── LoansList.tsx           # Loans list in portfolio panel
│   ├── Logo.tsx                # SVG stock exchange logo component
│   ├── MarketMakerInventory.tsx # Market Maker inventory levels and spreads
│   ├── MultiStockChart.tsx     # Multi-chart view for all owned stocks
│   ├── NotificationToast.tsx   # Toast notifications (warnings, errors)
│   ├── Portfolio.tsx           # Portfolio with holdings and order book
│   ├── PortfolioAssets.tsx     # Portfolio holdings with profit/loss display
│   ├── PortfolioOrders.tsx     # Pending orders with edit/cancel actions
│   ├── PortfolioShorts.tsx     # Short positions with P&L and margin info
│   ├── PortfolioSummary.tsx    # Portfolio summary (cash, value, credit)
│   ├── SettingsSidebar.tsx     # Settings sidebar (interval, player count, save/load)
│   ├── StockList.tsx           # Stock list with sorting and sector tags
│   ├── TradeHistory.tsx        # Order history with risk profile analysis
│   ├── TradeHistoryChart.tsx   # Performance chart for order history
│   ├── TradePanel.tsx          # Buy/sell panel with order types
│   ├── VirtualPlayersList.tsx  # Virtual players with portfolios and trades
│   └── VirtualPlayersPanel.tsx # Collapsible panel wrapping virtual players list
├── config/
│   └── index.ts                # App configuration (game modes, trading mechanics)
├── hooks/                      # Custom React Hooks
│   ├── useClickOutside.ts      # Click outside detection for dropdowns
│   ├── useDebugMarketOverview.ts # Debug hook for market overview (Alt+M)
│   ├── useDebugOutput.ts       # Debug hook for portfolio state JSON (Alt+D)
│   ├── useEndScreenPreview.ts  # Preview end-game standings without ending (Alt+R)
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
│   ├── hooks.ts                # Typed Redux hooks (useAppDispatch, useAppSelector, useAppStore)
│   ├── floatSlice.ts           # Stock float shares calculations and state
│   ├── gameSessionSlice.ts     # Game session state (duration, cycles, end-game stats)
│   ├── loansSlice.ts           # Loans state (credit line, interest)
│   ├── marketMakerSlice.ts     # Market Maker inventory and spread multipliers
│   ├── marketPhaseSlice.ts     # Market phases per sector with climate history
│   ├── notificationsSlice.ts   # Notification state (warnings for failed orders)
│   ├── orderBookSlice.ts       # Bid/ask order books with sorted insertion
│   ├── pendingOrdersSlice.ts   # Pending orders, reservations, order execution logic
│   ├── portfolioSlice.ts       # Portfolio state (cash, holdings)
│   ├── sectorSlice.ts          # Sector momentum state and influences
│   ├── settingsSlice.ts        # Settings state (interval, pause, game mode)
│   ├── shortPositionsSlice.ts  # Short positions, margin calls, borrowing fees
│   ├── stocksSlice.ts          # Stock state (prices, price history)
│   ├── tradeHistorySlice.ts    # Order history (trades, risk profile)
│   ├── uiSlice.ts              # UI state (selection, modals, tabs)
│   └── virtualPlayersSlice.ts  # Virtual player state and AI trades
├── styles/                     # CSS Stylesheets (BEM methodology, one file per component)
├── test/
│   └── setup.ts                # Vitest test setup
├── utils/
│   ├── chartUtils.ts           # Shared chart configuration (Lightweight Charts)
│   ├── formatting.ts           # Currency and number formatting utilities
│   ├── gameSave.ts             # Save/load game state to localStorage
│   ├── indexCalculation.ts     # D-GREX Prime and sector indices
│   ├── marketPhaseLogic.ts     # Phase transitions, crash mechanics, Fear & Greed
│   ├── orderMatching.ts        # Bid/ask matching with price-time priority
│   ├── sectorCorrelation.ts    # Sector momentum and inter-sector correlations
│   ├── stockData.ts            # Stock initialization and price logic
│   ├── traderStrategies.ts     # Virtual player trading decisions and risk assessment
│   ├── tradingMechanics.ts     # Trading mechanics (spread, slippage, fees)
│   └── virtualPlayers.ts       # AI player logic (volatility, trend, scoring)
├── types.ts                    # TypeScript types (Stock, Portfolio, Order, etc.)
├── App.tsx                     # Main app component
├── App.css                     # Main styling (imports all partials)
├── index.css                   # Global styles and CSS variables
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

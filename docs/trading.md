# Trading Mechanics

This document describes the trading system, order types, costs, and short selling mechanics.

## Table of Contents

1. [Terminology](#terminology)
2. [Order Types](#order-types)
3. [Trading Costs](#trading-costs)
4. [Short Selling](#short-selling)
5. [Configuration Reference](#configuration-reference)

> **Note**: Market Maker mechanics are documented in [Economy & Market Mechanics](economy.md).

---

## Terminology

| Term                   | Description                                                                                                       |
|------------------------|-------------------------------------------------------------------------------------------------------------------|
| **Market Order**       | Order executed at current price after a delay                                                                     |
| **Limit Order**        | Order executed only when price reaches specified limit                                                            |
| **Stop Order**         | Order triggered when price crosses a threshold                                                                    |
| **Spread**             | Difference between buy price (ask) and sell price (bid)                                                           |
| **Slippage**           | Price impact caused by order size affecting the market                                                            |
| **Short Selling**      | Selling borrowed shares to profit from price decline                                                              |
| **Margin**             | Collateral required to open and maintain a short position                                                         |
| **Initial Margin**     | Collateral required when opening a short position (150% of position value)                                        |
| **Maintenance Margin** | Minimum collateral during the position's lifetime (125% of position value) - falling below triggers a margin call |
| **Margin Call**        | Demand to deposit additional collateral when falling below maintenance margin                                     |
| **Buy to Cover**       | Purchasing shares to close a short position                                                                       |
| **Float**              | Total shares available for trading of a stock                                                                     |
| **Short Interest**     | Total shorted shares of a stock across all players                                                                |
| **Borrow Fee**         | Fee charged per cycle for borrowed shares                                                                         |
| **Total Exposure**     | Current market value of all short positions (shares × current price)                                              |
| **Locked Collateral**  | Sum of all margin deposits held for short positions                                                               |

---

## Order Types

### Overview

| Order Type          | Trigger Condition                            | Use Case                         |
|---------------------|----------------------------------------------|----------------------------------|
| **Market**          | After 1 cycle delay                          | Quick execution at current price |
| **Limit**           | Price reaches limit                          | Buy low / Sell high              |
| **Stop Buy**        | Price >= stop price                          | Buy on breakout above resistance |
| **Stop Loss**       | Price <= stop price                          | Sell on breakdown below support  |
| **Stop Buy Limit**  | Two-stage: Stop triggers, then limit checked | Precise entry after breakout     |
| **Stop Loss Limit** | Two-stage: Stop triggers, then limit checked | Precise exit with price floor    |
| **Short Sell**      | After 1 cycle delay                          | Profit from price decline        |
| **Buy to Cover**    | After 1 cycle delay                          | Close a short position           |

### Market Orders

- Execute after **1 cycle delay** (creation cycle doesn't count)
- No price guarantee - executed at current market price
- System reserves **5% cash buffer** for potential price changes

### Limit Orders

- **Buy Limit**: Executes when price <= limit price
- **Sell Limit**: Executes when price >= limit price
- Default validity: **10 cycles**, then automatically cancelled

### Stop Orders

- **Stop Buy**: Triggers when price rises to or above stop price
- **Stop Loss**: Triggers when price falls to or below stop price
- Once triggered, executes as market order

### Stop Limit Orders (Two-Stage)

1. **Stage 1**: Stop condition triggers the order
2. **Stage 2**: Limit condition must be met for execution

**Stop Buy Limit Example**:
- Stop: $55, Limit: $57
- Stock rises from $50 to $56 → Stop triggers
- Next cycle: Executes only if price <= $57

**Stop Loss Limit Example**:
- Stop: $45, Limit: $43
- Stock falls from $50 to $44 → Stop triggers
- Next cycle: Executes only if price >= $43

---

## Trading Costs

### Game Modes

| Parameter          | Real Life Mode | Hard Life Mode |
|--------------------|----------------|----------------|
| Spread             | 2%             | 3%             |
| Slippage per share | 0.1%           | 0.15%          |
| Maximum slippage   | 10%            | 15%            |
| Transaction fee    | 0.5%           | 1%             |
| Minimum fee        | $1             | $2             |
| Order delay        | 1 cycle        | 1 cycle        |

### Spread Calculation

The spread represents the cost of trading with the market maker.

```
Spread Cost = Price × (Spread% × Spread Multiplier) / 2
```

- **Buyers** pay the spread (higher effective price)
- **Sellers** receive less (lower effective price)
- Spread multiplier varies from 0.5x to 3.0x based on market maker inventory

### Slippage Calculation

Slippage simulates market depth - larger orders have progressively more impact.

```
Raw Slippage = Price × Slippage% × (n × (n-1) / 2) / n²
Final Slippage = min(Raw Slippage, Price × Max Slippage%)
```

Where `n` = number of shares.

### Transaction Fee

```
Fee = max(Subtotal × Fee%, Minimum Fee)
```

### Complete Example

Buying 10 shares at $100 in Real Life mode (1.0x spread multiplier):

| Component             | Calculation               | Amount        |
|-----------------------|---------------------------|---------------|
| Base cost             | 100 × 10                  | $1,000.00     |
| Spread                | 100 × 0.02 × 1.0 / 2 × 10 | $10.00        |
| Slippage              | Progressive calculation   | ~$4.50        |
| Subtotal              |                           | $1,014.50     |
| Transaction fee       | max(1014.50 × 0.005, 1)   | $5.07         |
| **Total**             |                           | **$1,019.57** |
| Effective price/share |                           | $101.96       |

---

## Short Selling

Short selling allows profiting from price declines by selling borrowed shares.

### Configuration

| Parameter                | Value               |
|--------------------------|---------------------|
| Initial margin           | 150%                |
| Maintenance margin       | 125%                |
| Base borrow fee          | 0.1% per cycle      |
| Hard to borrow fee       | 0.3% per cycle (3x) |
| Hard to borrow threshold | 50% of float        |
| Margin call grace period | 5 cycles            |
| Maximum short % of float | 50%                 |

### Opening a Short Position

1. Player places **Short Sell** order
2. Order executes after **1 cycle delay** (like market orders)
3. System calculates initial margin: `Position Value × 150%`
4. Margin is reserved from the **available credit line** (not from cash)
5. Shares are borrowed and sold at the price when the order executes

**Where does the margin come from?**

The margin for short selling comes from the player's credit line. The credit line is based **exclusively on stock holdings** - cash does not count as collateral (see [Loans documentation](loans.md)).

**Important:** No stocks means no credit line, no credit line means no short selling. A player must first buy stocks before they can short sell.

When opening a short position, part of the available credit line is reserved as collateral:

```
Available Margin = Available Credit Line − Already Locked Collateral
```

The reserved amount is no longer available for loans or additional short positions.

**Example**:
- Stock price: $50, Quantity: 100 shares
- Position value: $5,000
- Initial margin required: $5,000 × 1.5 = **$7,500**
- Player needs at least $7,500 available credit line

#### Selling Restriction with Open Short Positions

Since the credit line is based on stock holdings, selling stocks is restricted while short positions are open. The system prevents sales that would push the credit line below the locked short margin.

**Example**:
- Portfolio: 100 large-cap shares at $100 = $10,000
- Collateral value: $10,000 × 70% = $7,000
- Max credit line: $7,000 × 2.5 = $17,500
- Locked short margin: $7,500
- Required minimum collateral: $7,500 / 2.5 = $3,000
- Max sellable collateral: $7,000 − $3,000 = $4,000
- Max sellable shares: $4,000 / ($100 × 70%) ≈ **57 shares**

The remainder (43 shares) serves as collateral for the short positions.

**How to sell all stocks with open short positions:**

To liquidate all stock holdings while having open short positions, you must first close (cover) the short positions:

1. **Cover short positions first** (Buy to Cover) → releases the locked collateral
2. **Then sell stocks** → now possible since no collateral is required anymore

Alternatively, you can cover and sell incrementally - as long as the collateral requirement remains satisfied after each transaction.

### Borrow Fees

Charged each cycle based on current position value:

```
Borrow Fee = Position Value × Base Fee × Multiplier
```

#### Easy to Borrow vs. Hard to Borrow

A stock's borrow status depends on its **Short Interest** - the total number of shorted shares relative to the float:

```
Short Interest Ratio = Short Interest / Float
```

| Status         | Multiplier | Condition                   |
|----------------|------------|-----------------------------|
| Easy to borrow | 1.0x       | Short interest ratio < 50%  |
| Hard to borrow | 3.0x       | Short interest ratio >= 50% |

**Example for status determination**:
- Stock has a float of 1,000,000 shares
- All players combined have shorted 400,000 shares
- Short interest ratio: 400,000 / 1,000,000 = 40%
- Status: **Easy to borrow** (below 50%)

If additional players short 100,000+ more shares, the ratio rises to 50%+ and the stock becomes **hard to borrow** - with 3x the borrow fee.

**Example for fee calculation**:
- Position value: $5,000
- Easy to borrow: $5,000 × 0.001 = **$5/cycle**
- Hard to borrow: $5,000 × 0.001 × 3 = **$15/cycle**

### Margin Calculation

```
Effective Collateral = Locked Collateral + Unrealized P/L
Required Margin = Current Position Value × 125%

Margin Call if: Effective Collateral < Required Margin
```

**Unrealized P/L** = (Entry Price - Current Price) × Shares
- Profit when price falls (positive P/L)
- Loss when price rises (negative P/L)

### Margin Call Process

1. **Trigger**: Effective collateral falls below 125% of position value
2. **Grace period**: 5 cycles to respond
3. **Options**:
   - **Add margin**: Click the plus button (💲) next to the short position, enter the desired dollar amount, and confirm. The amount is immediately deducted from cash and added to the locked collateral.
   - **Voluntarily cover**: Close the position before it's forcibly closed
4. **Forced cover**: If no action after grace period, position is automatically closed

**Example**:
- Shorted 100 shares @ $50, locked margin: $7,500
- Stock rises to $60:
  - Position value: $6,000
  - Unrealized loss: (50 - 60) × 100 = -$1,000
  - Effective collateral: $7,500 - $1,000 = $6,500
  - Required margin: $6,000 × 1.25 = $7,500
  - **Result**: Margin call ($6,500 < $7,500)

### Closing a Short Position

1. Player places **Buy to Cover** order
2. Order executes after **1 cycle delay** (like market orders)
3. Shares are purchased at the price when the order executes
4. Profit/Loss calculated:

```
Gross P/L = (Entry Price - Exit Price) × Shares
Net P/L = Gross P/L - Total Borrow Fees Paid
```

5. Collateral is released proportionally

**Profit Example**:
- Shorted @ $50, covered @ $40, 100 shares
- Gross profit: (50 - 40) × 100 = $1,000
- Borrow fees: $50
- **Net profit**: $950

**Loss Example**:
- Shorted @ $50, covered @ $65, 100 shares
- Gross loss: (50 - 65) × 100 = -$1,500
- Borrow fees: $75
- **Net loss**: -$1,575

---

## Configuration Reference

All trading configuration is defined in `src/config/index.ts`.

### TRADING_MECHANICS

```typescript
TRADING_MECHANICS = {
  realLife: {
    spreadPercent: 0.02,
    slippagePerShare: 0.001,
    maxSlippagePercent: 0.10,
    transactionFeePercent: 0.005,
    minTransactionFee: 1,
    orderDelayInCycles: 1,
    cashBufferPercent: 0.05
  },
  hardLife: {
    spreadPercent: 0.03,
    slippagePerShare: 0.0015,
    maxSlippagePercent: 0.15,
    transactionFeePercent: 0.01,
    minTransactionFee: 2,
    orderDelayInCycles: 1,
    cashBufferPercent: 0.05
  }
}
```

### SHORT_SELLING_CONFIG

```typescript
SHORT_SELLING_CONFIG = {
  enabled: true,
  initialMarginPercent: 1.5,
  maintenanceMarginPercent: 1.25,
  baseBorrowFeePerCycle: 0.001,
  hardToBorrowThreshold: 0.5,
  hardToBorrowFeeMultiplier: 3.0,
  marginCallGraceCycles: 3,
  maxShortPercentOfFloat: 0.5
}
```

### DEFAULT_ORDER_VALIDITY_CYCLES

```typescript
DEFAULT_ORDER_VALIDITY_CYCLES = 10
```

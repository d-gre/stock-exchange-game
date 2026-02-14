# Virtual Player AI

Virtual players (VPs) are AI-controlled traders that create realistic market dynamics. They make independent trading decisions based on personality traits, market conditions, and strategic behavior patterns. This document explains all mechanics, formulas, and terminology.

## Terminology

| Term                | Description                                                        |
|---------------------|--------------------------------------------------------------------|
| **Risk Tolerance**  | Personality value from -100 (risk-averse) to +100 (risk-seeking)   |
| **Trader Type**     | Strategic behavior pattern (Momentum, Contrarian, etc.)            |
| **Volatility**      | Standard deviation of price changes - measures price instability   |
| **Trend**           | Percentage price change over recent candles                        |
| **RSI**             | Relative Strength Index - momentum indicator (0-100)               |
| **Position Sizing** | Determining how many shares to buy or sell                         |
| **Fair Value**      | Theoretical "correct" price based on fundamentals                  |
| **Warmup Phase**    | Initial cycles where VPs build market depth and price history      |

---

## VP Generation

### Risk Tolerance

Each VP receives a random risk tolerance value:

```
riskTolerance = random(-100, +100)
```

| Category     | Range        | Behavior                               |
|--------------|--------------|----------------------------------------|
| Conservative | -100 to -34  | Prefers safety, sells on loss          |
| Moderate     | -33 to +33   | Balanced approach                      |
| Aggressive   | +34 to +100  | Risk-seeking, holds through volatility |

### Normalized Risk

Many calculations use a normalized value (0 to 1):

```
normalizedRisk = (riskTolerance + 100) / 200
```

| Risk Tolerance | Normalized |
|----------------|------------|
| -100           | 0.0        |
| 0              | 0.5        |
| +100           | 1.0        |

### Starting Capital

VP capital varies by game mode:

| Game Mode | Capital Range                            |
|-----------|------------------------------------------|
| Unlimited | 50% to 200% of player's initial capital  |
| Timed     | Same as player's initial capital         |

### Initial Holdings

VPs start with a portion of their capital already invested:

```
investmentPercent = 0.30 + normalizedRisk * 0.40
```

| Risk Type    | Investment Range |
|--------------|------------------|
| Conservative | 30-40% invested  |
| Moderate     | 50-60% invested  |
| Aggressive   | 60-70% invested  |

- Number of stocks: 1-4 different stocks
- Per stock: 50-100% of max affordable shares
- Budget per stock: 30-80% of remaining investment budget

---

## Trader Types

VPs are distributed across six strategic personalities:

| Trader Type     | Population | Description                              |
|-----------------|------------|------------------------------------------|
| Market Maker    | 10%        | Provides liquidity on both sides         |
| Momentum        | 20%        | Follows trends, creates cascades         |
| Contrarian      | 20%        | Fights trends, provides mean reversion   |
| Fundamentalist  | 15%        | Trades on fair value deviation           |
| Noise           | 15%        | Random trading, adds unpredictability    |
| Balanced        | 20%        | Risk-based decisions (default behavior)  |

---

## Market Maker Strategy

Market Makers provide liquidity by placing orders on both bid and ask sides.

### Behavior

- **Trade Probability:** 30% per cycle
- **Target Spread:** 2.0%
- **Order Lifetime:** 5 cycles

### Order Placement

**Bid Side (Buying):**
```
bidPrice = currentPrice × (1 - spread/2)
cashAllocation = availableCash × 0.20
shares = min(maxAffordable × 0.50, cashAllocation / bidPrice)
```

**Ask Side (Selling):**
```
askPrice = currentPrice × (1 + spread/2)
shares = holdings × 0.30
```

---

## Momentum Strategy

Momentum traders follow market trends, buying uptrends and selling downtrends.

### Signals

| Condition      | Action |
|----------------|--------|
| Trend ≥ +2%    | Buy    |
| Trend ≤ -2%    | Sell   |

### Position Sizing

```
buyShares = maxAffordable × 0.60
sellShares = holdings × 0.50
```

### Stock Selection

Stocks are sorted by trend strength. The strongest trending stock is preferred.

---

## Contrarian Strategy

Contrarian traders bet against the crowd, buying oversold stocks and selling overbought ones.

### RSI Calculation

Uses 14-period RSI (Relative Strength Index):

```
for each candle in last 14:
    change = close - previousClose
    if change > 0: gains.push(change)
    else: losses.push(|change|)

avgGain = sum(gains) / 14
avgLoss = sum(losses) / 14
RS = avgGain / avgLoss
RSI = 100 - (100 / (1 + RS))
```

### Signals

| RSI Value | Condition   | Action |
|-----------|-------------|--------|
| < 30      | Oversold    | Buy    |
| > 70      | Overbought  | Sell   |
| 30-70     | Neutral     | Hold   |

### Position Sizing

```
buyShares = maxAffordable × 0.50
sellShares = holdings × 0.40
```

---

## Fundamentalist Strategy

Fundamentalist traders compare current price to fair value.

### Fair Value

Each stock has an inherent fair value. Fundamentalists trade when price deviates significantly.

### Signals

| Deviation from Fair Value | Action |
|---------------------------|--------|
| Price < Fair Value - 10%  | Buy    |
| Price > Fair Value + 10%  | Sell   |

### Position Sizing

```
buyShares = maxAffordable × 0.60
sellShares = holdings × 0.50
```

---

## Noise Trader Strategy

Noise traders add randomness and liquidity to the market.

### Behavior

- **Trade Probability:** 30% per cycle
- **Buy/Sell Decision:** 50/50 random
- **Stock Selection:** Random

### Position Sizing

```
buyShares = maxAffordable × random(0.10, 0.20)
sellShares = holdings × random(0.10, 0.30)
```

---

## Balanced Strategy (Default)

The balanced strategy uses risk tolerance and market conditions to make decisions.

### Trade Decision Flow

**Step 1: Should Trade?**

```
baseChance = 0.55 + (normalizedRisk × 0.20)
finalChance = baseChance + phaseModifier
```

| Risk Type    | Base Chance |
|--------------|-------------|
| Conservative | 35-45%      |
| Moderate     | 45-55%      |
| Aggressive   | 55-75%      |

**Step 2: Buy or Sell?**

```
buyChance = 0.575 + (normalizedRisk × 0.175)
```

| Risk Type    | Buy Preference |
|--------------|----------------|
| Conservative | 40-50%         |
| Moderate     | 50-60%         |
| Aggressive   | 60-75%         |

**Step 3: Stock Selection (Buy)**

Each stock receives a score:

```
score = 50                                       // Base
score += volatility × 200 × normalizedRisk       // Volatility impact
score += trend × (60 - normalizedRisk × 40)      // Trend impact
score += random(-10, +10)                        // Variation
```

- **Risk-seeking VPs:** Prefer high volatility stocks
- **Risk-averse VPs:** Prefer stable, trending stocks

Selection: Weighted random from top 3 scored stocks.

**Step 4: Position Sizing**

```
basePercent = 0.15 + normalizedRisk × 0.40       // 15-55%
variation = 1 + random(0, 0.25) × (1 + normalizedRisk)
shares = floor(maxAffordable × basePercent × variation)
```

**Step 5: Stock Selection (Sell)**

Each holding receives a score:

```
score = 50

// At loss: risk-averse want to sell
if profitPercent < 0:
    score += |profitPercent| × 100 × (1 - normalizedRisk)

// At profit: risk-seeking want to sell
if profitPercent > 0:
    score += profitPercent × 50 × normalizedRisk

// Downtrend increases sell probability
if trend < 0:
    score += |trend| × 30

score += random(-10, +10)
```

- **Threshold:** Only sell if score ≥ 40
- **Sell quantity:** 40-100% of position (risk-averse sell more)

---

## Market Phase Influence

VP behavior changes based on the current market phase.

### Trade Chance Modifiers

| Risk Type    | Panic    | Downturn | Recovery | Upturn  |
|--------------|----------|----------|----------|---------|
| Conservative | -60%     | -40%     | -10%     | +5%     |
| Moderate     | -30%     | -20%     | 0%       | +10%    |
| Aggressive   | 0%       | 0%       | 0%       | 0%      |

### Conservative Stock Preferences

During downturns, conservative VPs penalize volatile stocks:

| Volatility | Score Penalty |
|------------|---------------|
| > 3%       | -30 points    |
| > 2%       | -15 points    |
| ≤ 2%       | 0 points      |

---

## Price Impact

VP trades affect stock prices.

### Impact Formula

```
baseImpact = 0.0001 + random(0, 0.0004)          // 0.01-0.05% per share
volumeMultiplier = min(shares, 20)
rawChange = currentPrice × baseImpact × volumeMultiplier × direction

// Circuit breaker: ±2% maximum
maxChange = currentPrice × 0.02
priceChange = clamp(rawChange, -maxChange, +maxChange)

newPrice = max(0.50, currentPrice + priceChange)
```

**Direction:** +1 for buy, -1 for sell

---

## VP Loans

VPs can take loans when loans are enabled.

### Loan Decision

```
// Risk-based probability
if riskTolerance ≤ -34: loanChance = 5%
if riskTolerance ≥ +34: loanChance = 35%
else:                   loanChance = 15%

// Reduce by utilization
loanChance *= (1 - utilizationRatio × 0.5)
```

### Loan Amount

```
basePercentage = 0.20 + normalizedRisk × 0.40    // 20-60%
variation = random(-0.10, +0.10)
borrowPercent = clamp(basePercentage + variation, 0.10, 0.80)

amount = availableCredit × borrowPercent
```

- Minimum: $1,000
- Rounded to nearest $100
- Conservative VPs capped at 50% of recommended credit line

### Repayment Decision

```
// Risk-based thresholds
if riskTolerance ≤ -34: repayChance = 30%, threshold = 20%
if riskTolerance ≥ +34: repayChance = 8%,  threshold = 50%
else:                   repayChance = 15%, threshold = 35%

// High debt increases repayment chance
if debtToAssetRatio > threshold:
    repayChance += 20%
```

---

## VP Short Selling

VPs can short sell when the feature is enabled.

### Short Decision

```
// Risk-based probability
if riskTolerance ≤ -34: shortChance = 2%
if riskTolerance ≥ +34: shortChance = 20%
else:                   shortChance = 8%

// Reduce by existing short exposure
if shortExposure/portfolioValue > 30%: shortChance × 0.2
if shortExposure/portfolioValue > 15%: shortChance × 0.5
```

### Stock Selection for Shorting

```
score = 50
score += volatility × 100 × (1 + riskTolerance/100)
score -= trend × (100 - riskTolerance × 0.5)      // Downtrend = higher score
score += random(-10, +10)
```

### Position Sizing

```
sizeMultiplier = 0.15 + normalizedRisk × 0.25    // 15-40%
maxShares = floor(availableMargin / initialMarginPercent / price)
shares = max(1, floor(maxShares × sizeMultiplier))
```

### Cover Decision

| Condition                        | Cover Chance         |
|----------------------------------|----------------------|
| Near margin call (< 110% margin) | 50%                  |
| Profit > 8-15% (risk-based)      | 25-30%               |
| Loss > 10-20% (risk-based)       | 20-40%               |

---

## Warmup Phase

The warmup phase ensures all stocks have trading history before the game begins.

### Configuration

| Parameter               | Value       |
|-------------------------|-------------|
| Duration                | 128 cycles  |
| Goal                    | Every stock trades at least once |

### Untraded Stock Bonus

During warmup, VPs receive a bonus for selecting untraded stocks:

```
if cycle < prioritizeAfterCycle: bonus = 0

tradeCount = tradeCounts[symbol]
if tradeCount >= 1: bonus = 0
else: bonus = min(50, (1 - tradeCount) × 25)

finalScore = stockScore + bonus
```

### Forced Trades

At warmup end, any stock with 0 trades triggers:

1. Find VPs who can afford the stock
2. Execute trade at 10% of normal position size
3. Update Market Maker inventory

---

## Volatility & Trend Calculation

### Volatility

```
changes = []
for i = 1 to priceHistory.length:
    change = (close[i] - close[i-1]) / close[i-1]
    changes.push(change)

mean = sum(changes) / length
variance = sum((change - mean)²) / length
volatility = sqrt(variance)
```

### Trend

```
recentHistory = priceHistory.slice(-5)
firstPrice = recentHistory[0].close
lastPrice = recentHistory[last].close
trend = (lastPrice - firstPrice) / firstPrice
```

---

## Transaction History

Each VP stores their last 10 transactions with metadata:

| Field            | Description                    |
|------------------|--------------------------------|
| symbol           | Stock traded                   |
| type             | "buy" or "sell"                |
| shares           | Number of shares               |
| price            | Execution price                |
| timestamp        | Game cycle                     |
| volatility       | Stock volatility at decision   |
| trend            | Stock trend at decision        |
| score            | Decision score                 |
| profitPercent    | Profit/loss for sells          |
| riskTolerance    | VP's risk tolerance            |

---

## Configuration Reference

### VP Configuration

| Parameter              | Value | Description                    |
|------------------------|-------|--------------------------------|
| virtualPlayerCount     | 49    | Number of virtual players      |
| warmupCycles           | 128   | Cycles before game starts      |
| loansEnabled           | true  | VPs can take loans             |

### Trader Type Distribution

```typescript
distribution: {
  marketMaker: 0.10,     // ~5 VPs
  momentum: 0.20,        // ~10 VPs
  contrarian: 0.20,      // ~10 VPs
  fundamentalist: 0.15,  // ~7-8 VPs
  noise: 0.15,           // ~7-8 VPs
  balanced: 0.20         // ~10 VPs
}
```

### Key Formulas Summary

| Calculation      | Formula                                           | Range      |
|------------------|---------------------------------------------------|------------|
| Trade Chance     | 0.55 + (normalizedRisk × 0.20) + phaseModifier    | 5-95%      |
| Buy Chance       | 0.575 + (normalizedRisk × 0.175)                  | 40-75%     |
| Position Size    | maxAffordable × (0.15 + normalizedRisk × 0.40)    | 15-55%     |
| Price Impact     | price × 0.01-0.05% × min(shares, 20)              | ±2% max    |
| Stock Score      | 50 + volatility + trend + random                  | 0-100+     |
| Loan Chance      | 5-35% × (1 - utilization × 0.5)                   | 0-35%      |
| Short Chance     | 2-20% × exposure factor                           | 0-20%      |

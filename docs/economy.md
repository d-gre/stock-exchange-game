# Economy & Market Mechanics

This document describes the economic system, market phases, sentiment indicators, and the market maker.

## Table of Contents

1. [Terminology](#terminology)
2. [Economic Cycles](#economic-cycles)
3. [Phase Transitions](#phase-transitions)
4. [Crash Mechanics](#crash-mechanics)
5. [Fear & Greed Index](#fear--greed-index)
6. [Volatility System](#volatility-system)
7. [Market Maker](#market-maker)
8. [Game Duration & End Screen](#game-duration--end-screen)
9. [Configuration Reference](#configuration-reference)

---

## Terminology

| Term                   | Description                                                      |
|------------------------|------------------------------------------------------------------|
| **Economic Cycle**     | Recurring pattern of market phases from boom to recession        |
| **Market Phase**       | Current state of the economy (e.g., boom, panic, recession)      |
| **Sector Phase**       | Independent economic phase for each of 4 market sectors          |
| **Global Phase**       | Overall market phase calculated as average of sector phases      |
| **Momentum**           | Rate of price change over recent cycles (-1 to +1)               |
| **Volatility**         | Magnitude of price fluctuations, varies by phase                 |
| **Overheating**        | When a sector's index exceeds its 50-cycle average by 20%+       |
| **Market Crash**       | Sudden price drop triggered by prolonged overheating             |
| **Fear & Greed Index** | Sentiment indicator from 0 (extreme fear) to 100 (extreme greed) |
| **Market Maker**       | Liquidity provider that adjusts spreads based on inventory       |
| **Spread Modifier**    | Phase-based adjustment to trading costs                          |
| **Sector Correlation** | How one sector's performance influences another sector           |
| **Sector Momentum**    | Accumulated performance trend of a sector (-1 to +1)             |

---

## Economic Cycles

The game implements a **6-phase economic cycle system** where each sector operates independently.

### Phase Overview

| Phase             | Volatility      | Spread Modifier  | Duration     | Description                             |
|-------------------|-----------------|------------------|--------------|-----------------------------------------|
| **Prosperity**    | 1.0x (baseline) | 0 (neutral)      | 30-60 cycles | Stable, normal market conditions        |
| **Boom**          | 1.5x            | -0.2 (tighter)   | 20-50 cycles | High growth, rising prices, lower costs |
| **Consolidation** | 2.0x            | +0.3 (wider)     | 10-30 cycles | Uncertainty, correction phase           |
| **Panic**         | 3.0x (extreme)  | +1.0 (very wide) | 15-25 cycles | Market crash, extreme fear              |
| **Recession**     | 1.3x            | +0.5 (high)      | 40-80 cycles | Stabilization after crash               |
| **Recovery**      | 1.2x            | +0.2             | 15-40 cycles | Gradual improvement                     |

### Sectors

The market is divided into 4 sectors:

- **Technology** (AAPL, MSFT, NVDA, TSLA)
- **Finance** (JPM, V, BAC)
- **Industrial** (CAT, BA, MMM)
- **Commodities** (XOM, NEM, BAY)

Each sector has its own phase, but sectors **influence each other** through an inter-sector correlation system.

### Inter-Sector Correlations

When a sector has significant performance (>2% movement), it affects other sectors based on a correlation matrix:

| Source Sector | Target Sector | Correlation | Reasoning |
|---------------|---------------|-------------|-----------|
| **Technology** | Finance | +0.3 | Tech success drives investment activity |
| | Industrial | +0.1 | Automation, tech adoption in industry |
| | Commodities | 0 | Neutral |
| **Finance** | Technology | +0.4 | Credit availability helps tech growth |
| | Industrial | +0.4 | Loans for industrial expansion |
| | Commodities | +0.2 | Commodity trading profits |
| **Industrial** | Technology | +0.1 | Industrial demand for tech |
| | Finance | +0.2 | Industrial loans/bonds |
| | Commodities | +0.5 | High demand for raw materials |
| **Commodities** | Technology | -0.1 | High prices hurt tech margins |
| | Finance | +0.1 | Commodity trading |
| | Industrial | **-0.4** | High prices hurt industrial margins! |

**Correlation values**: +1 = direct correlation, -1 = inverse correlation, 0 = neutral

**Example**:
- Industrial sector has a strong cycle (+3%)
- Commodities sector receives: +3% × 0.5 × 0.5 = **+0.75% boost** to momentum
- Tech sector receives: +3% × 0.1 × 0.5 = **+0.15% boost**

**Inverse correlation example**:
- Commodities spike (+4%)
- Industrial sector receives: +4% × (-0.4) × 0.5 = **-0.8% drag** on momentum

### Sector Momentum

Each sector maintains a **momentum value** (-1 to +1) that:
- Decays by 15% per cycle (momentum decay: 0.85)
- Is updated by 15% of new performance each cycle
- Influences stock prices by up to ±3% (max sector influence)
- Has 60% influence strength on individual stock prices

### Global Phase Calculation

The global phase is **not dictated** to sectors but calculated as the **weighted average** of all sector phases:

```
Phase Scores: boom=5, prosperity=4, recovery=3, consolidation=2, recession=1, panic=0

Global Phase = phase with score closest to average of all sector scores
```

**Example**:
- Tech: boom (5), Finance: prosperity (4), Industrial: consolidation (2), Commodities: recovery (3)
- Average: (5 + 4 + 2 + 3) / 4 = 3.5
- Global Phase: **prosperity** (score 4 is closest to 3.5)

---

## Phase Transitions

Phases transition based on **conditional probabilities** that depend on momentum and duration.

### Transition Probabilities

| From          | To            | Base Probability | Condition                             |
|---------------|---------------|------------------|---------------------------------------|
| Prosperity    | Boom          | 2% per cycle     | Momentum > 0.3                        |
| Prosperity    | Consolidation | 1% per cycle     | Momentum < -0.1                       |
| Boom          | Consolidation | 3% per cycle     | Any negative momentum or max duration |
| Consolidation | Prosperity    | 3% per cycle     | Momentum > 0.1 (stabilization)        |
| Consolidation | Panic         | 2% per cycle     | Momentum < -0.3 (sharp decline)       |
| Panic         | Recession     | 5% per cycle     | After minimum 15 cycles               |
| Recession     | Recovery      | 2.5% per cycle   | Momentum > 0                          |
| Recovery      | Prosperity    | 4% per cycle     | Momentum > 0.15 (sustained positive)  |

### Momentum Calculation

Momentum measures the rate of price change over the last 5 candles:

```
Momentum = Average percentage change across recent candles
Normalized to range: -1 (strong decline) to +1 (strong rise)
```

- **Positive momentum** (> 0): Prices trending upward
- **Negative momentum** (< 0): Prices trending downward
- **Neutral momentum** (~ 0): Prices stable

---

## Crash Mechanics

The system includes a sophisticated **overheat and crash mechanism**.

### Overheating Detection

A sector becomes **overheated** when its index value exceeds the 50-cycle average by more than 20%:

```
Sector Index = Weighted average of current prices vs. historical average
Overheated = Index Value > (50-Cycle Average × 1.20)
```

### Crash Trigger

When a sector remains overheated for consecutive cycles, crash probability increases:

```
Crash Probability = 0.5% (base) + 0.2% × (consecutive overheated cycles)
```

**Example**:
- 5 cycles overheated: 0.5% + (0.2% × 5) = **1.5% crash chance**
- 10 cycles overheated: 0.5% + (0.2% × 10) = **2.5% crash chance**
- 20 cycles overheated: 0.5% + (0.2% × 20) = **4.5% crash chance**

### Crash Impact

When a crash is triggered:

| Effect               | Value                        |
|----------------------|------------------------------|
| Price drop magnitude | 8% to 15% (random)           |
| Per-stock variation  | ±20% of base drop            |
| Sector phase         | Immediately set to **Panic** |
| Overheat counter     | Reset to 0                   |

**Example**:
- Crash magnitude: 12%
- Stock A: 12% × 1.15 = **13.8% drop**
- Stock B: 12% × 0.85 = **10.2% drop**

---

## Fear & Greed Index

A **0-100 sentiment indicator** that reflects overall market psychology.

### Index Levels

| Range  | Level         | Description                            |
|--------|---------------|----------------------------------------|
| 0-25   | Extreme Fear  | Panic selling, market bottom potential |
| 26-45  | Fear          | Cautious sentiment, declining prices   |
| 46-55  | Neutral       | Balanced sentiment                     |
| 56-75  | Greed         | Optimistic sentiment, rising prices    |
| 76-100 | Extreme Greed | Euphoria, potential bubble             |

### Calculation Components

The index combines 4 weighted factors:

#### 1. Phase Base Score (30% weight)

| Phase         | Base Score |
|---------------|------------|
| Boom          | 75         |
| Prosperity    | 55         |
| Recovery      | 45         |
| Consolidation | 38         |
| Recession     | 28         |
| Panic         | 15         |

#### 2. Momentum Component (40% weight)

```
Momentum Score = Global Momentum × 25
Range: -25 to +25 points
```

#### 3. Volatility Component (20% weight)

```
High volatility (>5%): -10 points (fear)
Low volatility (<1%): +10 points (stability)
Formula: 10 - (normalized_volatility × 400)
```

#### 4. Price Change Component (10% weight)

```
Score = Average daily price change × 100
Example: +1% change = +1 point
```

### Final Calculation

```
Fear & Greed Index = Phase Score + Momentum Score + Volatility Score + Price Change Score
Result clamped to 0-100 range
```

**Example**:
- Phase: Prosperity (55)
- Momentum: +0.4 → 0.4 × 25 = +10
- Volatility: 3% → 10 - (3 × 4) = -2
- Price Change: +0.5% → +0.5
- **Index**: 55 + 10 - 2 + 0.5 = **63.5 (Greed)**

---

## Volatility System

Volatility determines the magnitude of price movements each cycle.

### Base Volatility

Each stock has an inherent base volatility:

| Category | Base Volatility | Example Stocks     |
|----------|-----------------|--------------------|
| Stable   | 1.5% - 1.8%     | MSFT, V, AAPL, JPM |
| Moderate | 2.0% - 2.5%     | CAT, BA, XOM       |
| Volatile | 3.0% - 4.0%     | NVDA, TSLA, NEM    |

### Volatility Multiplier

The effective volatility is adjusted by economic phase:

```
Effective Volatility = Base Volatility × Volatility Multiplier
Volatility Multiplier = (Global Phase Multiplier × 0.4) + (Sector Phase Multiplier × 0.6)
```

**Example**:
- Stock in Panic global phase (3.0x) + Consolidation sector (2.0x)
- Multiplier: (3.0 × 0.4) + (2.0 × 0.6) = 1.2 + 1.2 = **2.4x**
- Base volatility 2.5% becomes: 2.5% × 2.4 = **6% effective volatility**

### Price Generation

New candle prices incorporate volatility:

```
Price Change = Base Trend + Sector Influence + (Random × Volatility)
High/Low wicks scale with volatility level
```

---

## Market Maker

The market maker provides liquidity and adjusts spreads based on inventory and economic conditions.

### Inventory System

- **Base inventory**: 100,000 shares per stock
- **Initial spread multiplier**: 1.0

### Spread Multiplier (Inventory-Based)

The spread multiplier adjusts based on inventory level:

| Inventory Level | Multiplier | Effect                    |
|-----------------|------------|---------------------------|
| <= 10% of base  | 3.0x       | Very wide spread (scarce) |
| 100% of base    | 1.0x       | Normal spread             |
| >= 190% of base | 0.5x       | Narrow spread (abundant)  |

Between thresholds, the multiplier is linearly interpolated.

### Spread Modifier (Phase-Based)

Economic phases add an additional spread modifier:

| Phase         | Modifier | Effect on Spread           |
|---------------|----------|----------------------------|
| Boom          | -0.2     | 20% tighter (lower costs)  |
| Prosperity    | 0        | Normal                     |
| Recovery      | +0.2     | 20% wider                  |
| Consolidation | +0.3     | 30% wider                  |
| Recession     | +0.5     | 50% wider                  |
| Panic         | +1.0     | 100% wider (doubled costs) |

The effective modifier combines global and sector phases:

```
Effective Modifier = (Global Phase Modifier + Sector Phase Modifier) / 2
```

### Inventory Changes

| Action                | Inventory Impact     |
|-----------------------|----------------------|
| Player buys           | Decreases (MM sells) |
| Player sells          | Increases (MM buys)  |
| Virtual player trades | 50% of normal impact |

### Rebalancing

- Inventory slowly returns to base level at **1% per cycle**

---

## Game Duration & End Screen

### Game Duration

Players select the game duration before starting. The game runs for a fixed number of cycles, after which the end screen appears automatically.

| Option     | Cycles | Approximate Time (at 1x speed) |
|------------|--------|--------------------------------|
| 30 minutes | 360    | ~30 min                        |
| 20 minutes | 240    | ~20 min                        |
| 10 minutes | 120    | ~10 min                        |
| 5 minutes  | 60     | ~5 min                         |
| Unlimited  | —      | No time limit                  |

The base cycle interval is **5 seconds**. Actual time depends on the speed multiplier.

### Speed Multiplier

The game speed can be adjusted during play:

| Speed | Cycle Interval |
|-------|---------------|
| 1x    | 5 seconds     |
| 2x    | 2.5 seconds   |
| 3x    | ~1.7 seconds  |

The game pauses automatically when the trade panel, loan modal, settings, or help modal is open.

### End Screen

When a timed game ends, the end screen displays:

- **Player ranking** among all participants (human + virtual players)
- **Net worth** = Cash + Holdings Value − Debt − Pending Interest + Short Position P/L
- **Profit/Loss** = Net Worth − Initial Cash
- **Risk level** for each player (conservative / moderate / aggressive)
- **Top 3** and **Bottom 3** players with detailed stats
- **Market climate** chart showing the dominant market phase during the game

#### Risk Level Calculation

The risk level is determined by a score based on three factors:

| Factor              | Conservative | Moderate | Aggressive |
|---------------------|-------------|----------|------------|
| Trade frequency     | ≤ 0.2/cycle | ≤ 0.5/cycle | > 0.5/cycle |
| Portfolio diversity | > 4 stocks  | 3–4 stocks | ≤ 2 stocks |
| Loan utilization    | ≤ 20%      | ≤ 50%    | > 50%      |

Each factor contributes 0–2 points. Total score: 0–1 = conservative, 2–3 = moderate, 4+ = aggressive.

### Continue Game

After the end screen, players can:

- **Play again** — start a new game
- **Continue playing** — extend the current game by selecting a new duration (or unlimited)
- **Load saved game** — restore a previously saved state

### End Screen Preview

Press **Alt+R** during a running game to preview the current standings without ending the game. The preview shows the same statistics as the real end screen but without action buttons. Press **Alt+R** again to close the preview.

---

## Configuration Reference

All economy configuration is defined in `src/config/index.ts`.

### MARKET_PHASE_CONFIG

```typescript
MARKET_PHASE_CONFIG = {
  phases: {
    prosperity: {
      volatilityMultiplier: 1.0,
      mmSpreadModifier: 0,
      minDuration: 30,
      maxDuration: 60
    },
    boom: {
      volatilityMultiplier: 1.5,
      mmSpreadModifier: -0.2,
      minDuration: 20,
      maxDuration: 50
    },
    consolidation: {
      volatilityMultiplier: 2.0,
      mmSpreadModifier: 0.3,
      minDuration: 10,
      maxDuration: 30
    },
    panic: {
      volatilityMultiplier: 3.0,
      mmSpreadModifier: 1.0,
      minDuration: 15,
      maxDuration: 25
    },
    recession: {
      volatilityMultiplier: 1.3,
      mmSpreadModifier: 0.5,
      minDuration: 40,
      maxDuration: 80
    },
    recovery: {
      volatilityMultiplier: 1.2,
      mmSpreadModifier: 0.2,
      minDuration: 15,
      maxDuration: 40
    }
  },
  transitions: {
    prosperityToBoom: 0.02,
    prosperityToConsolidation: 0.01,
    boomToConsolidation: 0.03,
    consolidationToProsperity: 0.03,
    consolidationToPanic: 0.02,
    panicToRecession: 0.05,
    recessionToRecovery: 0.025,
    recoveryToProsperity: 0.04
  },
  crashMechanic: {
    overheatThreshold: 0.20,
    baseCrashProbability: 0.005,
    crashProbabilityPerCycle: 0.002,
    crashImpactMin: 0.08,
    crashImpactMax: 0.15
  }
}
```

### MARKET_MAKER_CONFIG

```typescript
MARKET_MAKER_CONFIG = {
  baseInventoryPerStock: 100000,
  minInventoryThreshold: 0.1,
  maxInventoryThreshold: 1.9,
  minSpreadMultiplier: 0.5,
  maxSpreadMultiplier: 3.0,
  rebalanceRate: 0.01,
  virtualPlayerImpactMultiplier: 0.5
}
```

### SECTOR_CONFIG

Defined in `src/utils/sectorCorrelation.ts`:

```typescript
SECTOR_CONFIG = {
  sectorInfluenceStrength: 0.6,      // 60% influence on stock prices
  momentumDecay: 0.85,               // Momentum decays 15% per cycle
  momentumUpdateRate: 0.15,          // 15% of new performance added to momentum
  strongPerformanceThreshold: 0.02,  // 2% triggers inter-sector effects
  maxSectorInfluence: 0.03           // Max ±3% price influence
}

// In MARKET_PHASE_CONFIG:
sectorInteraction: {
  interactionMultiplier: 1.0         // Scales correlation strength
}
```

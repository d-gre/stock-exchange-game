# Loan System

The loan system allows players to leverage their portfolio by borrowing money against their stock holdings. This document explains all mechanics, formulas, and terminology.

## Terminology

| Term                  | Description                                                     |
|-----------------------|-----------------------------------------------------------------|
| **Principal**         | The original amount borrowed                                    |
| **Balance**           | Current outstanding debt (principal + accrued interest)         |
| **Collateral**        | Assets pledged as security for the loan (stocks only, not cash) |
| **Credit Line**       | Maximum amount available to borrow based on collateral          |
| **Utilization Ratio** | Percentage of credit line currently in use                      |
| **Credit Score**      | Player's creditworthiness rating (0-100, 50 = neutral)          |
| **Maturity**          | When the loan becomes due for repayment                         |
| **Overdue**           | Loan status when not repaid at maturity                         |

---

## Credit Line Calculation

The credit line determines how much a player can borrow. It is calculated based on **stock holdings** and **base collateral** - cash is not counted as collateral.

### Collateral Valuation

| Asset Type                                | Collateral Ratio |
|-------------------------------------------|------------------|
| Large-Cap Stocks (market cap > $200B)     | 70%              |
| Small/Mid-Cap Stocks (market cap ≤ $200B) | 50%              |
| Base Collateral (from starting capital)   | 25% of initial   |
| Cash                                      | 0% (not counted) |

### Base Collateral

Every player receives a **base collateral** equal to 25% of their starting capital. This "virtual" collateral:

- **Improves creditworthiness** - allows borrowing even without stock holdings
- **Does NOT count toward net worth** - players can lose more than their starting capital
- **Enables risky strategies** - maximum leverage can lead to negative outcomes

**Example with $100,000 starting capital:**
- Base collateral: $100,000 × 0.25 = $25,000
- A player with no stocks can borrow up to: $25,000 × 2.5 = $62,500

**Warning:** If a player borrows against base collateral and loses everything, they can end up with negative net worth exceeding their original investment!

### Stock Collateral

**Example:**
- $10,000 in Apple (large-cap): $10,000 × 0.70 = $7,000 collateral
- $5,000 in a small-cap stock: $5,000 × 0.50 = $2,500 collateral
- Stock collateral: $9,500

### Total Collateral

```
Total Collateral = Stock Collateral + Base Collateral
```

**Example with $100,000 starting capital:**
- Stock collateral: $9,500
- Base collateral: $25,000
- Total collateral: $34,500

### Credit Line Limits

```
Recommended Credit Line = floor(Total Collateral / 1000) × 1000
Maximum Credit Line = Recommended × 2.5
```

**Example:**
- Total collateral: $34,500
- Recommended: $34,000
- Maximum: $85,000

### Minimum Requirements

- Minimum collateral to take any loan: **$1,000**
- With base collateral, new players can start borrowing immediately

---

## Loan Structure

### Limits

- **Maximum concurrent loans:** 3
- Pending orders with loan requests count toward this limit

### Duration

| Parameter        | Value      |
|------------------|------------|
| Minimum duration | 20 cycles  |
| Maximum duration | 100 cycles |
| Default duration | 40 cycles  |
| Step size        | 20 cycles  |

Longer loan durations receive interest rate discounts (see Interest Rate section).

### Loan Lifecycle

1. **Origination**: Player takes loan, origination fee charged
2. **Active**: Interest accrues every 20 cycles
3. **Warning**: Notification 4 cycles before maturity
4. **Maturity**: Loan becomes due (remainingCycles = 0)
5. **Auto-repayment**: If cash available, loan is automatically repaid
6. **Overdue**: If insufficient cash, loan becomes overdue with penalties

---

## Interest Rate Calculation

The effective interest rate is calculated from multiple components:

```
Effective Rate = Base Rate + Risk Profile + Profit History + Utilization
                 + Loan Count Penalty + Credit Score Adjustment + Duration Discount
```

### Base Rate

**6%** per interest period (charged every 20 cycles)

### Risk Profile Adjustment

Based on the player's trading risk score (calculated from portfolio volatility):

| Risk Score | Adjustment | Description               |
|------------|------------|---------------------------|
| ≤ -34      | -1%        | Conservative trader bonus |
| -33 to +33 | 0%         | Neutral                   |
| ≥ +34      | +2%        | Aggressive trader penalty |

**Dampening:** The adjustment is scaled by trade count. With fewer than 10 trades, the effect is proportionally reduced. This prevents new players from being penalized/rewarded before establishing a track record.

### Profit/Loss History Adjustment

Only significant losses affect the rate:

- **Threshold:** $5,000 loss
- **Rate:** +0.005% per $1,000 loss beyond threshold
- **Maximum:** +2%

**Example:** $15,000 total loss
- Excess: $15,000 - $5,000 = $10,000
- Adjustment: 10 × 0.005% = +0.05%

### Utilization Surcharge

Progressive surcharges based on credit line usage:

| Utilization | Surcharge |
|-------------|-----------|
| < 50%       | 0%        |
| ≥ 50%       | +1%       |
| ≥ 75%       | +3%       |
| = 100%      | +6%       |

### Loan Count Penalty

Each additional loan beyond the first incurs a **+1%** penalty.

| Active Loans | Penalty |
|--------------|---------|
| 1            | 0%      |
| 2            | +1%     |
| 3            | +2%     |

### Credit Score Adjustment

Based on deviation from neutral score (50):

| Score        | Adjustment             |
|--------------|------------------------|
| Below 50     | +0.1% per point below  |
| 50 (neutral) | 0%                     |
| Above 50     | -0.05% per point above |

**Examples:**
- Score 30: +2% penalty (20 points × 0.1%)
- Score 70: -1% bonus (20 points × 0.05%)

### Duration Discount

Longer loans receive better rates to incentivize commitment:

- **Discount:** -0.5% per 20 cycles above minimum
- **Maximum discount:** -2%

| Duration        | Discount |
|-----------------|----------|
| 20 cycles (min) | 0%       |
| 40 cycles       | -0.5%    |
| 60 cycles       | -1%      |
| 80 cycles       | -1.5%    |
| 100 cycles      | -2%      |

### Minimum Rate

The effective rate cannot go below **1%** regardless of bonuses.

---

## Fees

### Origination Fee

- **Rate:** 1.5% of loan amount
- **Charged:** Immediately when loan is taken
- **Deducted from:** Player receives (loan amount - fee)

**Example:** $10,000 loan → Player receives $9,850

### Early Repayment Fee

- **Rate:** 0.5% of repayment amount
- **Charged:** Only for early repayment (before maturity)
- **Not charged:** At maturity or when overdue

### When is Early Repayment Worthwhile?

Early repayment is **not always cheaper** than waiting for maturity. This is realistic, similar to real-world prepayment penalties.

**Break-even calculation:**
- Interest per period: 0.30% (6% / 20 cycles)
- Early repayment fee: 0.50%
- Break-even: ~1.67 saved interest periods

| Loan Duration | Saved Periods | Financial Benefit                        |
|---------------|---------------|------------------------------------------|
| 20 cycles     | 0             | No benefit (+ fee cost)                  |
| 40 cycles     | 1             | **More expensive** (~$20 extra per $10k) |
| 60 cycles     | 2             | **Saves money** (~$10 per $10k)          |
| 80 cycles     | 3             | **Saves money** (~$40 per $10k)          |
| 100 cycles    | 4             | **Saves money** (~$70 per $10k)          |

**Non-financial incentives for early repayment:**
- Credit score bonus: +5 (early) vs +3 (on-time)
- Frees up a loan slot (max 3 concurrent)
- Reduces risk of default during market crashes

---

## Credit Score System

The credit score (0-100) affects interest rates and represents the player's creditworthiness.

### Starting Score

New players begin with a score of **50** (neutral).

### Score Changes

| Event                           | Change              |
|---------------------------------|---------------------|
| On-time repayment (at maturity) | +3                  |
| Early repayment                 | +5                  |
| Auto-repaid successfully        | +3                  |
| Overdue (per cycle)             | Progressive penalty |

### Progressive Overdue Penalty

The penalty increases the longer a loan remains overdue:

```
Penalty = Base Penalty × (1 + floor(overdueForCycles / 5))
```

| Cycles Overdue | Multiplier | Penalty per Cycle |
|----------------|------------|-------------------|
| 1-5            | 1×         | 1 point           |
| 6-10           | 2×         | 2 points          |
| 11-15          | 3×         | 3 points          |
| ...            | ...        | ...               |
| Maximum        | -          | 10 points/cycle   |

This ensures that one loan overdue for 40 cycles is punished more severely than three loans each overdue for 2 cycles.

### Score Limits

- **Minimum:** 0
- **Maximum:** 100

---

## Interest Charging

Interest is charged every **20 cycles**:

```
Interest = Balance × (Interest Rate / 20)
```

The interest is added to the loan balance (compound interest).

---

## Maturity and Repayment

### Automatic Repayment

When a loan reaches maturity (remainingCycles = 0):

1. System checks if player has enough cash
2. If yes: Loan is automatically repaid, credit score bonus applied
3. If no: Partial repayment with available cash, loan becomes overdue

### Manual Repayment

Players can repay loans at any time:

- **Before maturity:** Early repayment fee applies (0.5%)
- **At maturity:** No fee
- **When overdue:** No fee (already penalized via credit score)

### Overdue Loans

When a loan becomes overdue:

1. Loan marked as `isOverdue = true`
2. Delinquency record created
3. Each cycle: Progressive credit score penalty applied
4. Player can still repay at any time (no repayment fee)

---

## Configuration Reference

All values can be found in `src/config/index.ts` under `LOAN_CONFIG`:

| Parameter                   | Value | Description                          |
|-----------------------------|-------|--------------------------------------|
| `baseInterestRate`          | 0.06  | 6% base rate                         |
| `interestChargeCycles`      | 20    | Cycles between charges               |
| `largeCapCollateralRatio`   | 0.70  | 70% for large-cap                    |
| `smallCapCollateralRatio`   | 0.50  | 50% for small/mid-cap                |
| `largeCapThresholdBillions` | 200   | $200B threshold                      |
| `baseCollateralPercent`     | 0.25  | 25% of starting capital              |
| `minCollateralForLoan`      | 1000  | $1,000 minimum                       |
| `maxCreditLineMultiplier`   | 2.5   | Max = 2.5× recommended               |
| `maxLoans`                  | 3     | Max concurrent loans                 |
| `originationFeePercent`     | 0.015 | 1.5% fee                             |
| `repaymentFeePercent`       | 0.005 | 0.5% early repayment fee             |
| `initialCreditScore`        | 50    | Starting score                       |
| `creditScoreOnTimeBonus`    | 3     | On-time bonus                        |
| `creditScoreEarlyBonus`     | 5     | Early repayment bonus                |

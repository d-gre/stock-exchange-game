import type { GameMode, GameModeConfig, OrderTypeConfig, TradingMechanics } from '../types';

export const CONFIG = {
  // Number of virtual players
  virtualPlayerCount: 50,

  // Maximum number of virtual players
  maxVirtualPlayers: 50,

  // Starting capital for the main player
  initialCash: 100000,

  // Stock split: When a price exceeds this value, a split is triggered
  stockSplitThreshold: 750,

  // Stock split ratio (3:1 = price divided by 3, shares tripled)
  stockSplitRatio: 3,

  // Starting capital range for virtual players (half to double the player's starting capital)
  virtualPlayerCashMin: 50000,
  virtualPlayerCashMax: 200000,

  // Update interval in milliseconds
  updateInterval: 5000,

  // Default game mode
  defaultGameMode: 'realLife' as GameMode,

  // Number of warmup cycles before game start
  // Simulates market activity so charts look "alive"
  warmupCycles: 128,
};

/**
 * Trading mechanics per game mode
 *
 * Spread: Difference between buy and sell price (prevents instant arbitrage)
 * Slippage: Price deviation on large orders (simulates market depth)
 * Fees: Transaction costs (only in Real Life / Hard Life)
 * Delay: Order execution in next cycle (only in Real Life / Hard Life)
 */
export const TRADING_MECHANICS: Record<GameMode, TradingMechanics> = {
  sandbox: {
    spreadPercent: 0.01,        // 1% spread
    slippagePerShare: 0.0005,   // 0.05% per share
    maxSlippage: 0.05,          // Max 5% slippage
    feePercent: 0,              // No fees
    minFee: 0,
    orderDelayCycles: 0,        // Immediate execution
  },
  realLife: {
    spreadPercent: 0.02,        // 2% spread
    slippagePerShare: 0.001,    // 0.1% per share
    maxSlippage: 0.10,          // Max 10% slippage
    feePercent: 0.005,          // 0.5% fee
    minFee: 1,                  // Min $1 fee
    orderDelayCycles: 1,        // 1 cycle delay
  },
  hardLife: {
    spreadPercent: 0.03,        // 3% spread
    slippagePerShare: 0.0015,   // 0.15% per share
    maxSlippage: 0.15,          // Max 15% slippage
    feePercent: 0.01,           // 1% fee
    minFee: 2,                  // Min $2 fee
    orderDelayCycles: 1,        // 1 cycle delay
  },
};

export const GAME_MODES: GameModeConfig[] = [
  {
    id: 'realLife',
    name: 'Real Life',
    description: 'Realistische Marktbedingungen',
  },
  {
    id: 'hardLife',
    name: 'Hard Life',
    description: 'Schwieriger Modus mit zusätzlichen Herausforderungen',
  },
];

export const BUY_ORDER_TYPES: OrderTypeConfig[] = [
  { id: 'market', name: 'Billigst' },
  { id: 'limit', name: 'Limit' },
  { id: 'stopBuy', name: 'Stop Buy' },
  { id: 'stopBuyLimit', name: 'Stop Buy Limit' },
];

export const SELL_ORDER_TYPES: OrderTypeConfig[] = [
  { id: 'market', name: 'Bestens' },
  { id: 'limit', name: 'Limit' },
  { id: 'stopBuy', name: 'Stop Loss' },
  { id: 'stopBuyLimit', name: 'Stop Loss Limit' },
];

/** Default order validity in cycles */
export const DEFAULT_ORDER_VALIDITY_CYCLES = 10;

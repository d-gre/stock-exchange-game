import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useClickOutside } from '../hooks/useClickOutside';
import { useAppSelector } from '../store/hooks';
import { selectSpreadMultiplier } from '../store/marketMakerSlice';
import {
  selectCreditLineInfo,
  selectCanTakeLoanEffective,
  selectEffectiveLoanCount,
  calculateInterestRate,
} from '../store/loansSlice';
import { selectRiskProfile } from '../store/tradeHistorySlice';
import {
  selectShortPositionBySymbol,
  selectBorrowStatus,
  selectCanShortSymbol,
  selectTotalLockedCollateral,
} from '../store/shortPositionsSlice';
import type { Stock, Portfolio, GameMode, OrderType, TradeExecution, PendingOrder, OrderLoanRequest } from '../types';
import type { TradeType } from '../store/uiSlice';
import { BUY_ORDER_TYPES, SELL_ORDER_TYPES, TRADING_MECHANICS, DEFAULT_ORDER_VALIDITY_CYCLES, LOAN_CONFIG, SHORT_SELLING_CONFIG } from '../config';
import { calculateTradeExecution } from '../utils/tradingMechanics';
import { LoanInfoDetails } from './LoanInfoDetails';
import { formatCurrency as formatCurrencyUtil, formatNumber as formatNumberUtil, formatPercent as formatPercentUtil, getFormatLocale } from '../utils/formatting';

// Stable fallback object for canShortInfo when no stock is selected (avoids selector re-render warnings)
const NO_STOCK_SHORT_INFO = { canShort: false, reason: 'no_stock' as const, availableShares: 0 };

/** Data for an advanced order */
export interface OrderData {
  symbol: string;
  type: TradeType;
  shares: number;
  orderType: OrderType;
  limitPrice?: number;
  stopPrice?: number;
  validityCycles: number;
  /** Loan request - only for buy orders that exceed available cash */
  loanRequest?: OrderLoanRequest;
  /** Collateral to lock - only for shortSell orders */
  collateralToLock?: number;
  /** Amount to add as margin - only for addMargin orders */
  marginAmount?: number;
}

interface TradePanelProps {
  stock: Stock | null;
  tradeType: TradeType;
  portfolio: Portfolio;
  gameMode: GameMode;
  isSymbolTradedThisCycle: boolean;
  /** Reserved cash for pending buy orders */
  reservedCash: number;
  /** Reserved shares of this symbol for pending sell orders */
  reservedSharesForSymbol: number;
  /** Order being edited (for edit mode) */
  editingOrder?: PendingOrder;
  onClose: () => void;
  onTrade: (orderData: OrderData) => void;
}

export const TradePanel = ({ stock, tradeType, portfolio, gameMode, isSymbolTradedThisCycle, reservedCash, reservedSharesForSymbol, editingOrder, onClose, onTrade }: TradePanelProps) => {
  const { t, i18n } = useTranslation();
  const locale = getFormatLocale(i18n.language);

  const formatCurrency = useCallback((value: number): string => {
    return formatCurrencyUtil(value, 2, locale);
  }, [locale]);

  const formatNumber = (value: number): string => {
    return formatNumberUtil(value, 0, locale);
  };

  const formatRate = (rate: number): string => {
    return formatPercentUtil(rate, 2, false, locale);
  };

  // Initialize values from editingOrder (for edit mode)
  const [shares, setShares] = useState(editingOrder?.shares ?? 0);
  const [error, setError] = useState('');
  const [orderType, setOrderType] = useState<OrderType>(editingOrder?.orderType ?? 'market');
  const [orderTypeOpen, setOrderTypeOpen] = useState(false);
  const [validityCycles, setValidityCycles] = useState(
    editingOrder?.remainingCycles ?? DEFAULT_ORDER_VALIDITY_CYCLES
  );
  const [limitPrice, setLimitPrice] = useState<number | ''>(editingOrder?.limitPrice ?? '');
  const [stopPrice, setStopPrice] = useState<number | ''>(editingOrder?.stopPrice ?? '');
  const [loanDurationCycles, setLoanDurationCycles] = useState(
    editingOrder?.loanRequest?.durationCycles ?? LOAN_CONFIG.defaultLoanDurationCycles
  );
  const [sharesAutoCorrected, setSharesAutoCorrected] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const orderTypeRef = useRef<HTMLDivElement>(null);

  // Generate loan duration options (same as LoanModal)
  const loanDurationOptions = useMemo(() => {
    const options: number[] = [];
    for (
      let cycles = LOAN_CONFIG.minLoanDurationCycles;
      cycles <= LOAN_CONFIG.maxLoanDurationCycles;
      cycles += LOAN_CONFIG.loanDurationStepCycles
    ) {
      options.push(cycles);
    }
    return options;
  }, []);

  const isEditMode = !!editingOrder;

  const showAdvancedOptions = true; // Always show advanced options (sandbox mode removed)

  // State for addMargin amount (separate from shares since it's a dollar amount)
  const [marginAmount, setMarginAmount] = useState(0);

  // Determine which order types are available based on trade type
  // For short trades and addMargin, we use simpler order types (market only for now)
  const orderTypes = useMemo(() => {
    if (tradeType === 'shortSell' || tradeType === 'buyToCover' || tradeType === 'addMargin') {
      // Short trades and margin additions only support market orders for simplicity
      return [{ id: 'market' as OrderType, name: 'market' }];
    }
    return tradeType === 'buy' ? BUY_ORDER_TYPES : SELL_ORDER_TYPES;
  }, [tradeType]);

  // Which price inputs are needed?
  const needsLimitPrice = orderType === 'limit' || orderType === 'stopBuyLimit';
  const needsStopPrice = orderType === 'stopBuy' || orderType === 'stopBuyLimit';

  // Validation for stop limit orders
  const stopLimitValidation = useMemo(() => {
    if (orderType !== 'stopBuyLimit') return { isValid: true, warning: '' };
    if (limitPrice === '' || stopPrice === '') return { isValid: true, warning: '' };

    const limit = limitPrice as number;
    const stop = stopPrice as number;

    if (tradeType === 'buy') {
      // Stop Buy Limit: Order is triggered when price >= stop, then only buys when price <= limit
      // Limit must be > stop, otherwise the order can never be meaningfully executed
      if (limit <= stop) {
        return {
          isValid: false,
          warning: t('trading.invalidStopBuyLimit'),
        };
      }
    } else {
      // Stop Loss Limit: Order is triggered when price <= stop, then only sells when price >= limit
      // Limit must be < stop, otherwise the order can never be meaningfully executed
      if (limit >= stop) {
        return {
          isValid: false,
          warning: t('trading.invalidStopLossLimit'),
        };
      }
    }

    return { isValid: true, warning: '' };
  }, [orderType, limitPrice, stopPrice, tradeType, t]);

  const mechanics = TRADING_MECHANICS[gameMode];
  const holding = portfolio.holdings.find(h => h.symbol === stock?.symbol);
  const ownedShares = holding?.shares ?? 0;

  // Get Market Maker spread multiplier for this stock
  const spreadMultiplier = useAppSelector(state =>
    stock ? selectSpreadMultiplier(state, stock.symbol) : 1.0
  );

  // Credit line information for loan integration
  const creditLineInfo = useAppSelector(selectCreditLineInfo);
  const canTakeLoanBase = useAppSelector(selectCanTakeLoanEffective);
  const effectiveLoanCountBase = useAppSelector(selectEffectiveLoanCount);
  const riskProfile = useAppSelector(selectRiskProfile);

  // When editing an order with a loan request, exclude it from the count
  // (since the old order's loan will be replaced by the new one)
  const editingOrderHasLoan = editingOrder?.loanRequest !== undefined;
  const effectiveLoanCount = editingOrderHasLoan
    ? effectiveLoanCountBase - 1
    : effectiveLoanCountBase;
  const canTakeLoan = editingOrderHasLoan
    ? effectiveLoanCount < LOAN_CONFIG.maxLoans
    : canTakeLoanBase;

  // Calculate if credit is available for this trade
  const hasCollateral = creditLineInfo.collateralBreakdown.total >= LOAN_CONFIG.minCollateralForLoan;
  const canUseLoan = (tradeType === 'buy' || tradeType === 'buyToCover') && canTakeLoan && hasCollateral;

  // ============================================================================
  // SHORT SELLING SUPPORT
  // ============================================================================

  // Get existing short position for this symbol (for buyToCover)
  const existingShortPosition = useAppSelector(state =>
    stock ? selectShortPositionBySymbol(state, stock.symbol) : undefined
  );

  // Get borrow status (easy/hard to borrow)
  const borrowStatus = useAppSelector(state =>
    stock ? selectBorrowStatus(state, stock.symbol) : 'easy'
  );

  // Check if shorting is allowed for this symbol
  const canShortInfo = useAppSelector(state =>
    stock ? selectCanShortSymbol(state, stock.symbol) : NO_STOCK_SHORT_INFO
  );

  // Total collateral locked for short positions (needed to limit selling)
  const totalLockedCollateral = useAppSelector(selectTotalLockedCollateral);

  // Calculate required margin for short sell
  const calculateShortMargin = useCallback((numShares: number, price: number): number => {
    return numShares * price * SHORT_SELLING_CONFIG.initialMarginPercent;
  }, []);

  // Calculate borrow fee per cycle
  const borrowFeePerCycle = useMemo(() => {
    const baseFee = SHORT_SELLING_CONFIG.baseBorrowFeePerCycle;
    return borrowStatus === 'hard'
      ? baseFee * SHORT_SELLING_CONFIG.hardToBorrowFeeMultiplier
      : baseFee;
  }, [borrowStatus]);

  // Max coverable shares = min(existing short position, affordable shares with cash + credit)
  const maxCoverSharesByPosition = existingShortPosition?.shares ?? 0;

  // Calculate unrealized P/L for buyToCover
  const shortProfitLoss = useMemo(() => {
    if (!existingShortPosition || !stock) return 0;
    return (existingShortPosition.entryPrice - stock.currentPrice) * existingShortPosition.shares;
  }, [existingShortPosition, stock]);

  // In edit mode: Release the reserved amounts of the order being edited
  // (since the old order will be replaced)
  const editingOrderReservedCash = editingOrder?.type === 'buy'
    ? editingOrder.shares * editingOrder.orderPrice
    : 0;
  const editingOrderReservedShares = editingOrder?.type === 'sell'
    ? editingOrder.shares
    : 0;

  // Available shares = owned shares - reserved shares + reserved shares of the order being edited
  const availableShares = Math.max(0, ownedShares - reservedSharesForSymbol + editingOrderReservedShares);
  // Available cash = total cash - reserved cash + reserved cash of the order being edited
  const availableCash = Math.max(0, portfolio.cash - reservedCash + editingOrderReservedCash);

  // Calculate max sellable shares considering short margin requirements
  // When selling stocks, the credit line decreases. We must ensure it stays above locked short collateral.
  const maxSellSharesWithShortConstraint = useMemo(() => {
    if (!stock || totalLockedCollateral <= 0) return availableShares;

    // Collateral ratio depends on market cap
    const collateralRatio = stock.marketCapBillions > LOAN_CONFIG.largeCapThresholdBillions
      ? LOAN_CONFIG.largeCapCollateralRatio
      : LOAN_CONFIG.smallCapCollateralRatio;

    // How much collateral can we lose while keeping credit line >= locked collateral?
    // Credit line = floor(totalCollateral / 1000) * 1000 * maxCreditLineMultiplier
    // We need: newCreditLine >= totalLockedCollateral
    // So: floor((totalCollateral - loss) / 1000) * 1000 * multiplier >= locked
    // Simplified: (totalCollateral - loss) >= locked / multiplier (approximately)
    const minRequiredCollateral = totalLockedCollateral / LOAN_CONFIG.maxCreditLineMultiplier;
    const maxCollateralLoss = Math.max(0, creditLineInfo.collateralBreakdown.total - minRequiredCollateral);

    // Convert collateral loss to shares
    const collateralPerShare = stock.currentPrice * collateralRatio;
    if (collateralPerShare <= 0) return availableShares;

    const maxSellableByCollateral = Math.floor(maxCollateralLoss / collateralPerShare);

    return Math.min(availableShares, maxSellableByCollateral);
  }, [stock, availableShares, totalLockedCollateral, creditLineInfo.collateralBreakdown.total]);

  const maxSellShares = maxSellSharesWithShortConstraint;
  const isSellLimitedByShortMargin = maxSellSharesWithShortConstraint < availableShares && totalLockedCollateral > 0;

  // Available margin for shorting = available credit only (not cash)
  // Short margin must come from credit line, which is backed by stock holdings
  const availableMarginForShort = creditLineInfo.availableCredit;

  // Max shortable shares based on available margin
  const maxShortableByMargin = useMemo(() => {
    if (!stock || tradeType !== 'shortSell') return 0;
    const marginRequired = stock.currentPrice * SHORT_SELLING_CONFIG.initialMarginPercent;
    if (marginRequired <= 0) return 0;
    return Math.floor(availableMarginForShort / marginRequired);
  }, [stock, tradeType, availableMarginForShort]);

  // Max shortable shares (min of margin limit and float limit)
  const maxShortShares = useMemo(() => {
    if (tradeType !== 'shortSell') return 0;
    return Math.min(maxShortableByMargin, canShortInfo.availableShares);
  }, [tradeType, maxShortableByMargin, canShortInfo.availableShares]);

  // Determine the execution price based on order type
  const executionPrice = useMemo(() => {
    if (!stock) return 0;
    switch (orderType) {
      case 'limit':
        return limitPrice !== '' ? (limitPrice as number) : stock.currentPrice;
      case 'stopBuy': // Stop Buy / Stop Loss
        return stopPrice !== '' ? (stopPrice as number) : stock.currentPrice;
      case 'stopBuyLimit': // Stop Buy Limit / Stop Loss Limit
        return limitPrice !== '' ? (limitPrice as number) : stock.currentPrice;
      default: // market
        return stock.currentPrice;
    }
  }, [stock, orderType, limitPrice, stopPrice]);

  // Is the execution price approximate (market/stop) or exact (limit)?
  const isApproxPrice = orderType === 'market' || orderType === 'stopBuy';

  // Calculate trade execution with all costs (including Market Maker spread)
  // For non-market orders, we use the specified price but still apply fees
  const tradeExecution: TradeExecution | null = useMemo(() => {
    if (!stock || shares <= 0) return null;
    // For market orders, include spread; for limit orders, no spread (exact price)
    const effectiveSpread = orderType === 'market' ? spreadMultiplier : 1.0;
    // Map short trade types to buy/sell for execution calculation
    // shortSell behaves like sell (selling shares), buyToCover behaves like buy (buying shares back)
    const executionType: 'buy' | 'sell' = (tradeType === 'buy' || tradeType === 'buyToCover') ? 'buy' : 'sell';
    return calculateTradeExecution(executionPrice, shares, executionType, mechanics, effectiveSpread);
  }, [stock, shares, tradeType, mechanics, spreadMultiplier, executionPrice, orderType]);

  // Max purchasable shares considering spread, slippage, fees, buffer, and available credit
  const maxBuyShares = useMemo(() => {
    if (!stock) return 0;

    // Apply cash buffer for market and stop orders (price can change before execution)
    const needsBuffer = orderType === 'market' || orderType === 'stopBuy';
    const bufferMultiplier = needsBuffer ? (1 - mechanics.marketOrderCashBuffer) : 1;
    const effectiveCash = availableCash * bufferMultiplier;

    // Total available funds = effective cash + available credit (if loan is possible)
    const totalAvailableFunds = canUseLoan
      ? effectiveCash + creditLineInfo.availableCredit
      : effectiveCash;

    // Use execution price for limit/stop orders, current price for market orders
    // This ensures maxBuyShares is calculated with the price the user will actually pay
    const priceForCalc = executionPrice > 0 ? executionPrice : stock.currentPrice;

    // Binary search for the maximum quantity
    let low = 0;
    let high = Math.floor(totalAvailableFunds / priceForCalc) + 10;
    let result = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (mid === 0) {
        low = mid + 1;
        continue;
      }
      const execution = calculateTradeExecution(priceForCalc, mid, 'buy', mechanics, spreadMultiplier);
      if (execution.total <= totalAvailableFunds) {
        result = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return result;
  }, [stock, availableCash, mechanics, spreadMultiplier, orderType, canUseLoan, creditLineInfo.availableCredit, executionPrice]);

  // Calculate if current order requires a loan and the loan details
  // Loans are available for both buy and buyToCover orders
  const loanRequirement = useMemo(() => {
    if (!tradeExecution || (tradeType !== 'buy' && tradeType !== 'buyToCover') || !canUseLoan) {
      return { needsLoan: false, loanAmount: 0, interestRate: 0, interestBreakdown: null, durationCycles: loanDurationCycles };
    }

    // Apply buffer for effective cash calculation
    const needsBuffer = orderType === 'market' || orderType === 'stopBuy';
    const bufferMultiplier = needsBuffer ? (1 - mechanics.marketOrderCashBuffer) : 1;
    const effectiveCash = availableCash * bufferMultiplier;

    if (tradeExecution.total <= effectiveCash) {
      return { needsLoan: false, loanAmount: 0, interestRate: 0, interestBreakdown: null, durationCycles: loanDurationCycles };
    }

    const loanAmount = Math.ceil(tradeExecution.total - effectiveCash);

    // Check if loan amount is within available credit
    if (loanAmount > creditLineInfo.availableCredit) {
      return { needsLoan: false, loanAmount: 0, interestRate: 0, interestBreakdown: null, durationCycles: loanDurationCycles };
    }

    // Calculate interest rate at the time of order creation (will be locked in)
    // Now includes duration for duration-based discount
    const newUtilization = (creditLineInfo.currentDebt + loanAmount) / creditLineInfo.maxCreditLine;
    const interestBreakdown = calculateInterestRate(
      riskProfile?.riskScore ?? null,
      riskProfile?.totalRealizedProfitLoss ?? 0,
      newUtilization,
      effectiveLoanCount,
      riskProfile?.totalTrades ?? 0,
      LOAN_CONFIG.initialCreditScore, // Use default credit score for now
      loanDurationCycles
    );

    return {
      needsLoan: true,
      loanAmount,
      interestRate: interestBreakdown.effectiveRate,
      interestBreakdown,
      originationFee: loanAmount * LOAN_CONFIG.originationFeePercent,
      durationCycles: loanDurationCycles,
    };
  }, [tradeExecution, tradeType, canUseLoan, availableCash, orderType, mechanics.marketOrderCashBuffer, creditLineInfo, riskProfile, effectiveLoanCount, loanDurationCycles]);

  // Max coverable shares limited by available funds (cash + credit)
  const maxCoverShares = useMemo(() => {
    if (tradeType !== 'buyToCover') return maxCoverSharesByPosition;
    return Math.min(maxCoverSharesByPosition, maxBuyShares);
  }, [tradeType, maxCoverSharesByPosition, maxBuyShares]);

  // Whether cover is limited by funds rather than position size
  const isCoverLimitedByFunds = tradeType === 'buyToCover' && maxBuyShares < maxCoverSharesByPosition;

  // Check if shares exceed maximum
  const maxShares = useMemo(() => {
    switch (tradeType) {
      case 'buy': return maxBuyShares;
      case 'sell': return maxSellShares;
      case 'shortSell': return maxShortShares;
      case 'buyToCover': return maxCoverShares;
      case 'addMargin': return 0; // Not applicable for addMargin
      default: return 0;
    }
  }, [tradeType, maxBuyShares, maxSellShares, maxShortShares, maxCoverShares]);
  const isOverMax = tradeType === 'addMargin'
    ? marginAmount > availableCash && availableCash > 0
    : shares > maxShares && maxShares > 0;

  // Check if buyToCover has insufficient funds (cash + loan not enough)
  const insufficientFundsForCover = useMemo(() => {
    if (tradeType !== 'buyToCover' || !tradeExecution || shares <= 0) return false;
    const needsBuffer = orderType === 'market' || orderType === 'stopBuy';
    const bufferMultiplier = needsBuffer ? (1 - mechanics.marketOrderCashBuffer) : 1;
    const effectiveCash = availableCash * bufferMultiplier;
    const totalAvailable = canUseLoan
      ? effectiveCash + creditLineInfo.availableCredit
      : effectiveCash;
    return tradeExecution.total > totalAvailable;
  }, [tradeType, tradeExecution, shares, orderType, mechanics.marketOrderCashBuffer, availableCash, canUseLoan, creditLineInfo.availableCredit]);

  // Auto-correct shares when limit/stop price change makes current amount unaffordable
  // This provides better UX by automatically adjusting instead of just showing a warning
  useEffect(() => {
    if (tradeType !== 'buy') return;
    if (shares > maxBuyShares && maxBuyShares > 0) {
      setShares(maxBuyShares);
      // Show auto-correction message (orange warning instead of red)
      setSharesAutoCorrected(true);
    }
    // Note: shares is intentionally NOT in deps to avoid infinite loop
    // We only want to trigger when maxBuyShares changes (due to price changes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxBuyShares, tradeType]);

  // For display: freeze calculation at max when exceeded
  const displayTradeExecution: TradeExecution | null = useMemo(() => {
    if (!stock) return null;
    const displayShares = isOverMax ? maxShares : shares;
    if (displayShares <= 0) return null;
    const effectiveSpread = orderType === 'market' ? spreadMultiplier : 1.0;
    const executionType: 'buy' | 'sell' = (tradeType === 'buy' || tradeType === 'buyToCover') ? 'buy' : 'sell';
    return calculateTradeExecution(executionPrice, displayShares, executionType, mechanics, effectiveSpread);
  }, [stock, shares, maxShares, isOverMax, tradeType, mechanics, spreadMultiplier, executionPrice, orderType]);

  // Close dropdown when clicking outside
  useClickOutside(orderTypeRef, useCallback(() => setOrderTypeOpen(false), []));

  if (!stock) return null;

  const handleSubmit = (): void => {
    // Special handling for addMargin
    if (tradeType === 'addMargin') {
      if (marginAmount <= 0) {
        setError(t('common.invalidAmount'));
        return;
      }
      if (marginAmount > availableCash) {
        setError(t('common.insufficientFunds'));
        return;
      }
      const orderData: OrderData = {
        symbol: stock!.symbol,
        type: 'addMargin',
        shares: 0,
        orderType: 'market',
        validityCycles: 0,
        marginAmount,
      };
      onTrade(orderData);
      onClose();
      return;
    }

    if (shares <= 0) {
      setError(t('errors.invalidQuantity'));
      return;
    }

    // Short sell validation
    if (tradeType === 'shortSell') {
      if (!SHORT_SELLING_CONFIG.enabled) {
        setError(t('shorts.errors.shortSellingDisabled'));
        return;
      }
      if (!canShortInfo.canShort) {
        setError(t(`shorts.errors.${canShortInfo.reason === 'max_short_reached' ? 'exceedsMaxShort' : 'noSharesAvailable'}`));
        return;
      }
      const requiredMargin = calculateShortMargin(shares, stock!.currentPrice);
      if (requiredMargin > availableMarginForShort) {
        setError(t('shorts.errors.insufficientCollateral'));
        return;
      }
      if (shares > maxShortShares) {
        setError(t('shorts.errors.exceedsMaxShort'));
        return;
      }
    }

    // Buy to cover validation
    if (tradeType === 'buyToCover') {
      if (!existingShortPosition) {
        setError(t('shorts.errors.positionNotFound'));
        return;
      }
      if (shares > maxCoverSharesByPosition) {
        setError(t('errors.insufficientShares'));
        return;
      }
      // Check if there's enough cash (+ potential loan) to cover
      if (tradeExecution) {
        const needsBuffer = orderType === 'market' || orderType === 'stopBuy';
        const bufferMultiplier = needsBuffer ? (1 - mechanics.marketOrderCashBuffer) : 1;
        const effectiveCash = availableCash * bufferMultiplier;
        const totalAvailable = loanRequirement.needsLoan
          ? effectiveCash + creditLineInfo.availableCredit
          : effectiveCash;

        if (tradeExecution.total > totalAvailable) {
          setError(t('errors.insufficientCash'));
          return;
        }
      }
    }

    // Regular buy/sell validation
    if (tradeType === 'buy' || tradeType === 'sell') {
      if (!tradeExecution) {
        setError(t('errors.invalidQuantity'));
        return;
      }

      // Calculate effective cash with buffer for market/stop orders
      const needsBuffer = orderType === 'market' || orderType === 'stopBuy';
      const bufferMultiplier = needsBuffer ? (1 - mechanics.marketOrderCashBuffer) : 1;
      const effectiveCash = availableCash * bufferMultiplier;

      if (tradeType === 'buy') {
        // Check if order can be fulfilled with cash + loan
        const totalAvailable = loanRequirement.needsLoan
          ? effectiveCash + creditLineInfo.availableCredit
          : effectiveCash;

        if (tradeExecution.total > totalAvailable) {
          setError(t('errors.insufficientCash'));
          return;
        }
      } else {
        if (shares > maxSellShares) {
          setError(t('errors.insufficientShares'));
          return;
        }
      }
    }

    // Validate limit price
    if (needsLimitPrice && (limitPrice === '' || limitPrice <= 0)) {
      setError(t('errors.invalidLimitPrice'));
      return;
    }

    // Validate stop price
    if (needsStopPrice && (stopPrice === '' || stopPrice <= 0)) {
      setError(t('errors.invalidStopPrice'));
      return;
    }

    // Calculate validity cycles
    // Market orders are executed immediately, all others have a validity period
    const cycles = orderType === 'market' ? 0 : validityCycles;

    // Calculate collateral for short sell
    const collateralToLock = tradeType === 'shortSell'
      ? calculateShortMargin(shares, stock!.currentPrice)
      : undefined;

    const orderData: OrderData = {
      symbol: stock!.symbol,
      type: tradeType,
      shares,
      orderType,
      limitPrice: needsLimitPrice ? (limitPrice as number) : undefined,
      stopPrice: needsStopPrice ? (stopPrice as number) : undefined,
      validityCycles: cycles,
      // Include loan request if loan is needed (with duration)
      loanRequest: loanRequirement.needsLoan ? {
        amount: loanRequirement.loanAmount,
        interestRate: loanRequirement.interestRate,
        durationCycles: loanDurationCycles,
      } : undefined,
      // Include collateral for short sell
      collateralToLock,
    };

    onTrade(orderData);
    onClose();
  };

  const handleMaxClick = (): void => {
    switch (tradeType) {
      case 'buy':
        setShares(maxBuyShares);
        break;
      case 'sell':
        setShares(maxSellShares);
        break;
      case 'shortSell':
        setShares(maxShortShares);
        break;
      case 'buyToCover':
        setShares(maxCoverShares);
        break;
      case 'addMargin':
        setMarginAmount(Math.floor(availableCash));
        break;
    }
  };

  const handleOrderTypeChange = (newType: OrderType): void => {
    setOrderType(newType);
    setOrderTypeOpen(false);

    if (!stock) return;

    // Set default prices based on new order type
    const newNeedsStopPrice = newType === 'stopBuy' || newType === 'stopBuyLimit';
    const newNeedsLimitPrice = newType === 'limit' || newType === 'stopBuyLimit';

    if (newNeedsStopPrice) {
      setStopPrice(Math.round(stock.currentPrice * 100) / 100);
    } else {
      setStopPrice('');
    }

    if (newNeedsLimitPrice) {
      // For stop limit orders: Set limit price with offset so validation is immediately satisfied
      if (newType === 'stopBuyLimit') {
        const offset = tradeType === 'buy' ? 0.01 : -0.01;
        setLimitPrice(Math.round(Math.max(0.01, stock.currentPrice + offset) * 100) / 100);
      } else {
        setLimitPrice(Math.round(stock.currentPrice * 100) / 100);
      }
    } else {
      setLimitPrice('');
    }
  };

  // Helper to get trade type label
  const getTradeTypeLabel = (): string => {
    if (isEditMode) return `${t('trading.editOrder')}: `;
    switch (tradeType) {
      case 'buy': return `${t('trading.buy')}: `;
      case 'sell': return `${t('trading.sell')}: `;
      case 'shortSell': return `${t('shorts.shortSell')}: `;
      case 'buyToCover': return `${t('shorts.buyToCover')}: `;
      case 'addMargin': return `${t('shorts.addMargin')}: `;
      default: return '';
    }
  };

  return (
    <div className={`trade-panel trade-panel--${tradeType}${isEditMode ? ' trade-panel--editing' : ''}`} ref={panelRef}>
      <div className="trade-panel__header">
        <h3>
          {getTradeTypeLabel()}
          {stock.symbol}
        </h3>
        <button className="trade-panel__close-btn" onClick={onClose}>&times;</button>
      </div>

      <div className="trade-panel__body">
        <div className="trade-panel__stock-info">
          <p><strong>{stock.name}</strong></p>
          <p>{t('trading.currentPrice')}: <span className="trade-panel__price">{formatCurrency(stock.currentPrice)}</span></p>
        </div>

        <div className="trade-panel__trade-info">
          {tradeType === 'buy' && (
            <>
              <p>{t('trading.availableCash')}: {formatCurrency(availableCash)}</p>
              {reservedCash > 0 && (
                <p className="trade-panel__reserved-info">{t('trading.reservedForOrders')}: {formatCurrency(reservedCash)}</p>
              )}
              {canUseLoan && creditLineInfo.availableCredit > 0 && (
                <p className="trade-panel__credit-info">
                  {t('trading.availableCredit')}: {formatCurrency(creditLineInfo.availableCredit)}
                </p>
              )}
            </>
          )}
          {tradeType === 'sell' && (
            <>
              <p>{t('trading.availableShares')}: {formatNumber(availableShares)}</p>
              {reservedSharesForSymbol > 0 && (
                <p className="trade-panel__reserved-info">{t('trading.reservedForOrders')}: {formatNumber(reservedSharesForSymbol)}</p>
              )}
              {isSellLimitedByShortMargin && maxSellShares < availableShares && (
                <p className="trade-panel__collateral-warning">
                  {maxSellShares === 0
                    ? t('trading.sellBlockedByShortCollateral')
                    : t('trading.sellLimitedByShortCollateral', { max: formatNumber(maxSellShares) })}
                </p>
              )}
            </>
          )}
          {tradeType === 'shortSell' && (
            <>
              <p>{t('shorts.maxShortable')}: {formatNumber(maxShortShares)}</p>
              <p>{t('shorts.collateral')} ({formatPercentUtil(SHORT_SELLING_CONFIG.initialMarginPercent, 0, false, locale)}): {formatCurrency(availableMarginForShort)}</p>
              <p
                className={`trade-panel__borrow-status trade-panel__borrow-status--${borrowStatus}`}
                title={t(`shorts.${borrowStatus === 'hard' ? 'hardToBorrowHint' : 'easyToBorrowHint'}`)}
              >
                {t('shorts.borrowFee')}: {formatPercentUtil(borrowFeePerCycle, 2, false, locale)}/{t('shorts.cycle')}
                {borrowStatus === 'hard' && ` (${SHORT_SELLING_CONFIG.hardToBorrowFeeMultiplier}x)`}
              </p>
            </>
          )}
          {tradeType === 'buyToCover' && existingShortPosition && (
            <>
              <p>{t('shorts.position')}: {formatNumber(existingShortPosition.shares)} @ {formatCurrency(existingShortPosition.entryPrice)}</p>
              <p className={shortProfitLoss >= 0 ? 'trade-panel__profit' : 'trade-panel__loss'}>
                {t('shorts.profitLoss')}: {formatCurrency(shortProfitLoss)}
              </p>
              <p>{t('shorts.collateral')}: {formatCurrency(existingShortPosition.collateralLocked)}</p>
              <p>{t('trading.availableCash')}: {formatCurrency(availableCash)}</p>
              {canUseLoan && creditLineInfo.availableCredit > 0 && (
                <p className="trade-panel__credit-info">
                  {t('trading.availableCredit')}: {formatCurrency(creditLineInfo.availableCredit)}
                </p>
              )}
              {isCoverLimitedByFunds && !insufficientFundsForCover && (
                <p className="trade-panel__collateral-warning">
                  {t('shorts.coverLimitedByFunds', { max: formatNumber(maxCoverShares), total: formatNumber(maxCoverSharesByPosition) })}
                </p>
              )}
              {insufficientFundsForCover && (
                <p className="trade-panel__collateral-warning">
                  {t('errors.insufficientCash')}
                </p>
              )}
            </>
          )}
          {tradeType === 'addMargin' && existingShortPosition && (
            <>
              <p>{t('shorts.position')}: {formatNumber(existingShortPosition.shares)} @ {formatCurrency(existingShortPosition.entryPrice)}</p>
              <p>{t('shorts.collateral')}: {formatCurrency(existingShortPosition.collateralLocked)}</p>
              <p>{t('trading.availableCash')}: {formatCurrency(availableCash)}</p>
            </>
          )}
        </div>

        {tradeType === 'addMargin' ? (
          <div className="trade-panel__input-group">
            <label htmlFor="trade-margin-amount">{t('shorts.addMarginAmount')}:</label>
            <div className="trade-panel__input-with-btn">
              <div className="trade-panel__price-input">
                <span className="trade-panel__currency-symbol">$</span>
                <input
                  id="trade-margin-amount"
                  type="number"
                  min="1"
                  max={availableCash}
                  value={marginAmount || ''}
                  onChange={(e) => {
                    setMarginAmount(Math.max(0, parseFloat(e.target.value) || 0));
                    setError('');
                  }}
                  className={isOverMax ? 'trade-panel__input--exceeded' : ''}
                />
              </div>
              <button className="trade-panel__max-btn" onClick={handleMaxClick}>{t('common.max')}</button>
            </div>
            {isOverMax && (
              <span className="trade-panel__max-warning">
                {t('common.insufficientFunds')}
              </span>
            )}
          </div>
        ) : (
          <div className="trade-panel__input-group">
            <label htmlFor="trade-shares">{t('trading.quantity')}:</label>
            <div className="trade-panel__input-with-btn">
              <input
                id="trade-shares"
                type="number"
                min="1"
                max={maxShares}
                value={shares}
                onChange={(e) => {
                  setShares(Math.max(0, parseInt(e.target.value) || 0));
                  setSharesAutoCorrected(false); // Clear auto-correction message on manual input
                  setError('');
                }}
                className={isOverMax ? 'trade-panel__input--exceeded' : ''}
              />
              <button className="trade-panel__max-btn" onClick={handleMaxClick}>{t('common.max')}</button>
            </div>
            {isOverMax && (
              <span className="trade-panel__max-warning">
                {tradeType === 'buy' && t('trading.exceedsMaxBuy', { max: formatNumber(maxShares), cash: formatCurrency(availableCash + (canUseLoan ? creditLineInfo.availableCredit : 0)) })}
                {tradeType === 'sell' && (isSellLimitedByShortMargin
                  ? t('trading.exceedsMaxSellShortMargin', { max: formatNumber(maxShares) })
                  : t('trading.exceedsMaxSell', { max: formatNumber(maxShares) }))}
                {tradeType === 'shortSell' && t('shorts.errors.exceedsMaxShort')}
                {tradeType === 'buyToCover' && t('trading.exceedsMaxSell', { max: formatNumber(maxShares) })}
              </span>
            )}
            {sharesAutoCorrected && !isOverMax && (
              <span className="trade-panel__auto-corrected-warning">
                {t('trading.sharesAutoCorrected', { max: formatNumber(shares), cash: formatCurrency(availableCash + (canUseLoan ? creditLineInfo.availableCredit : 0)) })}
              </span>
            )}
          </div>
        )}

        {showAdvancedOptions && (
          <>
            {/* Only show order type dropdown if there are multiple options */}
            {orderTypes.length > 1 && (
              <div className="trade-panel__input-group">
                <label htmlFor="trade-order-type">{t('trading.type')}:</label>
                <div className="trade-panel__order-type" ref={orderTypeRef}>
                  <button
                    id="trade-order-type"
                    className={`trade-panel__order-type-trigger${orderTypeOpen ? ' trade-panel__order-type-trigger--open' : ''}`}
                    onClick={() => setOrderTypeOpen(!orderTypeOpen)}
                  >
                    {/* Use 'buy' translations for shortSell, 'sell' for buyToCover */}
                    <span>{t(`orderTypes.${tradeType === 'shortSell' ? 'buy' : tradeType === 'buyToCover' ? 'sell' : tradeType}.${orderType}`)}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7 10l5 5 5-5z"/>
                    </svg>
                  </button>
                  {orderTypeOpen && (
                    <div className="trade-panel__order-type-options">
                      {orderTypes.map((type) => (
                        <button
                          key={type.id}
                          className={`trade-panel__order-type-option${type.id === orderType ? ' trade-panel__order-type-option--active' : ''}`}
                          onClick={() => handleOrderTypeChange(type.id)}
                        >
                          {t(`orderTypes.${tradeType === 'shortSell' ? 'buy' : tradeType === 'buyToCover' ? 'sell' : tradeType}.${type.id}`)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Stop-Preis Input */}
            {needsStopPrice && (
              <div className="trade-panel__input-group">
                <label htmlFor="trade-stop-price">{t('trading.stopPrice')}:</label>
                <div className="trade-panel__price-input">
                  <span className="trade-panel__currency-symbol">$</span>
                  <input
                    id="trade-stop-price"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={stopPrice}
                    onChange={(e) => setStopPrice(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    placeholder={stock.currentPrice.toFixed(2)}
                  />
                </div>
                <span className="trade-panel__price-hint">
                  {tradeType === 'buy'
                    ? t('trading.stopHintBuy')
                    : t('trading.stopHintSell')}
                </span>
              </div>
            )}

            {/* Limit-Preis Input */}
            {needsLimitPrice && (
              <div className="trade-panel__input-group">
                <label htmlFor="trade-limit-price">{t('trading.limitPrice')}:</label>
                <div className="trade-panel__price-input">
                  <span className="trade-panel__currency-symbol">$</span>
                  <input
                    id="trade-limit-price"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    placeholder={stock.currentPrice.toFixed(2)}
                  />
                </div>
                <span className="trade-panel__price-hint">
                  {tradeType === 'buy'
                    ? t('trading.limitHintBuy')
                    : t('trading.limitHintSell')}
                </span>
              </div>
            )}

            {/* Warning for invalid stop limit price combination */}
            {!stopLimitValidation.isValid && (
              <div className="trade-panel__stop-limit-warning">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                </svg>
                <span>{stopLimitValidation.warning}</span>
              </div>
            )}

            {orderType !== 'market' && (
              <div className="trade-panel__input-group">
                <label htmlFor="trade-validity">{t('trading.validity')}:</label>
                <div className="trade-panel__validity-input">
                  <input
                    id="trade-validity"
                    type="number"
                    min="1"
                    max="100"
                    value={validityCycles}
                    onChange={(e) => setValidityCycles(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>
                <span className="trade-panel__price-hint">{t('trading.tradingCycles')}</span>
              </div>
            )}
          </>
        )}

        {/* Loan section when order requires credit */}
        {loanRequirement.needsLoan && tradeExecution && shares > 0 && loanRequirement.interestBreakdown && (
          <div className="trade-panel__loan-section">
            <div className="trade-panel__loan-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
              </svg>
              <span>{t('trading.loanRequired')}</span>
            </div>

            {/* 1. Loan Amount */}
            <div className="trade-panel__loan-row">
              <span className="trade-panel__loan-label">{t('trading.loanAmount')}:</span>
              <span className="trade-panel__loan-value">{formatCurrency(loanRequirement.loanAmount)}</span>
            </div>

            {/* 2. Duration Options */}
            <div className="trade-panel__loan-duration">
              <span className="trade-panel__loan-label">{t('loans.duration')}:</span>
              <div className="trade-panel__loan-duration-options">
                {loanDurationOptions.map(cycles => (
                  <button
                    key={cycles}
                    type="button"
                    className={`trade-panel__loan-duration-btn${loanDurationCycles === cycles ? ' trade-panel__loan-duration-btn--selected' : ''}`}
                    onClick={() => setLoanDurationCycles(cycles)}
                  >
                    {cycles}
                  </button>
                ))}
              </div>
              <span className="trade-panel__loan-duration-unit">{t('loans.cycles')}</span>
            </div>

            {/* 3. Effective Interest Rate */}
            <div className="trade-panel__loan-row">
              <span className="trade-panel__loan-label">{t('loans.effectiveRate')}:</span>
              <span className="trade-panel__loan-value">{formatRate(loanRequirement.interestRate)}</span>
            </div>

            {/* 4. Origination Fee */}
            <div className="trade-panel__loan-row">
              <span className="trade-panel__loan-label">
                {t('loans.originationFee')} ({formatRate(LOAN_CONFIG.originationFeePercent)}):
              </span>
              <span className="trade-panel__loan-value">{formatCurrency(loanRequirement.originationFee ?? 0)}</span>
            </div>

            {/* 5. Conditions (expandable) */}
            <LoanInfoDetails
              creditLineInfo={creditLineInfo}
              interestBreakdown={loanRequirement.interestBreakdown}
            />
          </div>
        )}

        {/* Short Sell Breakdown */}
        {tradeType === 'shortSell' && shares > 0 && stock && (
          <div className={`trade-panel__breakdown trade-panel__breakdown--short${isOverMax ? ' trade-panel__breakdown--exceeded' : ''}`}>
            <div className="trade-panel__breakdown-row">
              <span>{t('trading.rate')}:</span>
              <span>{formatCurrency(stock.currentPrice)}</span>
            </div>
            <div className="trade-panel__breakdown-row">
              <span>{t('trading.quantityTimesRate')}:</span>
              <span>{formatCurrency(stock.currentPrice * (isOverMax ? maxShares : shares))}</span>
            </div>
            <div className="trade-panel__breakdown-row">
              <span>{t('shorts.marginRequired')} ({formatPercentUtil(SHORT_SELLING_CONFIG.initialMarginPercent, 0, false, locale)}):</span>
              <span>{formatCurrency(calculateShortMargin(isOverMax ? maxShares : shares, stock.currentPrice))}</span>
            </div>
            <div className="trade-panel__breakdown-row">
              <span>{t('shorts.borrowFee')}/Zyklus ({formatPercentUtil(borrowFeePerCycle * 100, 2, false, locale)}):</span>
              <span>{formatCurrency(stock.currentPrice * (isOverMax ? maxShares : shares) * borrowFeePerCycle)}</span>
            </div>
            <div className="trade-panel__breakdown-hint">
              {t('shorts.marginCallWarning').replace('{{percent}}', String(SHORT_SELLING_CONFIG.maintenanceMarginPercent * 100))}
            </div>
          </div>
        )}

        {/* Buy to Cover Breakdown */}
        {tradeType === 'buyToCover' && shares > 0 && stock && existingShortPosition && (
          <div className={`trade-panel__breakdown trade-panel__breakdown--cover${isOverMax ? ' trade-panel__breakdown--exceeded' : ''}`}>
            <div className="trade-panel__breakdown-row">
              <span>{t('shorts.entryPrice')}:</span>
              <span>{formatCurrency(existingShortPosition.entryPrice)}</span>
            </div>
            <div className="trade-panel__breakdown-row">
              <span>{t('trading.currentPrice')}:</span>
              <span>{formatCurrency(stock.currentPrice)}</span>
            </div>
            <div className="trade-panel__breakdown-row">
              <span>{t('trading.totalCost')}:</span>
              <span>{formatCurrency(stock.currentPrice * (isOverMax ? maxShares : shares))}</span>
            </div>
            {(() => {
              const coverShares = isOverMax ? maxShares : shares;
              const coverPL = (existingShortPosition.entryPrice - stock.currentPrice) * coverShares;
              return (
                <div className={`trade-panel__breakdown-row trade-panel__breakdown-row--total${coverPL >= 0 ? ' trade-panel__breakdown-row--profit' : ' trade-panel__breakdown-row--loss'}`}>
                  <span>{t('shorts.profitLoss')}:</span>
                  <span>{formatCurrency(coverPL)}</span>
                </div>
              );
            })()}
          </div>
        )}

        {/* Add Margin Breakdown */}
        {tradeType === 'addMargin' && marginAmount > 0 && existingShortPosition && (
          <div className={`trade-panel__breakdown trade-panel__breakdown--margin${isOverMax ? ' trade-panel__breakdown--exceeded' : ''}`}>
            <div className="trade-panel__breakdown-row">
              <span>{t('shorts.currentCollateral')}:</span>
              <span>{formatCurrency(existingShortPosition.collateralLocked)}</span>
            </div>
            <div className="trade-panel__breakdown-row">
              <span>{t('shorts.addingMargin')}:</span>
              <span>{formatCurrency(marginAmount)}</span>
            </div>
            <div className="trade-panel__breakdown-row trade-panel__breakdown-row--total">
              <span>{t('shorts.newCollateral')}:</span>
              <span>{formatCurrency(existingShortPosition.collateralLocked + marginAmount)}</span>
            </div>
          </div>
        )}

        {/* Regular Buy/Sell Breakdown */}
        {(tradeType === 'buy' || tradeType === 'sell') && displayTradeExecution && shares > 0 && (
          <div className={`trade-panel__breakdown${isOverMax ? ' trade-panel__breakdown--exceeded' : ''}`}>
            {/* Show different rate labels based on order type */}
            <div className="trade-panel__breakdown-row">
              <span>
                {orderType === 'market' && t('trading.rate')}
                {orderType === 'limit' && t('trading.limitPrice')}
                {orderType === 'stopBuy' && t('trading.stopPrice')}
                {orderType === 'stopBuyLimit' && t('trading.limitPrice')}
                :
              </span>
              <span>{formatCurrency(executionPrice)}</span>
            </div>

            {/* For stop limit orders, also show the trigger price */}
            {orderType === 'stopBuyLimit' && stopPrice !== '' && (
              <div className="trade-panel__breakdown-row trade-panel__breakdown-row--secondary">
                <span>{t('trading.triggerAt')}:</span>
                <span>{formatCurrency(stopPrice as number)}</span>
              </div>
            )}

            {/* Quantity × Rate - use displayShares (clamped) for display */}
            <div className="trade-panel__breakdown-row">
              <span>{t('trading.quantityTimesRate')}:</span>
              <span>{formatCurrency(executionPrice * (isOverMax ? maxShares : shares))}</span>
            </div>

            {displayTradeExecution.fee > 0 && (
              <div className="trade-panel__breakdown-row">
                <span>{t('trading.orderFee')}:</span>
                <span className="trade-panel__breakdown-fee">{formatCurrency(displayTradeExecution.fee)}</span>
              </div>
            )}

            <div className="trade-panel__breakdown-row trade-panel__breakdown-row--total">
              <span>{tradeType === 'buy' ? t('trading.totalCost') : t('trading.netProceeds')}:</span>
              <span className="trade-panel__total-value">
                {isApproxPrice && `${t('trading.approx')} `}{formatCurrency(displayTradeExecution.total)}
              </span>
            </div>

            {/* Order type specific hints */}
            {orderType === 'market' && (
              <div className="trade-panel__breakdown-hint">
                {t('trading.priceDeviation')}
              </div>
            )}

            {orderType === 'limit' && (
              <div className="trade-panel__breakdown-hint">
                {tradeType === 'buy'
                  ? t('trading.limitBuyHint')
                  : t('trading.limitSellHint')}
              </div>
            )}

            {orderType === 'stopBuy' && (
              <div className="trade-panel__breakdown-hint">
                {tradeType === 'buy'
                  ? t('trading.stopBuyHint')
                  : t('trading.stopSellHint')}
              </div>
            )}

            {orderType === 'stopBuyLimit' && (
              <div className="trade-panel__breakdown-hint">
                {tradeType === 'buy'
                  ? t('trading.stopBuyLimitHint')
                  : t('trading.stopSellLimitHint')}
              </div>
            )}
          </div>
        )}

        {error && <p className="trade-panel__error">{error}</p>}
      </div>

      <div className="trade-panel__footer">
        <button className="trade-panel__cancel-btn" onClick={onClose}>{t('common.cancel')}</button>
        <button
          className={`trade-panel__confirm-btn trade-panel__confirm-btn--${tradeType}${loanRequirement.needsLoan ? ' trade-panel__confirm-btn--with-loan' : ''}`}
          onClick={handleSubmit}
          disabled={
            tradeType === 'addMargin'
              ? marginAmount <= 0 || marginAmount > availableCash
              : (!isEditMode && isSymbolTradedThisCycle) || shares <= 0 || !stopLimitValidation.isValid || shares > maxShares || insufficientFundsForCover
          }
        >
          {isEditMode
            ? t('trading.updateOrder')
            : loanRequirement.needsLoan
              ? t('trading.buyWithLoan')
              : (orderType === 'market'
                  ? (tradeType === 'buy' ? t('trading.buy')
                    : tradeType === 'sell' ? t('trading.sell')
                    : tradeType === 'shortSell' ? t('shorts.shortSell')
                    : tradeType === 'buyToCover' ? t('shorts.buyToCover')
                    : t('shorts.addMargin'))
                  : t('trading.placeOrder'))}
        </button>
      </div>
    </div>
  );
}

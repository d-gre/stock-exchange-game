import { useTranslation } from 'react-i18next';
import { EditIcon, CloseIcon } from './Icons';
import type { PendingOrder, OrderType } from '../types';
import { formatCurrency, formatNumber as formatNumberUtil, getFormatLocale } from '../utils/formatting';

interface PortfolioOrdersProps {
  pendingOrders: PendingOrder[];
  failedOrderIds: string[];
  onCancelOrder: (orderId: string) => void;
  onEditOrder: (order: PendingOrder) => void;
}

/**
 * Displays the list of pending orders
 */
export const PortfolioOrders = ({
  pendingOrders,
  failedOrderIds,
  onCancelOrder,
  onEditOrder,
}: PortfolioOrdersProps) => {
  const { i18n, t } = useTranslation();
  const locale = getFormatLocale(i18n.language);

  const formatMoney = (num: number, decimals: number = 2): string => {
    return formatCurrency(num, decimals, locale);
  };

  const formatNum = (num: number, decimals: number = 0): string => {
    return formatNumberUtil(num, decimals, locale);
  };

  const getOrderTypeName = (orderType: OrderType, isBuy: boolean): string => {
    const key = isBuy ? 'buy' : 'sell';
    return t(`orderTypes.${key}.${orderType}`);
  };

  return (
    <div className="portfolio-orders">
      <h3 className="portfolio-orders__title">{t('portfolio.orders')}</h3>
      {pendingOrders.length > 0 ? (
        <div className="portfolio-orders__list">
          {pendingOrders.map((order) => {
            const isFailed = failedOrderIds.includes(order.id);
            return (
            <div
              key={order.id}
              className={`portfolio__list-item ${
                order.type === 'buy' || order.type === 'buyToCover'
                  ? 'portfolio__list-item--border-positive'
                  : 'portfolio__list-item--border-negative'
              } portfolio-orders__row${isFailed ? ' portfolio-orders__row--failed' : ''}`}
            >
              <div className="portfolio-orders__content">
                {/* Row 1: Type, Order Kind, Symbol */}
                <div className="portfolio-orders__line portfolio-orders__line--header">
                  <span
                    className={`portfolio-orders__type ${
                      order.type === 'buy' || order.type === 'buyToCover'
                        ? 'portfolio-orders__type--buy'
                        : 'portfolio-orders__type--sell'
                    }`}
                  >
                    {t(`portfolio.${order.type}`)}
                  </span>
                  {/* Only show order kind for regular buy/sell (shorts are always market orders) */}
                  {(order.type === 'buy' || order.type === 'sell') && (
                    <span className="portfolio-orders__kind">
                      {getOrderTypeName(order.orderType, order.type === 'buy')}
                    </span>
                  )}
                  <span className="portfolio-orders__symbol">{order.symbol}</span>
                </div>
                {/* Row 2: Quantity × Price, Total */}
                <div className="portfolio-orders__line portfolio-orders__line--values">
                  <span className="portfolio-orders__details">
                    {formatNum(order.shares)} × {formatMoney(order.orderPrice)}
                  </span>
                  <span className="portfolio-orders__total">
                    {formatMoney(order.shares * order.orderPrice)}
                  </span>
                </div>
                {/* Row 3: Status/Cycles */}
                <div className="portfolio-orders__line portfolio-orders__line--status">
                  <span
                    className="portfolio-orders__cycles"
                    title={t('portfolio.remainingCycles')}
                  >
                    {isFailed
                      ? t('portfolio.executionFailed')
                      : order.isNew
                        ? order.orderType === 'market'
                          ? t('portfolio.created')
                          : t('portfolio.createdCycles', { count: order.remainingCycles })
                        : (order.orderType === 'market' && (order.remainingCycles === 0 || order.remainingCycles === 1))
                          ? t('portfolio.nextCycle')
                          : t('portfolio.tradingCycles', { count: order.remainingCycles })}
                  </span>
                </div>
                {/* Row 4: Loan info (if order has loan request) */}
                {order.loanRequest && (
                  <div className="portfolio-orders__line portfolio-orders__line--loan">
                    <span className="portfolio-orders__loan-info">
                      {t('portfolio.withLoan', {
                        amount: formatNum(order.loanRequest.amount),
                        rate: formatNum(order.loanRequest.interestRate * 100, 2),
                      })}
                    </span>
                  </div>
                )}
              </div>
              <div className="portfolio-orders__actions">
                <button
                  className="icon-btn portfolio-orders__edit-btn"
                  onClick={() => onEditOrder(order)}
                  title={t('portfolio.editOrder')}
                >
                  <EditIcon size={14} />
                </button>
                <button
                  className="icon-btn portfolio-orders__cancel-btn"
                  onClick={() => onCancelOrder(order.id)}
                  title={t('portfolio.cancelOrder')}
                >
                  <CloseIcon size={14} />
                </button>
              </div>
            </div>
          );
          })}
        </div>
      ) : (
        <p className="portfolio-orders__empty">{t('portfolio.noOrders')}</p>
      )}
    </div>
  );
};

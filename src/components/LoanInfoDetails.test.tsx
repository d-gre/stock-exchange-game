import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoanInfoDetails } from './LoanInfoDetails';
import type { InterestRateBreakdown, CreditLineInfo } from '../types';
import '../i18n';

const defaultCreditLineInfo: CreditLineInfo = {
  recommendedCreditLine: 5000,
  maxCreditLine: 12500,
  currentDebt: 0,
  availableCredit: 12500,
  utilizationRatio: 0,
  utilizationVsRecommended: 0,
  activeLoansCount: 0,
  collateralBreakdown: {
    largeCapStocks: 3500,
    smallCapStocks: 2000,
    baseCollateral: 0,
    total: 5500,
  },
};

const defaultInterestBreakdown: InterestRateBreakdown = {
  baseRate: 0.06,
  riskProfileAdjustment: 0,
  profitHistoryAdjustment: 0,
  utilizationSurcharge: 0,
  loanCountPenalty: 0,
  creditScoreAdjustment: 0,
  durationDiscount: 0,
  effectiveRate: 0.06,
};

describe('LoanInfoDetails', () => {
  describe('conditions toggle', () => {
    it('should render conditions toggle button', () => {
      render(
        <LoanInfoDetails
          creditLineInfo={defaultCreditLineInfo}
          interestBreakdown={defaultInterestBreakdown}
        />
      );

      const toggle = screen.getByRole('button', { name: /Kreditbedingungen/ });
      expect(toggle).toBeInTheDocument();
    });

    it('should not be expanded by default', () => {
      const { container } = render(
        <LoanInfoDetails
          creditLineInfo={defaultCreditLineInfo}
          interestBreakdown={defaultInterestBreakdown}
        />
      );

      const expandable = container.querySelector('.loan-info__expandable');
      expect(expandable).not.toHaveClass('loan-info__expandable--open');
    });

    it('should expand when toggle is clicked', () => {
      const { container } = render(
        <LoanInfoDetails
          creditLineInfo={defaultCreditLineInfo}
          interestBreakdown={defaultInterestBreakdown}
        />
      );

      const toggle = screen.getByRole('button', { name: /Kreditbedingungen/ });
      fireEvent.click(toggle);

      const expandable = container.querySelector('.loan-info__expandable');
      expect(expandable).toHaveClass('loan-info__expandable--open');
    });

    it('should collapse when toggle is clicked again', () => {
      const { container } = render(
        <LoanInfoDetails
          creditLineInfo={defaultCreditLineInfo}
          interestBreakdown={defaultInterestBreakdown}
        />
      );

      const toggle = screen.getByRole('button', { name: /Kreditbedingungen/ });
      fireEvent.click(toggle); // expand
      fireEvent.click(toggle); // collapse

      const expandable = container.querySelector('.loan-info__expandable');
      expect(expandable).not.toHaveClass('loan-info__expandable--open');
    });

    it('should be expanded initially when initialExpanded is true', () => {
      const { container } = render(
        <LoanInfoDetails
          creditLineInfo={defaultCreditLineInfo}
          interestBreakdown={defaultInterestBreakdown}
          initialExpanded={true}
        />
      );

      const expandable = container.querySelector('.loan-info__expandable');
      expect(expandable).toHaveClass('loan-info__expandable--open');
    });
  });

  describe('interest rate breakdown section', () => {
    it('should show base rate when expanded', () => {
      render(
        <LoanInfoDetails
          creditLineInfo={defaultCreditLineInfo}
          interestBreakdown={defaultInterestBreakdown}
        />
      );

      const toggle = screen.getByRole('button', { name: /Kreditbedingungen/ });
      fireEvent.click(toggle);

      expect(screen.getByText('Basiszins:')).toBeInTheDocument();
      // Both base rate and effective rate show 6.00%, so use getAllByText
      expect(screen.getAllByText('6,00%').length).toBeGreaterThanOrEqual(1);
    });

    it('should show effective rate when expanded', () => {
      render(
        <LoanInfoDetails
          creditLineInfo={defaultCreditLineInfo}
          interestBreakdown={defaultInterestBreakdown}
        />
      );

      const toggle = screen.getByRole('button', { name: /Kreditbedingungen/ });
      fireEvent.click(toggle);

      expect(screen.getByText('Effektiver Zinssatz:')).toBeInTheDocument();
    });

    it('should show risk profile adjustment when present', () => {
      const breakdownWithRiskAdjustment: InterestRateBreakdown = {
        ...defaultInterestBreakdown,
        riskProfileAdjustment: 0.02,
        effectiveRate: 0.08,
      };

      render(
        <LoanInfoDetails
          creditLineInfo={defaultCreditLineInfo}
          interestBreakdown={breakdownWithRiskAdjustment}
        />
      );

      const toggle = screen.getByRole('button', { name: /Kreditbedingungen/ });
      fireEvent.click(toggle);

      // Label without colon because it has a hint
      expect(screen.getByText('Risikoprofil')).toBeInTheDocument();
      expect(screen.getByText('+2,00%')).toBeInTheDocument();
    });

    it('should not show risk profile adjustment when zero', () => {
      render(
        <LoanInfoDetails
          creditLineInfo={defaultCreditLineInfo}
          interestBreakdown={defaultInterestBreakdown}
        />
      );

      const toggle = screen.getByRole('button', { name: /Kreditbedingungen/ });
      fireEvent.click(toggle);

      expect(screen.queryByText('Risikoprofil:')).not.toBeInTheDocument();
    });

    it('should show profit history adjustment when present', () => {
      const breakdownWithProfitAdjustment: InterestRateBreakdown = {
        ...defaultInterestBreakdown,
        profitHistoryAdjustment: 0.01,
        effectiveRate: 0.07,
      };

      render(
        <LoanInfoDetails
          creditLineInfo={defaultCreditLineInfo}
          interestBreakdown={breakdownWithProfitAdjustment}
        />
      );

      const toggle = screen.getByRole('button', { name: /Kreditbedingungen/ });
      fireEvent.click(toggle);

      // Label without colon because it has a hint
      expect(screen.getByText('Handelshistorie')).toBeInTheDocument();
      expect(screen.getByText('+1,00%')).toBeInTheDocument();
    });

    it('should show utilization surcharge when present', () => {
      const breakdownWithUtilization: InterestRateBreakdown = {
        ...defaultInterestBreakdown,
        utilizationSurcharge: 0.03,
        effectiveRate: 0.09,
      };

      render(
        <LoanInfoDetails
          creditLineInfo={defaultCreditLineInfo}
          interestBreakdown={breakdownWithUtilization}
        />
      );

      const toggle = screen.getByRole('button', { name: /Kreditbedingungen/ });
      fireEvent.click(toggle);

      // Label without colon because it has a hint
      expect(screen.getByText('Auslastungszuschlag')).toBeInTheDocument();
      expect(screen.getByText('+3,00%')).toBeInTheDocument();
    });

    it('should show loan count penalty when present', () => {
      const breakdownWithPenalty: InterestRateBreakdown = {
        ...defaultInterestBreakdown,
        loanCountPenalty: 0.01,
        effectiveRate: 0.07,
      };

      render(
        <LoanInfoDetails
          creditLineInfo={defaultCreditLineInfo}
          interestBreakdown={breakdownWithPenalty}
        />
      );

      const toggle = screen.getByRole('button', { name: /Kreditbedingungen/ });
      fireEvent.click(toggle);

      // Label without colon because it has a hint
      expect(screen.getByText('Zusatzkredit-Aufschlag')).toBeInTheDocument();
      expect(screen.getByText('+1,00%')).toBeInTheDocument();
    });

    it('should show duration discount when present', () => {
      const breakdownWithDurationDiscount: InterestRateBreakdown = {
        ...defaultInterestBreakdown,
        durationDiscount: -0.01,
        effectiveRate: 0.05,
      };

      render(
        <LoanInfoDetails
          creditLineInfo={defaultCreditLineInfo}
          interestBreakdown={breakdownWithDurationDiscount}
        />
      );

      const toggle = screen.getByRole('button', { name: /Kreditbedingungen/ });
      fireEvent.click(toggle);

      // Translation key is 'loans.durationDiscount' = "Laufzeitrabatt"
      expect(screen.getByText(/Laufzeitrabatt/)).toBeInTheDocument();
      expect(screen.getByText('-1,00%')).toBeInTheDocument();
    });

    it('should show credit score adjustment when present', () => {
      const breakdownWithCreditScore: InterestRateBreakdown = {
        ...defaultInterestBreakdown,
        creditScoreAdjustment: -0.005,
        effectiveRate: 0.055,
      };

      render(
        <LoanInfoDetails
          creditLineInfo={defaultCreditLineInfo}
          interestBreakdown={breakdownWithCreditScore}
        />
      );

      const toggle = screen.getByRole('button', { name: /Kreditbedingungen/ });
      fireEvent.click(toggle);

      // Translation key is 'loans.creditScoreAdjustment' = "Credit Score"
      expect(screen.getByText('Credit Score:')).toBeInTheDocument();
    });

    it('should show interest charge info note', () => {
      render(
        <LoanInfoDetails
          creditLineInfo={defaultCreditLineInfo}
          interestBreakdown={defaultInterestBreakdown}
        />
      );

      const toggle = screen.getByRole('button', { name: /Kreditbedingungen/ });
      fireEvent.click(toggle);

      expect(screen.getByText(/alle 20 Handelszyklen/)).toBeInTheDocument();
    });
  });

  describe('credit line section', () => {
    it('should show recommended credit line when expanded', () => {
      render(
        <LoanInfoDetails
          creditLineInfo={defaultCreditLineInfo}
          interestBreakdown={defaultInterestBreakdown}
        />
      );

      const toggle = screen.getByRole('button', { name: /Kreditbedingungen/ });
      fireEvent.click(toggle);

      // Label now has hint instead of colon
      expect(screen.getByText('Empfohlener Kredit')).toBeInTheDocument();
      expect(screen.getByText('$5.000,00')).toBeInTheDocument();
    });

    it('should show max credit line when expanded', () => {
      render(
        <LoanInfoDetails
          creditLineInfo={defaultCreditLineInfo}
          interestBreakdown={defaultInterestBreakdown}
        />
      );

      const toggle = screen.getByRole('button', { name: /Kreditbedingungen/ });
      fireEvent.click(toggle);

      // Translation: "Maximaler Kredit" with hint "(×2.5)"
      expect(screen.getByText('Maximaler Kredit')).toBeInTheDocument();
      // $12.500,00 appears twice (maxCreditLine and availableCredit are equal in test data)
      expect(screen.getAllByText('$12.500,00').length).toBeGreaterThanOrEqual(1);
    });

    it('should show available credit when expanded', () => {
      render(
        <LoanInfoDetails
          creditLineInfo={defaultCreditLineInfo}
          interestBreakdown={defaultInterestBreakdown}
        />
      );

      const toggle = screen.getByRole('button', { name: /Kreditbedingungen/ });
      fireEvent.click(toggle);

      expect(screen.getByText('Verfügbarer Kredit:')).toBeInTheDocument();
    });

    it('should show large cap collateral when present', () => {
      render(
        <LoanInfoDetails
          creditLineInfo={defaultCreditLineInfo}
          interestBreakdown={defaultInterestBreakdown}
        />
      );

      const toggle = screen.getByRole('button', { name: /Kreditbedingungen/ });
      fireEvent.click(toggle);

      // Translation: "Large Cap Aktien (70%)" with hint "(70% des Wertes)"
      expect(screen.getByText(/Large Cap Aktien/)).toBeInTheDocument();
    });

    it('should show small cap collateral when present', () => {
      render(
        <LoanInfoDetails
          creditLineInfo={defaultCreditLineInfo}
          interestBreakdown={defaultInterestBreakdown}
        />
      );

      const toggle = screen.getByRole('button', { name: /Kreditbedingungen/ });
      fireEvent.click(toggle);

      // Translation: "Small/Mid Cap Aktien (50%)" with hint "(50% des Wertes)"
      expect(screen.getByText(/Small\/Mid Cap Aktien/)).toBeInTheDocument();
    });

    it('should not show large cap collateral when zero', () => {
      const creditInfoNoLargeCap: CreditLineInfo = {
        ...defaultCreditLineInfo,
        collateralBreakdown: {
          largeCapStocks: 0,
          smallCapStocks: 2000,
          baseCollateral: 0,
          total: 2000,
        },
      };

      render(
        <LoanInfoDetails
          creditLineInfo={creditInfoNoLargeCap}
          interestBreakdown={defaultInterestBreakdown}
        />
      );

      const toggle = screen.getByRole('button', { name: /Kreditbedingungen/ });
      fireEvent.click(toggle);

      expect(screen.queryByText(/Large Cap Aktien/)).not.toBeInTheDocument();
    });

    it('should show current debt when present', () => {
      const creditInfoWithDebt: CreditLineInfo = {
        ...defaultCreditLineInfo,
        currentDebt: 3000,
        availableCredit: 9500,
      };

      render(
        <LoanInfoDetails
          creditLineInfo={creditInfoWithDebt}
          interestBreakdown={defaultInterestBreakdown}
        />
      );

      const toggle = screen.getByRole('button', { name: /Kreditbedingungen/ });
      fireEvent.click(toggle);

      expect(screen.getByText('Aktuelle Schulden:')).toBeInTheDocument();
    });

    it('should not show current debt when zero', () => {
      render(
        <LoanInfoDetails
          creditLineInfo={defaultCreditLineInfo}
          interestBreakdown={defaultInterestBreakdown}
        />
      );

      const toggle = screen.getByRole('button', { name: /Kreditbedingungen/ });
      fireEvent.click(toggle);

      expect(screen.queryByText('Aktuelle Schulden:')).not.toBeInTheDocument();
    });
  });

  describe('footer', () => {
    it('should show repayment fee info when expanded', () => {
      render(
        <LoanInfoDetails
          creditLineInfo={defaultCreditLineInfo}
          interestBreakdown={defaultInterestBreakdown}
        />
      );

      const toggle = screen.getByRole('button', { name: /Kreditbedingungen/ });
      fireEvent.click(toggle);

      expect(screen.getByText(/Tilgungsgebühr/)).toBeInTheDocument();
    });
  });
});

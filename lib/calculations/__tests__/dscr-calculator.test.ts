import { describe, it, expect } from 'vitest';
import { calculateDSCR } from '../dscr-calculator';
import { makeMetrics, makeDebtComponents, makeFixedCharges } from './test-helpers';

describe('calculateDSCR', () => {
  it('returns null results when adjustedEbitda is null', () => {
    const result = calculateDSCR(null, makeMetrics());
    expect(result.dscr).toBeNull();
    expect(result.funded_debt).toBeNull();
    expect(result.dscr_breakdown).toBeNull();
  });

  it('returns null DSCR when total debt service is zero', () => {
    const result = calculateDSCR(10000, makeMetrics());
    expect(result.dscr).toBeNull();
    expect(result.dscr_breakdown).toBeNull();
    // funded_debt can still be returned
  });

  describe('funded debt calculation', () => {
    it('funded debt = bank debt + finance lease liabilities', () => {
      const metrics = makeMetrics({
        debt_components: makeDebtComponents({
          bank_debt_current: 3000,
          bank_debt_long_term: 7000,
          lease_liabilities_current: 1000,
          lease_liabilities_long_term: 2000,
          // Excluded from funded debt:
          notes_payable: 5000,
          subordinated_debt: 3000,
        }),
        repayment_of_debt: 4000,
        cash_interest_paid: 2000,
      });
      const result = calculateDSCR(20000, metrics);
      // bank = 10000, lease = 3000, funded = 13000
      expect(result.funded_debt).toBe(13000);
      // Sub debt NOT included
      expect(result.funded_debt).not.toBe(21000);
    });

    it('returns zero funded debt when all bank + lease components are zero', () => {
      const metrics = makeMetrics({
        debt_components: makeDebtComponents({
          bank_debt_current: 0,
          bank_debt_long_term: 0,
          lease_liabilities_current: 0,
          lease_liabilities_long_term: 0,
        }),
        repayment_of_debt: 1000,
        cash_interest_paid: 500,
      });
      const result = calculateDSCR(10000, metrics);
      expect(result.funded_debt).toBe(0);
    });

    it('falls back to finance_lease_liabilities when current/LT null', () => {
      const metrics = makeMetrics({
        debt_components: makeDebtComponents({
          bank_debt_current: 5000,
          bank_debt_long_term: 5000,
          finance_lease_liabilities: 3000,
          // lease_liabilities_current and _long_term both null
        }),
        repayment_of_debt: 2000,
        cash_interest_paid: 1000,
      });
      const result = calculateDSCR(10000, metrics);
      expect(result.funded_debt).toBe(13000); // 10000 bank + 3000 finance lease
    });
  });

  describe('DSCR calculation', () => {
    it('DSCR = Adjusted EBITDA / Total Debt Service', () => {
      const metrics = makeMetrics({
        repayment_of_debt: 3000,
        cash_interest_paid: 1500,
        debt_components: makeDebtComponents({
          bank_debt_current: 5000,
          bank_debt_long_term: 10000,
        }),
      });
      const result = calculateDSCR(10000, metrics);
      // DSCR = 10000 / (3000 + 1500) = 2.22
      expect(result.dscr).toBeCloseTo(2.22, 1);
    });

    it('returns negative DSCR for negative EBITDA (distress signal)', () => {
      const metrics = makeMetrics({
        repayment_of_debt: 3000,
        cash_interest_paid: 1500,
        debt_components: makeDebtComponents({
          bank_debt_current: 5000,
          bank_debt_long_term: 10000,
        }),
      });
      const result = calculateDSCR(-5000, metrics);
      expect(result.dscr!).toBeLessThan(0);
    });
  });

  describe('funded debt to EBITDA', () => {
    it('calculates funded_debt_to_ebitda ratio', () => {
      const metrics = makeMetrics({
        debt_components: makeDebtComponents({
          bank_debt_current: 3000,
          bank_debt_long_term: 7000,
          lease_liabilities_current: 1000,
          lease_liabilities_long_term: 2000,
        }),
        repayment_of_debt: 2000,
        cash_interest_paid: 1000,
      });
      const result = calculateDSCR(10000, metrics);
      // funded = 13000; ratio = 13000 / 10000 = 1.3x
      expect(result.funded_debt_to_ebitda).toBeCloseTo(1.3, 1);
    });

    it('returns null when adjustedEbitda is zero', () => {
      const metrics = makeMetrics({
        debt_components: makeDebtComponents({
          bank_debt_current: 5000,
          bank_debt_long_term: 5000,
        }),
        repayment_of_debt: 2000,
        cash_interest_paid: 1000,
      });
      const result = calculateDSCR(0, metrics);
      // DSCR: 0 / 3000 = 0
      expect(result.funded_debt_to_ebitda).toBeNull();
    });
  });

  describe('breakdown structure', () => {
    it('includes all breakdown fields', () => {
      const metrics = makeMetrics({
        repayment_of_debt: 3000,
        cash_interest_paid: 1500,
        payment_of_lease_liability: 800,
        debt_components: makeDebtComponents({
          bank_debt_current: 2000,
          bank_debt_long_term: 8000,
          lease_liabilities_current: 1000,
          lease_liabilities_long_term: 2000,
        }),
      });
      const result = calculateDSCR(12000, metrics);
      const bd = result.dscr_breakdown!;

      expect(bd.calculation_type).toBe('ebitda_coverage');
      expect(bd.adjusted_ebitda).toBe(12000);
      expect(bd.bank_principal_payments).toBe(3000);
      expect(bd.bank_interest_expense).toBe(1500);
      expect(bd.lease_payments).toBe(1000);
      expect(bd.total_debt_service).toBe(5500);
      expect(bd.funded_debt).toBe(13000);
    });
  });

  describe('Taiga FY2024 — no bank debt, all lease', () => {
    it('funded debt = 0 when no bank debt exists', () => {
      const metrics = makeMetrics({
        debt_components: makeDebtComponents({
          bank_debt_current: 0,
          bank_debt_long_term: 0,
          lease_liabilities_current: 25956,
          lease_liabilities_long_term: 71490,
        }),
        // Some lease-based debt service
        fixed_charges: makeFixedCharges({
          finance_lease_payments: 30000,
        }),
        interest: 5500,
      });
      const result = calculateDSCR(80000, metrics);
      // funded = 0 bank + 97446 lease = 97446
      expect(result.funded_debt).toBe(97446);
    });
  });
});

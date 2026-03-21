import { describe, it, expect } from 'vitest';
import { resolveDebtService } from '../debt-service-resolver';
import { makeMetrics, makeDebtComponents, makeFixedCharges } from './test-helpers';

describe('resolveDebtService', () => {
  describe('principal resolution', () => {
    it('prefers repayment_of_debt over bank_debt_current', () => {
      const metrics = makeMetrics({
        repayment_of_debt: 5000,
        debt_components: makeDebtComponents({
          bank_debt_current: 3000,
          bank_debt_long_term: 2000,
        }),
      });
      const result = resolveDebtService(metrics);
      expect(result.principal).toBe(5000);
      expect(result.sources.principal_source).toBe('repayment_of_debt');
    });

    it('falls back to bank_debt_current when repayment_of_debt is null', () => {
      const metrics = makeMetrics({
        debt_components: makeDebtComponents({
          bank_debt_current: 3000,
        }),
      });
      const result = resolveDebtService(metrics);
      expect(result.principal).toBe(3000);
      expect(result.sources.principal_source).toBe('bank_debt_current');
    });

    it('falls back to ttm_principal_payments as last resort', () => {
      const metrics = makeMetrics({
        ttm_principal_payments: 2000,
      });
      const result = resolveDebtService(metrics);
      expect(result.principal).toBe(2000);
      expect(result.sources.principal_source).toBe('ttm_principal_payments');
    });

    it('returns zero principal when no source available', () => {
      const result = resolveDebtService(makeMetrics());
      expect(result.principal).toBe(0);
      expect(result.sources.principal_source).toBe('none');
    });

    it('ignores repayment_of_debt when zero', () => {
      const metrics = makeMetrics({
        repayment_of_debt: 0,
        debt_components: makeDebtComponents({
          bank_debt_current: 3000,
        }),
      });
      const result = resolveDebtService(metrics);
      expect(result.principal).toBe(3000);
      expect(result.sources.principal_source).toBe('bank_debt_current');
    });
  });

  describe('revolver cap', () => {
    it('caps principal at funded debt when repayment_of_debt exceeds 1.1x', () => {
      const metrics = makeMetrics({
        repayment_of_debt: 50000, // grossly exceeds funded debt
        debt_components: makeDebtComponents({
          bank_debt_current: 3000,
          bank_debt_long_term: 7000,
          lease_liabilities_current: 1000,
          lease_liabilities_long_term: 2000,
        }),
      });
      const result = resolveDebtService(metrics);
      // fundedDebt = 10000 bank + 3000 lease = 13000
      // 50000 > 13000 * 1.1 = 14300 → capped at 13000
      expect(result.principal).toBe(13000);
      expect(result.sources.principal_capped_at_funded_debt).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('does NOT cap when repayment_of_debt is within 1.1x', () => {
      const metrics = makeMetrics({
        repayment_of_debt: 10500,
        debt_components: makeDebtComponents({
          bank_debt_current: 3000,
          bank_debt_long_term: 7000,
        }),
      });
      const result = resolveDebtService(metrics);
      // fundedDebt = 10000, 10500 < 10000 * 1.1 = 11000 → not capped
      expect(result.principal).toBe(10500);
      expect(result.sources.principal_capped_at_funded_debt).toBeUndefined();
    });
  });

  describe('interest resolution', () => {
    it('prefers cash_interest_paid when available', () => {
      const metrics = makeMetrics({
        cash_interest_paid: 1200,
        interest: 1000,
        fixed_charges: makeFixedCharges({
          total_interest_expense: 1100,
        }),
      });
      const result = resolveDebtService(metrics);
      expect(result.interest).toBe(1200);
      expect(result.sources.interest_source).toBe('cash_interest_paid');
    });

    it('overrides cash_interest_paid when accrual is >1.15x larger', () => {
      const metrics = makeMetrics({
        cash_interest_paid: 500, // suspiciously low
        fixed_charges: makeFixedCharges({
          total_interest_expense: 1200, // much larger → cash is incomplete
        }),
      });
      const result = resolveDebtService(metrics);
      // 1200 > 500 * 1.15 = 575 → override
      expect(result.interest).toBe(1200);
      expect(result.sources.interest_source).toBe('total_interest_expense');
    });

    it('falls through to P&L interest as last resort', () => {
      const metrics = makeMetrics({
        interest: 800,
      });
      const result = resolveDebtService(metrics);
      expect(result.interest).toBe(800);
      expect(result.sources.interest_source).toBe('interest_accrual');
    });
  });

  describe('lease resolution', () => {
    it('prefers finance_lease_payments from fixed charges', () => {
      const metrics = makeMetrics({
        fixed_charges: makeFixedCharges({
          finance_lease_payments: 3000,
        }),
        debt_components: makeDebtComponents({
          lease_liabilities_current: 2500,
        }),
      });
      const result = resolveDebtService(metrics);
      expect(result.leases).toBe(3000);
      expect(result.sources.lease_source).toBe('finance_lease_payments');
    });

    it('falls back to lease_liabilities_current', () => {
      const metrics = makeMetrics({
        debt_components: makeDebtComponents({
          lease_liabilities_current: 2500,
        }),
      });
      const result = resolveDebtService(metrics);
      expect(result.leases).toBe(2500);
      expect(result.sources.lease_source).toBe('lease_liabilities_current');
    });

    it('falls back to payment_of_lease_liability', () => {
      const metrics = makeMetrics({
        payment_of_lease_liability: 1800,
      });
      const result = resolveDebtService(metrics);
      expect(result.leases).toBe(1800);
      expect(result.sources.lease_source).toBe('payment_of_lease_liability');
    });
  });

  describe('lease interest double-count prevention', () => {
    it('deducts lease_interest from P&L interest when lease is total cash payment', () => {
      const metrics = makeMetrics({
        fixed_charges: makeFixedCharges({
          total_interest_expense: 2000, // P&L-based, includes lease interest
          finance_lease_payments: 1500, // total cash payment (includes interest)
          lease_interest: 400,
        }),
      });
      const result = resolveDebtService(metrics);
      // Interest: 2000 - 400 = 1600
      expect(result.interest).toBe(1600);
      expect(result.sources.lease_interest_deducted).toBe(400);
    });

    it('does NOT deduct lease_interest when lease source is balance sheet current', () => {
      const metrics = makeMetrics({
        fixed_charges: makeFixedCharges({
          total_interest_expense: 2000,
          lease_interest: 400,
        }),
        debt_components: makeDebtComponents({
          lease_liabilities_current: 1500, // BS current = principal only, no interest
        }),
      });
      const result = resolveDebtService(metrics);
      // No deduction — lease_liabilities_current is principal-only
      expect(result.interest).toBe(2000);
      expect(result.sources.lease_interest_deducted).toBeNull();
    });

    it('does NOT deduct when interest source is cash_interest_paid', () => {
      const metrics = makeMetrics({
        cash_interest_paid: 1500, // cash basis, not P&L
        fixed_charges: makeFixedCharges({
          finance_lease_payments: 1000,
          lease_interest: 300,
        }),
      });
      const result = resolveDebtService(metrics);
      // cash_interest_paid is NOT in PL_BASED_SOURCES, so no deduction
      expect(result.interest).toBe(1500);
      expect(result.sources.lease_interest_deducted).toBeNull();
    });
  });

  describe('operating leases and preferred dividends', () => {
    it('resolves operating lease payments separately (not in total)', () => {
      const metrics = makeMetrics({
        repayment_of_debt: 5000,
        interest: 1000,
        fixed_charges: makeFixedCharges({
          operating_lease_payments: 2000,
        }),
      });
      const result = resolveDebtService(metrics);
      expect(result.operatingLeases).toBe(2000);
      // NOT included in total
      expect(result.total).toBe(5000 + 1000); // principal + interest only
    });

    it('resolves preferred dividends separately (not in total)', () => {
      const metrics = makeMetrics({
        repayment_of_debt: 5000,
        interest: 1000,
        fixed_charges: makeFixedCharges({
          preferred_dividends: 500,
        }),
      });
      const result = resolveDebtService(metrics);
      expect(result.preferredDividends).toBe(500);
      // NOT included in total (DSCR excludes them; FCCR adds them itself)
      expect(result.total).toBe(6000);
    });
  });

  describe('total calculation', () => {
    it('total = principal + interest + leases', () => {
      const metrics = makeMetrics({
        repayment_of_debt: 3000,
        cash_interest_paid: 1500,
        payment_of_lease_liability: 800,
      });
      const result = resolveDebtService(metrics);
      expect(result.total).toBe(3000 + 1500 + 800);
    });
  });
});

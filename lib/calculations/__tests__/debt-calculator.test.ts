import { describe, it, expect } from 'vitest';
import { calculateDebtMetrics } from '../debt-calculator';
import { makeMetrics, makeDebtComponents } from './test-helpers';

describe('calculateDebtMetrics', () => {
  describe('bank debt calculation', () => {
    it('uses bank_debt_current + bank_debt_long_term when both present', () => {
      const metrics = makeMetrics({
        debt_components: makeDebtComponents({
          bank_debt_current: 2000,
          bank_debt_long_term: 14000,
          // These should be ignored when both current + LT are present
          term_loans: 50000,
        }),
      });
      const result = calculateDebtMetrics(metrics);
      expect(result.debt_breakdown.bank_debt).toBe(16000);
    });

    it('falls back to disaggregated components when bank_debt fields are null', () => {
      const metrics = makeMetrics({
        debt_components: makeDebtComponents({
          term_loans: 10000,
          revolving_credit_facilities: 5000,
          overdraft_facilities: 1000,
        }),
      });
      const result = calculateDebtMetrics(metrics);
      expect(result.debt_breakdown.bank_debt).toBe(16000);
    });

    it('uses max of disaggregated vs partial when one bank_debt field is null', () => {
      const metrics = makeMetrics({
        debt_components: makeDebtComponents({
          bank_debt_current: 3000,
          bank_debt_long_term: null,
          term_loans: 10000,
          revolving_credit_facilities: 5000,
        }),
      });
      const result = calculateDebtMetrics(metrics);
      // disaggregated = 15000, partial = 3000 → max(15000, 3000) = 15000
      expect(result.debt_breakdown.bank_debt).toBe(15000);
    });
  });

  describe('lease liability calculation', () => {
    it('uses current + long-term split (IFRS 16 total)', () => {
      const metrics = makeMetrics({
        debt_components: makeDebtComponents({
          lease_liabilities_current: 2000,
          lease_liabilities_long_term: 5000,
          // Fallback should NOT be used
          finance_lease_liabilities: 99999,
        }),
      });
      const result = calculateDebtMetrics(metrics);
      expect(result.debt_breakdown.lease_liabilities).toBe(7000);
    });

    it('falls back to finance + operating when current/LT split is zero', () => {
      const metrics = makeMetrics({
        debt_components: makeDebtComponents({
          finance_lease_liabilities: 3000,
          operating_lease_liabilities: 2000,
        }),
      });
      const result = calculateDebtMetrics(metrics);
      expect(result.debt_breakdown.lease_liabilities).toBe(5000);
    });
  });

  describe('senior debt with lease config', () => {
    it('includes leases in senior debt by default (IFRS 16)', () => {
      const metrics = makeMetrics({
        debt_components: makeDebtComponents({
          bank_debt_current: 2000,
          bank_debt_long_term: 14000,
          lease_liabilities_current: 2000,
          lease_liabilities_long_term: 5000,
        }),
      });
      const result = calculateDebtMetrics(metrics);
      // senior = 16000 bank + 7000 lease = 23000
      expect(result.senior_debt).toBe(23000);
      expect(result.debt_breakdown.lease_liabilities_in_senior_debt).toBe(7000);
    });

    it('excludes leases from senior debt when config is exclude', () => {
      const metrics = makeMetrics({
        debt_components: makeDebtComponents({
          bank_debt_current: 2000,
          bank_debt_long_term: 14000,
          lease_liabilities_current: 2000,
          lease_liabilities_long_term: 5000,
        }),
      });
      const result = calculateDebtMetrics(metrics, { mode: 'exclude' });
      // senior = 16000 bank only
      expect(result.senior_debt).toBe(16000);
      expect(result.debt_breakdown.lease_liabilities_in_senior_debt).toBe(0);
    });
  });

  describe('total debt', () => {
    it('includes bank + lease + subordinated debt', () => {
      const metrics = makeMetrics({
        debt_components: makeDebtComponents({
          bank_debt_current: 2000,
          bank_debt_long_term: 8000,
          lease_liabilities_current: 1000,
          lease_liabilities_long_term: 3000,
          notes_payable: 500,
          subordinated_debt: 2000,
          convertible_debt: 1000,
        }),
      });
      const result = calculateDebtMetrics(metrics);
      // bank=10000 + lease=4000 + sub=3500 = 17500
      expect(result.total_debt).toBe(17500);
    });

    it('returns null when all components are zero', () => {
      const metrics = makeMetrics({
        debt_components: makeDebtComponents({}),
      });
      const result = calculateDebtMetrics(metrics);
      expect(result.total_debt).toBeNull();
    });

    it('returns null when debt_components is null', () => {
      const metrics = makeMetrics({ debt_components: null });
      const result = calculateDebtMetrics(metrics);
      expect(result.total_debt).toBeNull();
      expect(result.senior_debt).toBeNull();
    });
  });

  describe('Zedcor FY2023 reference values', () => {
    it('matches expected debt breakdown', () => {
      const metrics = makeMetrics({
        debt_components: makeDebtComponents({
          bank_debt_current: 4134,
          bank_debt_long_term: 12500,
          lease_liabilities_current: 2287,
          lease_liabilities_long_term: 5444,
          notes_payable: 3500,
        }),
      });
      const result = calculateDebtMetrics(metrics);
      // Bank debt = 4134 + 12500 = 16634
      expect(result.debt_breakdown.bank_debt).toBe(16634);
      // Leases = 2287 + 5444 = 7731
      expect(result.debt_breakdown.lease_liabilities).toBe(7731);
      // Senior (with leases) = 16634 + 7731 = 24365
      expect(result.senior_debt).toBe(24365);
      // Total = 16634 + 7731 + 3500 = 27865
      expect(result.total_debt).toBe(27865);
    });
  });

  describe('Taiga FY2024 — no bank debt, all lease', () => {
    it('handles zero bank debt with lease-only obligations', () => {
      const metrics = makeMetrics({
        debt_components: makeDebtComponents({
          bank_debt_current: 0,
          bank_debt_long_term: 0,
          lease_liabilities_current: 25956,
          lease_liabilities_long_term: 71490,
        }),
      });
      const result = calculateDebtMetrics(metrics);
      expect(result.debt_breakdown.bank_debt).toBe(0);
      expect(result.debt_breakdown.lease_liabilities).toBe(97446);
      // With lease inclusion (default), senior = 0 + 97446 = 97446
      expect(result.senior_debt).toBe(97446);
      // With lease exclusion, senior = 0 → null
      const excludeResult = calculateDebtMetrics(metrics, { mode: 'exclude' });
      expect(excludeResult.senior_debt).toBeNull();
    });
  });
});

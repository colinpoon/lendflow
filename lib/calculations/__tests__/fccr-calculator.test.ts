import { describe, it, expect } from 'vitest';
import { calculateFCCR, calculateCapexDeduction } from '../fccr-calculator';
import { makeMetrics, makeFixedCharges } from './test-helpers';

describe('calculateCapexDeduction', () => {
  it('unfunded mode: deducts capex minus proceeds', () => {
    expect(calculateCapexDeduction(5000, 2000, { mode: 'unfunded' })).toBe(3000);
  });

  it('unfunded mode: floors at zero when proceeds exceed capex', () => {
    expect(calculateCapexDeduction(2000, 5000, { mode: 'unfunded' })).toBe(0);
  });

  it('all mode: deducts 100% of capex', () => {
    expect(calculateCapexDeduction(5000, 2000, { mode: 'all' })).toBe(5000);
  });

  it('none mode: deducts nothing', () => {
    expect(calculateCapexDeduction(5000, 2000, { mode: 'none' })).toBe(0);
  });

  it('custom mode: deducts custom percentage', () => {
    expect(calculateCapexDeduction(10000, 0, { mode: 'custom', customPercentage: 75 })).toBe(7500);
  });

  it('custom mode: defaults to 0% when customPercentage missing', () => {
    expect(calculateCapexDeduction(10000, 0, { mode: 'custom' })).toBe(0);
  });
});

describe('calculateFCCR', () => {
  it('returns null results when adjustedEbitda is null', () => {
    const result = calculateFCCR(null, makeMetrics());
    expect(result.fccr).toBeNull();
    expect(result.fccr_numerator).toBeNull();
    expect(result.fccr_breakdown).toBeNull();
  });

  it('returns null when total debt service is zero', () => {
    // Metrics with no debt service data
    const result = calculateFCCR(10000, makeMetrics());
    expect(result.fccr).toBeNull();
  });

  describe('basic FCCR formula', () => {
    it('calculates FCCR = (EBITDA - CapEx - Taxes - Distributions) / Debt Service', () => {
      const metrics = makeMetrics({
        capital_expenditures: 2000,
        proceeds_from_long_term_debt: 500, // unfunded = 1500
        cash_taxes_paid: 1000,
        distributions_paid: 500,
        repayment_of_debt: 3000,
        cash_interest_paid: 1500,
      });
      const result = calculateFCCR(10000, metrics);
      // Numerator: 10000 - 1500 - 1000 - 500 = 7000
      // Denominator: 3000 + 1500 = 4500
      // FCCR: 7000 / 4500 = 1.56
      expect(result.fccr).toBeCloseTo(1.56, 1);
      expect(result.fccr_breakdown!.capex_treatment).toBe('unfunded');
    });
  });

  describe('CapEx treatment modes', () => {
    const baseMetrics = makeMetrics({
      capital_expenditures: 5000,
      proceeds_from_long_term_debt: 2000,
      repayment_of_debt: 3000,
      cash_interest_paid: 1000,
    });

    it('unfunded: deducts capex - proceeds', () => {
      const result = calculateFCCR(20000, baseMetrics, { mode: 'unfunded' });
      // Numerator: 20000 - 3000 - 0 - 0 = 17000
      expect(result.fccr_breakdown!.capex_deduction).toBe(3000);
    });

    it('all: deducts full capex', () => {
      const result = calculateFCCR(20000, baseMetrics, { mode: 'all' });
      expect(result.fccr_breakdown!.capex_deduction).toBe(5000);
    });

    it('none: deducts nothing', () => {
      const result = calculateFCCR(20000, baseMetrics, { mode: 'none' });
      expect(result.fccr_breakdown!.capex_deduction).toBe(0);
    });

    it('custom 60%: deducts 60% of capex', () => {
      const result = calculateFCCR(20000, baseMetrics, { mode: 'custom', customPercentage: 60 });
      expect(result.fccr_breakdown!.capex_deduction).toBe(3000);
    });
  });

  describe('cash taxes fallback chain', () => {
    it('uses cash_taxes_paid when available', () => {
      const metrics = makeMetrics({
        cash_taxes_paid: 800,
        taxes: 1000,
        repayment_of_debt: 2000,
        cash_interest_paid: 500,
      });
      const result = calculateFCCR(10000, metrics);
      expect(result.fccr_breakdown!.cash_taxes_paid).toBe(800);
      expect(result.fccr_breakdown!.sources!.cash_taxes_source).toBe('cash_flow');
    });

    it('falls back to income statement taxes when cash_taxes_paid is null', () => {
      const metrics = makeMetrics({
        taxes: 900,
        repayment_of_debt: 2000,
        cash_interest_paid: 500,
      });
      const result = calculateFCCR(10000, metrics);
      expect(result.fccr_breakdown!.cash_taxes_paid).toBe(900);
      expect(result.fccr_breakdown!.sources!.cash_taxes_source).toBe('income_statement_fallback');
      expect(result.warnings.some(w => w.includes('income statement tax expense'))).toBe(true);
    });

    it('uses zero and warns when both tax sources unavailable', () => {
      const metrics = makeMetrics({
        repayment_of_debt: 2000,
        cash_interest_paid: 500,
      });
      const result = calculateFCCR(10000, metrics);
      expect(result.fccr_breakdown!.cash_taxes_paid).toBe(0);
      expect(result.fccr_breakdown!.sources!.cash_taxes_source).toBe('zero_fallback');
      expect(result.warnings.some(w => w.includes('likely overstated'))).toBe(true);
    });

    it('floors negative cash taxes at zero (tax refund)', () => {
      const metrics = makeMetrics({
        cash_taxes_paid: -500,
        repayment_of_debt: 2000,
        cash_interest_paid: 500,
      });
      const result = calculateFCCR(10000, metrics);
      expect(result.fccr_breakdown!.cash_taxes_paid).toBe(0);
    });
  });

  describe('preferred dividends in denominator', () => {
    it('includes preferred dividends in FCCR denominator', () => {
      const metrics = makeMetrics({
        repayment_of_debt: 3000,
        cash_interest_paid: 1000,
        fixed_charges: makeFixedCharges({
          preferred_dividends: 500,
        }),
      });
      const result = calculateFCCR(10000, metrics);
      // Denominator = 3000 + 1000 + 0 leases + 500 pref div = 4500
      expect(result.fccr_breakdown!.denominator).toBe(4500);
      expect(result.fccr_breakdown!.preferred_dividends).toBe(500);
    });
  });

  describe('operating lease inclusion', () => {
    it('excludes operating leases by default', () => {
      const metrics = makeMetrics({
        repayment_of_debt: 3000,
        cash_interest_paid: 1000,
        fixed_charges: makeFixedCharges({
          operating_lease_payments: 2000,
        }),
      });
      const result = calculateFCCR(10000, metrics);
      expect(result.fccr_breakdown!.denominator).toBe(4000); // no op leases
    });

    it('includes operating leases when config says include', () => {
      const metrics = makeMetrics({
        repayment_of_debt: 3000,
        cash_interest_paid: 1000,
        fixed_charges: makeFixedCharges({
          operating_lease_payments: 2000,
        }),
      });
      const result = calculateFCCR(10000, metrics, { mode: 'unfunded' }, undefined, { mode: 'include' });
      expect(result.fccr_breakdown!.denominator).toBe(6000); // includes op leases
      expect(result.fccr_breakdown!.operating_lease_payments).toBe(2000);
    });
  });

  describe('negative FCCR warning', () => {
    it('warns when numerator is negative', () => {
      const metrics = makeMetrics({
        capital_expenditures: 8000,
        cash_taxes_paid: 3000,
        distributions_paid: 2000,
        repayment_of_debt: 3000,
        cash_interest_paid: 1000,
      });
      // Numerator: 5000 - 8000 - 3000 - 2000 = -8000
      const result = calculateFCCR(5000, metrics);
      expect(result.fccr!).toBeLessThan(0);
      expect(result.warnings.some(w => w.includes('negative'))).toBe(true);
    });
  });

  describe('negative proceeds warning', () => {
    it('warns when proceeds_from_long_term_debt is negative (paydown year)', () => {
      const metrics = makeMetrics({
        capital_expenditures: 3000,
        proceeds_from_long_term_debt: -1000,
        repayment_of_debt: 2000,
        cash_interest_paid: 500,
      });
      const result = calculateFCCR(10000, metrics);
      expect(result.warnings.some(w => w.includes('net debt paydown'))).toBe(true);
    });
  });

  describe('capex floor warning', () => {
    it('warns when unfunded capex floor fires', () => {
      const metrics = makeMetrics({
        capital_expenditures: 1000,
        proceeds_from_long_term_debt: 5000, // proceeds > capex
        repayment_of_debt: 2000,
        cash_interest_paid: 500,
      });
      const result = calculateFCCR(10000, metrics);
      expect(result.fccr_breakdown!.capex_deduction).toBe(0); // floored
      expect(result.warnings.some(w => w.includes('Unfunded CapEx floor'))).toBe(true);
    });
  });
});

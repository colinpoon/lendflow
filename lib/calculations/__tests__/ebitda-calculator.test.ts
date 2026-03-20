import { describe, it, expect } from 'vitest';
import { calculateEBITDA, calculateAdjustedEBITDA } from '../ebitda-calculator';
import { makeMetrics, makeFixedCharges, makeAdjustedEBITDAComponents } from './test-helpers';

describe('calculateEBITDA', () => {
  it('calculates EBITDA = Net Income + Interest + Taxes + D&A', () => {
    const metrics = makeMetrics({
      net_income: 5000,
      interest: 1000,
      taxes: 2000,
      depreciation_amortization: 3000,
    });
    const result = calculateEBITDA(metrics);
    expect(result).not.toBeNull();
    expect(result!.value).toBe(11000);
    expect(result!.usedGrossFallback).toBe(false);
  });

  it('returns null when net_income is null', () => {
    const metrics = makeMetrics({
      interest: 1000,
      taxes: 2000,
      depreciation_amortization: 3000,
    });
    expect(calculateEBITDA(metrics)).toBeNull();
  });

  it('returns null when depreciation_amortization and all sub-components are null', () => {
    const metrics = makeMetrics({
      net_income: 5000,
      interest: 1000,
      taxes: 2000,
    });
    expect(calculateEBITDA(metrics)).toBeNull();
  });

  it('treats null interest and taxes as zero', () => {
    const metrics = makeMetrics({
      net_income: 5000,
      depreciation_amortization: 3000,
    });
    const result = calculateEBITDA(metrics);
    expect(result!.value).toBe(8000); // 5000 + 0 + 0 + 3000
  });

  describe('interest fallback chain', () => {
    it('rejects negative P&L interest and uses fallback', () => {
      const metrics = makeMetrics({
        net_income: 5000,
        interest: -200, // net finance income (negative)
        taxes: 1000,
        depreciation_amortization: 2000,
        fixed_charges: makeFixedCharges({
          total_interest_expense: 800, // gross borrowing costs
        }),
      });
      const result = calculateEBITDA(metrics);
      expect(result!.value).toBe(5000 + 800 + 1000 + 2000);
      expect(result!.usedGrossFallback).toBe(true);
    });

    it('falls back to ttm_interest_expense when P&L and fixed_charges are unavailable', () => {
      const metrics = makeMetrics({
        net_income: 5000,
        taxes: 1000,
        depreciation_amortization: 2000,
        ttm_interest_expense: 600,
      });
      const result = calculateEBITDA(metrics);
      expect(result!.value).toBe(5000 + 600 + 1000 + 2000);
      expect(result!.usedGrossFallback).toBe(true);
    });

    it('falls back to cash_interest_paid as last resort', () => {
      const metrics = makeMetrics({
        net_income: 5000,
        taxes: 1000,
        depreciation_amortization: 2000,
        cash_interest_paid: 500,
      });
      const result = calculateEBITDA(metrics);
      expect(result!.value).toBe(5000 + 500 + 1000 + 2000);
      expect(result!.usedGrossFallback).toBe(true);
    });
  });

  describe('D&A resolution', () => {
    it('prefers component sum when >= CF aggregate', () => {
      const metrics = makeMetrics({
        net_income: 5000,
        interest: 1000,
        taxes: 1000,
        depreciation_amortization: 2800, // CF aggregate
        depreciation_equipment: 1500,
        depreciation_rou: 800,
        amortization_intangibles: 600,
        // Component sum = 2900 > 2800 → use component sum
      });
      const result = calculateEBITDA(metrics);
      expect(result!.value).toBe(5000 + 1000 + 1000 + 2900);
    });

    it('uses CF aggregate when component sum is incomplete', () => {
      const metrics = makeMetrics({
        net_income: 5000,
        interest: 1000,
        taxes: 1000,
        depreciation_amortization: 3000, // CF aggregate
        depreciation_equipment: 1000,
        // Only partial sub-components (1000 < 3000) → use CF aggregate
      });
      const result = calculateEBITDA(metrics);
      expect(result!.value).toBe(5000 + 1000 + 1000 + 3000);
    });

    it('falls back to sub-components when CF aggregate is null', () => {
      const metrics = makeMetrics({
        net_income: 5000,
        interest: 1000,
        taxes: 1000,
        depreciation_equipment: 1200,
        depreciation_rou: 800,
      });
      const result = calculateEBITDA(metrics);
      expect(result!.value).toBe(5000 + 1000 + 1000 + 2000);
    });
  });

  describe('resolvedComponents metadata', () => {
    it('includes resolved component values', () => {
      const metrics = makeMetrics({
        net_income: 5000,
        interest: 1000,
        taxes: 2000,
        depreciation_amortization: 3000,
      });
      const result = calculateEBITDA(metrics);
      expect(result!.resolvedComponents).toEqual({
        net_income: 5000,
        interest: 1000,
        taxes: 2000,
        depreciation_amortization: 3000,
      });
    });
  });
});

describe('calculateAdjustedEBITDA', () => {
  it('adds back non-cash adjustments', () => {
    const metrics = makeMetrics({
      adjusted_ebitda_components: makeAdjustedEBITDAComponents({
        stock_based_compensation: 500,
        impairment_charges: 200,
      }),
    });
    const result = calculateAdjustedEBITDA(10000, metrics);
    // 10000 + 500 + 200 = 10700
    expect(result.calculated_adjusted_ebitda).toBe(10700);
  });

  it('adds back one-time expenses', () => {
    const metrics = makeMetrics({
      adjusted_ebitda_components: makeAdjustedEBITDAComponents({
        restructuring_costs: 300,
        transaction_costs: 150,
      }),
    });
    const result = calculateAdjustedEBITDA(10000, metrics);
    expect(result.calculated_adjusted_ebitda).toBe(10450);
  });

  it('subtracts one-time gains', () => {
    const metrics = makeMetrics({
      adjusted_ebitda_components: makeAdjustedEBITDAComponents({
        gain_on_asset_sale: 400,
      }),
    });
    const result = calculateAdjustedEBITDA(10000, metrics);
    // 10000 - 400 = 9600
    expect(result.calculated_adjusted_ebitda).toBe(9600);
  });

  it('handles combined add-backs and subtractions', () => {
    const metrics = makeMetrics({
      adjusted_ebitda_components: makeAdjustedEBITDAComponents({
        stock_based_compensation: 1000,
        restructuring_costs: 500,
        gain_on_asset_sale: 300,
      }),
    });
    const result = calculateAdjustedEBITDA(10000, metrics);
    // 10000 + 1000 + 500 - 300 = 11200
    expect(result.calculated_adjusted_ebitda).toBe(11200);
  });

  describe('interest income exclusion', () => {
    it('subtracts interest income when usedGrossFallback is false', () => {
      const metrics = makeMetrics({
        interest: 800,
        interest_income: 200,
      });
      const result = calculateAdjustedEBITDA(10000, metrics, false);
      // 10000 - 200 = 9800
      expect(result.calculated_adjusted_ebitda).toBe(9800);
      expect(result.adjusted_ebitda_breakdown.interest_income_excluded).toBe(200);
    });

    it('does NOT subtract interest income when usedGrossFallback is true', () => {
      const metrics = makeMetrics({
        interest: 800,
        interest_income: 5000,
      });
      const result = calculateAdjustedEBITDA(10000, metrics, true);
      // Interest income NOT subtracted — gross fallback means it was never added
      expect(result.calculated_adjusted_ebitda).toBe(10000);
      expect(result.adjusted_ebitda_breakdown.interest_income_excluded).toBe(0);
    });

    it('does NOT subtract when interest_income > interest (arithmetic gate)', () => {
      const metrics = makeMetrics({
        interest: 300,
        interest_income: 500, // earns more than it pays
      });
      const result = calculateAdjustedEBITDA(10000, metrics, false);
      expect(result.adjusted_ebitda_breakdown.interest_income_excluded).toBe(0);
    });
  });

  describe('pro forma cap', () => {
    it('caps pro forma adjustments at 15% of base EBITDA', () => {
      const metrics = makeMetrics({
        adjusted_ebitda_components: makeAdjustedEBITDAComponents({
          pro_forma_cost_savings: 5000, // 50% of EBITDA — should be capped
        }),
      });
      const result = calculateAdjustedEBITDA(10000, metrics);
      // Cap = 10000 * 0.15 = 1500
      expect(result.adjusted_ebitda_breakdown.pro_forma_adjustments).toBe(1500);
      expect(result.calculated_adjusted_ebitda).toBe(11500);
    });

    it('does not cap when under 15% threshold', () => {
      const metrics = makeMetrics({
        adjusted_ebitda_components: makeAdjustedEBITDAComponents({
          pro_forma_cost_savings: 1000, // 10% of EBITDA — under cap
        }),
      });
      const result = calculateAdjustedEBITDA(10000, metrics);
      expect(result.adjusted_ebitda_breakdown.pro_forma_adjustments).toBe(1000);
    });

    it('caps pro forma at zero when base EBITDA is negative', () => {
      const metrics = makeMetrics({
        adjusted_ebitda_components: makeAdjustedEBITDAComponents({
          pro_forma_cost_savings: 1000,
        }),
      });
      const result = calculateAdjustedEBITDA(-5000, metrics);
      // Negative EBITDA → cap = 0 → no pro forma credit
      expect(result.adjusted_ebitda_breakdown.pro_forma_adjustments).toBe(0);
      expect(result.calculated_adjusted_ebitda).toBe(-5000);
    });
  });

  describe('unrealized FX routing', () => {
    it('adds back unrealized FX loss (positive value)', () => {
      const metrics = makeMetrics({
        adjusted_ebitda_components: makeAdjustedEBITDAComponents({
          unrealized_fx_cash_flow: 300, // positive = loss → add back
        }),
      });
      const result = calculateAdjustedEBITDA(10000, metrics);
      expect(result.calculated_adjusted_ebitda).toBe(10300);
      expect(result.adjusted_ebitda_breakdown.unrealized_fx_adjustment).toBe(300);
    });

    it('subtracts unrealized FX gain (negative value)', () => {
      const metrics = makeMetrics({
        adjusted_ebitda_components: makeAdjustedEBITDAComponents({
          unrealized_fx_cash_flow: -400, // negative = gain → subtract
        }),
      });
      const result = calculateAdjustedEBITDA(10000, metrics);
      expect(result.calculated_adjusted_ebitda).toBe(9600);
    });
  });

  describe('breakdown structure', () => {
    it('provides full breakdown with all components', () => {
      const metrics = makeMetrics({
        capital_expenditures: 2000,
        adjusted_ebitda_components: makeAdjustedEBITDAComponents({
          stock_based_compensation: 500,
          restructuring_costs: 200,
          gain_on_asset_sale: 100,
          owner_compensation_adjustment: 50,
        }),
      });
      const result = calculateAdjustedEBITDA(10000, metrics);
      const bd = result.adjusted_ebitda_breakdown;

      expect(bd.reported_ebitda).toBe(10000);
      expect(bd.non_cash_adjustments).toBe(500);
      expect(bd.one_time_expenses).toBe(200);
      expect(bd.one_time_gains).toBe(100);
      expect(bd.owner_management_adjustments).toBe(50);
      expect(bd.capital_expenditures_not_in_calc).toBe(2000);
    });
  });

  describe('null components', () => {
    it('returns EBITDA unchanged when no adjustment components exist', () => {
      const metrics = makeMetrics();
      const result = calculateAdjustedEBITDA(10000, metrics);
      expect(result.calculated_adjusted_ebitda).toBe(10000);
    });
  });

  describe('loss_on_disposal add-back', () => {
    it('adds back loss on disposal as non-cash', () => {
      const metrics = makeMetrics({
        adjusted_ebitda_components: makeAdjustedEBITDAComponents({
          loss_on_disposal: 150,
        }),
      });
      const result = calculateAdjustedEBITDA(10000, metrics);
      expect(result.calculated_adjusted_ebitda).toBe(10150);
    });
  });
});

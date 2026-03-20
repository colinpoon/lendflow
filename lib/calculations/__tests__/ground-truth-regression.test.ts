/**
 * Ground Truth Regression Tests
 *
 * Feeds manually verified raw values from ground-truth.ts into the
 * calculation pipeline and validates computed ratios match expected values.
 *
 * These tests run without API keys — they test the deterministic
 * calculation layer, not the AI extraction layer.
 */
import { describe, it, expect } from 'vitest';
import { GROUND_TRUTH, type GroundTruthValues } from '@/lib/benchmarks/ground-truth';
import { calculateEBITDA, calculateAdjustedEBITDA } from '../ebitda-calculator';
import { calculateDebtMetrics } from '../debt-calculator';
import { calculateFCCR } from '../fccr-calculator';
import { calculateDSCR } from '../dscr-calculator';
import {
  calculateTotalDebtToCapital,
  calculateSeniorDebtToEBITDA,
  calculateInterestCoverageRatio,
  calculateDebtToEquityRatio,
  calculateCurrentRatio,
} from '../ratio-calculator';
import type { ExtractedMetrics, DebtComponents, FixedCharges, AdjustedEBITDAComponents } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert flat ground truth dot-notation keys into nested ExtractedMetrics */
function buildMetrics(gt: GroundTruthValues): ExtractedMetrics {
  const dc: DebtComponents = {
    bank_debt_current: gt['debt_components.bank_debt_current'] ?? null,
    bank_debt_long_term: gt['debt_components.bank_debt_long_term'] ?? null,
    term_loans: gt['debt_components.term_loans'] ?? null,
    revolving_credit_facilities: gt['debt_components.revolving_credit_facilities'] ?? null,
    overdraft_facilities: gt['debt_components.overdraft_facilities'] ?? null,
    lines_of_credit: gt['debt_components.lines_of_credit'] ?? null,
    lease_liabilities_current: gt['debt_components.lease_liabilities_current'] ?? null,
    lease_liabilities_long_term: gt['debt_components.lease_liabilities_long_term'] ?? null,
    finance_lease_liabilities: gt['debt_components.finance_lease_liabilities'] ?? null,
    operating_lease_liabilities: gt['debt_components.operating_lease_liabilities'] ?? null,
    notes_payable: gt['debt_components.notes_payable'] ?? null,
    subordinated_debt: gt['debt_components.subordinated_debt'] ?? null,
    convertible_debt: gt['debt_components.convertible_debt'] ?? null,
    bonds_debentures: gt['debt_components.bonds_debentures'] ?? null,
    other_borrowings: gt['debt_components.other_borrowings'] ?? null,
  };

  const fc: FixedCharges = {
    senior_debt_interest: gt['fixed_charges.senior_debt_interest'] ?? null,
    subordinated_debt_interest: gt['fixed_charges.subordinated_debt_interest'] ?? null,
    lease_interest: gt['fixed_charges.lease_interest'] ?? null,
    total_interest_expense: gt['fixed_charges.total_interest_expense'] ?? null,
    senior_debt_interest_rate: null,
    minimum_lease_payments: gt['fixed_charges.minimum_lease_payments'] ?? null,
    finance_lease_payments: gt['fixed_charges.finance_lease_payments'] ?? null,
    operating_lease_payments: gt['fixed_charges.operating_lease_payments'] ?? null,
    principal_payments: gt['fixed_charges.principal_payments'] ?? null,
    preferred_dividends: gt['fixed_charges.preferred_dividends'] ?? null,
    other_fixed_charges: gt['fixed_charges.other_fixed_charges'] ?? null,
  };

  const adj: AdjustedEBITDAComponents = {
    stock_based_compensation: gt['adjusted_ebitda_components.stock_based_compensation'] ?? null,
    impairment_charges: gt['adjusted_ebitda_components.impairment_charges'] ?? null,
    goodwill_impairment: gt['adjusted_ebitda_components.goodwill_impairment'] ?? null,
    unrealized_gains_losses: gt['adjusted_ebitda_components.unrealized_gains_losses'] ?? null,
    deferred_compensation: gt['adjusted_ebitda_components.deferred_compensation'] ?? null,
    loss_on_disposal: gt['adjusted_ebitda_components.loss_on_disposal'] ?? null,
    other_non_cash: gt['adjusted_ebitda_components.other_non_cash'] ?? null,
    restructuring_costs: gt['adjusted_ebitda_components.restructuring_costs'] ?? null,
    severance_costs: gt['adjusted_ebitda_components.severance_costs'] ?? null,
    transaction_costs: gt['adjusted_ebitda_components.transaction_costs'] ?? null,
    legal_settlements: gt['adjusted_ebitda_components.legal_settlements'] ?? null,
    professional_fees_one_time: gt['adjusted_ebitda_components.professional_fees_one_time'] ?? null,
    casualty_losses: gt['adjusted_ebitda_components.casualty_losses'] ?? null,
    other_one_time_expenses: gt['adjusted_ebitda_components.other_one_time_expenses'] ?? null,
    gain_on_disposal: gt['adjusted_ebitda_components.gain_on_disposal'] ?? null,
    gain_on_asset_sale: gt['adjusted_ebitda_components.gain_on_asset_sale'] ?? null,
    other_income_non_operating: gt['adjusted_ebitda_components.other_income_non_operating'] ?? null,
    insurance_proceeds: gt['adjusted_ebitda_components.insurance_proceeds'] ?? null,
    other_one_time_gains: gt['adjusted_ebitda_components.other_one_time_gains'] ?? null,
    owner_compensation_adjustment: gt['adjusted_ebitda_components.owner_compensation_adjustment'] ?? null,
    related_party_adjustments: gt['adjusted_ebitda_components.related_party_adjustments'] ?? null,
    management_fees_adjustment: gt['adjusted_ebitda_components.management_fees_adjustment'] ?? null,
    accounting_policy_adjustments: gt['adjusted_ebitda_components.accounting_policy_adjustments'] ?? null,
    foreign_exchange_adjustments: gt['adjusted_ebitda_components.foreign_exchange_adjustments'] ?? null,
    unrealized_fx_cash_flow: gt['adjusted_ebitda_components.unrealized_fx_cash_flow'] ?? null,
    realized_fx_pl: gt['adjusted_ebitda_components.realized_fx_pl'] ?? null,
    pro_forma_cost_savings: gt['adjusted_ebitda_components.pro_forma_cost_savings'] ?? null,
    pro_forma_synergies: gt['adjusted_ebitda_components.pro_forma_synergies'] ?? null,
  };

  // Check if any debt component has a defined value
  const hasDebtComponents = Object.keys(gt).some(
    (k) => k.startsWith('debt_components.') && gt[k as keyof GroundTruthValues] !== undefined
  );
  const hasFixedCharges = Object.keys(gt).some(
    (k) => k.startsWith('fixed_charges.') && gt[k as keyof GroundTruthValues] !== undefined
  );
  const hasAdjComponents = Object.keys(gt).some(
    (k) => k.startsWith('adjusted_ebitda_components.') && gt[k as keyof GroundTruthValues] !== undefined
  );

  return {
    revenue: gt.revenue ?? null,
    net_income: gt.net_income ?? null,
    expenses: gt.expenses ?? null,
    profit_margins: gt.profit_margins ?? null,
    interest: gt.interest ?? null,
    interest_income: null,
    taxes: gt.taxes ?? null,
    depreciation_amortization: gt.depreciation_amortization ?? null,
    depreciation_equipment: gt.depreciation_equipment ?? null,
    depreciation_rou: gt.depreciation_rou ?? null,
    depreciation_other: gt.depreciation_other ?? null,
    amortization_intangibles: gt.amortization_intangibles ?? null,
    ebitda: null, // Always null — we calculate, never use AI-reported
    shareholders_equity: gt.shareholders_equity ?? null,
    total_debt: null, // Always null — calculated from components
    senior_debt: null, // Always null — calculated from components
    current_assets: gt.current_assets ?? null,
    current_liabilities: gt.current_liabilities ?? null,
    capital_expenditures: gt.capital_expenditures ?? null,
    proceeds_from_long_term_debt: gt.proceeds_from_long_term_debt ?? null,
    cash_taxes_paid: gt.cash_taxes_paid ?? null,
    distributions_paid: gt.distributions_paid ?? null,
    ttm_principal_payments: gt.ttm_principal_payments ?? null,
    ttm_interest_expense: gt.ttm_interest_expense ?? null,
    repayment_of_debt: gt.repayment_of_debt ?? null,
    payment_of_lease_liability: gt.payment_of_lease_liability ?? null,
    cash_interest_paid: gt.cash_interest_paid ?? null,
    non_cash_interest_expense: gt.non_cash_interest_expense ?? null,
    debt_components: hasDebtComponents ? dc : null,
    fixed_charges: hasFixedCharges ? fc : null,
    adjusted_ebitda_components: hasAdjComponents ? adj : null,
  };
}

// Tolerance: 2% relative or 0.02 absolute for ratios near zero
function expectClose(actual: number | null | undefined, expected: number | undefined, label: string) {
  if (expected === undefined) return; // Skip unverified fields
  expect(actual, `${label} should not be null`).not.toBeNull();
  if (actual == null) return;

  // For ratios near zero, use absolute tolerance
  if (Math.abs(expected) < 0.1) {
    expect(actual).toBeCloseTo(expected, 1); // ±0.05
  } else {
    // Relative tolerance: within 3% of expected value
    const tolerance = Math.abs(expected) * 0.03;
    expect(
      Math.abs(actual - expected),
      `${label}: expected ${expected}, got ${actual} (tolerance ±${tolerance.toFixed(2)})`
    ).toBeLessThanOrEqual(tolerance);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Ground Truth Regression', () => {
  // Filter to entries with at least one computed ratio verified
  const testableEntries = GROUND_TRUTH.filter(
    (e) =>
      e.values.ebitda !== undefined ||
      e.values.adjusted_ebitda !== undefined ||
      e.values.fccr !== undefined ||
      e.values.dscr !== undefined
  );

  // Ensure we have test data
  it('has at least 3 ground truth entries with computed ratios', () => {
    expect(testableEntries.length).toBeGreaterThanOrEqual(3);
  });

  for (const entry of testableEntries) {
    describe(entry.document, () => {
      const metrics = buildMetrics(entry.values);
      const gt = entry.values;

      // ----- EBITDA -----
      if (gt.ebitda !== undefined) {
        it('EBITDA matches ground truth', () => {
          const result = calculateEBITDA(metrics);
          expect(result, 'calculateEBITDA should not return null').not.toBeNull();
          expectClose(result!.value, gt.ebitda, 'EBITDA');
        });
      }

      // ----- Adjusted EBITDA -----
      if (gt.adjusted_ebitda !== undefined && gt.ebitda !== undefined) {
        it('Adjusted EBITDA matches ground truth', () => {
          const ebitdaResult = calculateEBITDA(metrics);
          expect(ebitdaResult).not.toBeNull();
          const adjResult = calculateAdjustedEBITDA(
            ebitdaResult!.value,
            metrics,
            ebitdaResult!.usedGrossFallback
          );
          expectClose(adjResult.calculated_adjusted_ebitda, gt.adjusted_ebitda, 'Adjusted EBITDA');
        });
      }

      // ----- Debt Metrics -----
      if (gt.total_debt !== undefined) {
        it('Total Debt matches ground truth', () => {
          const debt = calculateDebtMetrics(metrics);
          expectClose(debt.total_debt, gt.total_debt, 'Total Debt');
        });
      }

      if (gt.senior_debt !== undefined) {
        it('Senior Debt matches ground truth', () => {
          const debt = calculateDebtMetrics(metrics);
          expectClose(debt.senior_debt, gt.senior_debt, 'Senior Debt');
        });
      }

      // ----- Coverage Ratios -----
      if (gt.fccr !== undefined && gt.adjusted_ebitda !== undefined) {
        it('FCCR matches ground truth', () => {
          const fccrResult = calculateFCCR(gt.adjusted_ebitda!, metrics);
          expectClose(fccrResult.fccr, gt.fccr, 'FCCR');
        });
      }

      if (gt.dscr !== undefined && gt.adjusted_ebitda !== undefined) {
        it('DSCR matches ground truth', () => {
          const dscrResult = calculateDSCR(gt.adjusted_ebitda!, metrics);
          expectClose(dscrResult.dscr, gt.dscr, 'DSCR');
        });
      }

      // ----- Leverage & Liquidity Ratios -----
      if (gt.total_debt_to_capital !== undefined && gt.total_debt !== undefined && gt.shareholders_equity !== undefined) {
        it('Total Debt/Capital matches ground truth', () => {
          const ratio = calculateTotalDebtToCapital(gt.total_debt!, gt.shareholders_equity!);
          expectClose(ratio, gt.total_debt_to_capital, 'Total Debt/Capital');
        });
      }

      if (gt.senior_debt_to_ebitda !== undefined && gt.senior_debt !== undefined && gt.adjusted_ebitda !== undefined) {
        it('Senior Debt/EBITDA matches ground truth', () => {
          const ratio = calculateSeniorDebtToEBITDA(gt.senior_debt!, gt.adjusted_ebitda!);
          expectClose(ratio, gt.senior_debt_to_ebitda, 'Sr Debt/EBITDA');
        });
      }

      if (gt.interest_coverage_ratio !== undefined && gt.ebitda !== undefined && gt.interest !== undefined) {
        it('Interest Coverage Ratio matches ground truth', () => {
          const ratio = calculateInterestCoverageRatio(gt.ebitda!, gt.interest!);
          expectClose(ratio, gt.interest_coverage_ratio, 'ICR');
        });
      }

      if (gt.debt_to_equity_ratio !== undefined && gt.total_debt !== undefined && gt.shareholders_equity !== undefined) {
        it('Debt/Equity matches ground truth', () => {
          const ratio = calculateDebtToEquityRatio(gt.total_debt!, gt.shareholders_equity!);
          expectClose(ratio, gt.debt_to_equity_ratio, 'Debt/Equity');
        });
      }

      if (gt.current_ratio !== undefined && gt.current_assets !== undefined && gt.current_liabilities !== undefined) {
        it('Current Ratio matches ground truth', () => {
          const ratio = calculateCurrentRatio(gt.current_assets!, gt.current_liabilities!);
          expectClose(ratio, gt.current_ratio, 'Current Ratio');
        });
      }
    });
  }
});

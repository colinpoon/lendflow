/**
 * EBITDA Coverage Ratio calculation utilities
 *
 * Formula: Adjusted EBITDA / Total Debt Service
 *
 * Unlike FCCR, this ratio does NOT deduct CapEx, cash taxes, or distributions
 * from the numerator — it measures raw EBITDA capacity to service debt.
 *
 * Banks typically require >= 1.25:1.00
 */

import type { ExtractedMetrics, DSCRBreakdown, DebtComponents } from '@/types';
import { resolveDebtService } from './debt-service-resolver';

export interface DSCRCalculationResult {
  dscr: number | null;
  funded_debt: number | null;
  funded_debt_to_ebitda: number | null;
  dscr_breakdown: DSCRBreakdown | null;
  /** Analyst-facing warnings from debt service resolution (e.g. gross revolver distortion). */
  warnings: string[];
}

/**
 * Calculate EBITDA Coverage Ratio (Adjusted EBITDA / Total Debt Service)
 *
 * Total Debt Service = Principal Payments + Interest Payments (cash basis)
 *
 * Also calculates:
 * - Funded Debt = Senior bank debt + finance lease liabilities
 *   (excludes: subordinated notes, convertible debt, bonds/debentures, notes payable)
 * - Funded Debt / EBITDA ratio
 *
 * @param adjustedEbitda - The adjusted EBITDA value
 * @param metrics - The extracted financial metrics
 */
export function calculateDSCR(
  adjustedEbitda: number | null,
  metrics: ExtractedMetrics,
  year?: string
): DSCRCalculationResult {
  // Cannot calculate without EBITDA
  if (adjustedEbitda == null) {
    return {
      dscr: null,
      funded_debt: null,
      funded_debt_to_ebitda: null,
      dscr_breakdown: null,
      warnings: [],
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Calculate Funded Debt
  //
  // Funded Debt = Senior bank debt + finance lease liabilities
  //
  // Includes:
  //   - Bank credit facilities (current + long-term)
  //   - Term loans, revolving credit, overdraft, lines of credit
  //   - Finance lease liabilities (contractual debt-like obligations to lessors)
  //
  // Excludes (non-bank investor obligations):
  //   - Operating lease liabilities (treatment depends on senior debt config)
  //   - Subordinated debt, convertible debt, bonds/debentures, notes payable
  //
  // NOTE: senior_debt in debt-calculator.ts = totalBankDebt + leases (when mode='include').
  // Funded Debt here also includes leases, but is computed independently from debt_components
  // to ensure DSCR uses the same lease total regardless of the senior debt config.
  // ─────────────────────────────────────────────────────────────────────────

  const dc = (metrics.debt_components || {}) as DebtComponents;

  // Bank debt components (senior/secured)
  const bankDebtCurrent = dc.bank_debt_current ?? 0;
  const bankDebtLongTerm = dc.bank_debt_long_term ?? 0;
  const termLoans = dc.term_loans ?? 0;
  const revolvingCredit = dc.revolving_credit_facilities ?? 0;
  const overdraft = dc.overdraft_facilities ?? 0;
  const linesOfCredit = dc.lines_of_credit ?? 0;

  // Calculate total bank debt (same logic as debt-calculator.ts senior_debt)
  // Only trust the aggregate when BOTH current and long-term are extracted.
  // If either is null, the aggregate is incomplete and may understate bank debt.
  let totalBankDebt: number;
  if (dc.bank_debt_current != null && dc.bank_debt_long_term != null) {
    totalBankDebt = bankDebtCurrent + bankDebtLongTerm;
  } else {
    const disaggregated = termLoans + revolvingCredit + overdraft + linesOfCredit;
    const partial = bankDebtCurrent + bankDebtLongTerm;
    totalBankDebt = disaggregated > 0 ? Math.max(disaggregated, partial) : partial;
  }

  // Finance lease liabilities only — operating leases are excluded per banking convention.
  // Prefer explicit current + long-term breakdown; fall back to the aggregated finance_lease field.
  // We deliberately exclude operating_lease_liabilities because those are IFRS 16 / ASC 842
  // right-of-use liabilities that banks exclude from funded debt covenants.
  const leaseCurrentDirect = dc.lease_liabilities_current ?? 0;
  const leaseLongTermDirect = dc.lease_liabilities_long_term ?? 0;
  const financeLeaseAggregated = dc.finance_lease_liabilities ?? 0;

  // Use the explicit current/long-term split when both components are non-null (most precise).
  // Fall back to the finance_lease_liabilities aggregate if the split is absent.
  // If neither is available, default to zero (no lease component added).
  let financeLeaseDebt: number;
  if (dc.lease_liabilities_current != null || dc.lease_liabilities_long_term != null) {
    financeLeaseDebt = leaseCurrentDirect + leaseLongTermDirect;
  } else {
    financeLeaseDebt = financeLeaseAggregated;
  }

  // Funded Debt = bank debt + finance lease liabilities
  // This is distinct from Senior Debt (bank debt only) and Total Debt (includes sub debt + operating leases)
  const fundedDebt = totalBankDebt + financeLeaseDebt;

  // ─────────────────────────────────────────────────────────────────────────
  // Calculate Total Debt Service (via shared resolver)
  //
  // Uses the same priority chains as FCCR to ensure consistent denominator
  // resolution across both ratios. See debt-service-resolver.ts for details.
  // ─────────────────────────────────────────────────────────────────────────

  const debtService = resolveDebtService(metrics, year);
  const repaymentOfDebt = debtService.principal;
  const cashInterestPaid = debtService.interest;
  const leasePayments = debtService.leases;
  const totalDebtService = debtService.total;

  // Cannot calculate without debt service
  if (totalDebtService === 0) {
    return {
      dscr: null,
      // A zero funded debt balance is meaningful (all debt paid off) — display it, don't null it.
      // Only null when fundedDebt itself could not be computed (i.e. debt_components absent).
      funded_debt: fundedDebt != null ? fundedDebt : null,
      funded_debt_to_ebitda: null,
      dscr_breakdown: null,
      warnings: debtService.warnings,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Calculate DSCR
  // ─────────────────────────────────────────────────────────────────────────

  const dscr = parseFloat((adjustedEbitda / totalDebtService).toFixed(2));

  // ─────────────────────────────────────────────────────────────────────────
  // Calculate Funded Debt / EBITDA
  // ─────────────────────────────────────────────────────────────────────────

  // A negative funded debt/EBITDA ratio is a critical distress signal — do NOT suppress it.
  // Only guard against division by zero (adjustedEbitda === 0) and a missing funded debt position.
  const fundedDebtToEbitda =
    fundedDebt != null && adjustedEbitda !== 0
      ? parseFloat((fundedDebt / adjustedEbitda).toFixed(2))
      : null;

  return {
    dscr,
    // Zero funded debt is valid (fully paid off) — only null when the value was never computable.
    funded_debt: fundedDebt != null ? fundedDebt : null,
    funded_debt_to_ebitda: fundedDebtToEbitda,
    dscr_breakdown: {
      calculation_type: 'ebitda_coverage',
      adjusted_ebitda: adjustedEbitda,
      bank_principal_payments: repaymentOfDebt,
      bank_interest_expense: cashInterestPaid,
      lease_payments: leasePayments,
      total_debt_service: totalDebtService,
      dscr,
      // funded_debt = senior bank debt + finance lease liabilities
      // (excludes sub debt, convertible debt, bonds, notes payable)
      funded_debt: fundedDebt,
      funded_debt_to_ebitda: fundedDebtToEbitda,
    },
    warnings: debtService.warnings,
  };
}

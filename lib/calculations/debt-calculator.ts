/**
 * Debt calculation utilities
 * Calculates senior debt, total debt, and debt breakdown from components
 */

import type {
  ExtractedMetrics,
  DebtBreakdown,
  DebtComponents,
  LeaseDebtTreatmentConfig,
} from '@/types';

export interface DebtCalculationResult {
  senior_debt: number | null;
  total_debt: number | null;
  debt_breakdown: DebtBreakdown;
}

/** Default lease debt treatment: include IFRS 16 leases in Senior Debt */
export const DEFAULT_LEASE_DEBT_TREATMENT: LeaseDebtTreatmentConfig = {
  mode: 'include',
};

/**
 * Calculate debt metrics from extracted debt components
 *
 * Senior Debt treatment (configurable via leaseConfig):
 * - 'include' (DEFAULT): Senior Debt = bank debt + IFRS 16 lease liabilities
 *   Correct for post-2019 IFRS borrowers where all leases are on-balance-sheet obligations.
 *   Example: Zedcor FY2023 = $16,634K bank debt + $7,731K leases = $24,365K
 * - 'exclude': Senior Debt = bank debt only
 *   Appropriate for pre-IFRS 16 or US GAAP / older covenant definitions.
 *
 * Total Debt = bank debt + lease liabilities + subordinated debt (all interest-bearing obligations)
 *
 * Lease liability source priority (avoids double-counting):
 * 1. lease_liabilities_current + lease_liabilities_long_term (IFRS 16 total, both types combined)
 * 2. finance_lease_liabilities + operating_lease_liabilities (fallback when split not available)
 *
 * @param metrics - Extracted financial metrics for one fiscal year
 * @param leaseConfig - Controls whether lease liabilities are included in Senior Debt
 */
export function calculateDebtMetrics(
  metrics: ExtractedMetrics,
  leaseConfig: LeaseDebtTreatmentConfig = DEFAULT_LEASE_DEBT_TREATMENT
): DebtCalculationResult {
  const dc = (metrics.debt_components || {}) as DebtComponents;

  // ─────────────────────────────────────────────────────────────────────────
  // Calculate Bank Debt
  // ─────────────────────────────────────────────────────────────────────────

  const bankDebtCurrent = dc.bank_debt_current ?? 0;
  const bankDebtLongTerm = dc.bank_debt_long_term ?? 0;
  const termLoans = dc.term_loans ?? 0;
  const revolvingCredit = dc.revolving_credit_facilities ?? 0;
  const overdraft = dc.overdraft_facilities ?? 0;
  const linesOfCredit = dc.lines_of_credit ?? 0;

  // Total bank debt = explicit bank debt OR sum of loan components
  let totalBankDebt = bankDebtCurrent + bankDebtLongTerm;
  if (totalBankDebt === 0) {
    totalBankDebt = termLoans + revolvingCredit + overdraft + linesOfCredit;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Calculate Lease Liabilities
  // Priority: current + long-term split (IFRS 16 total) → finance + operating fallback
  // The current/long-term fields represent the full IFRS 16 balance (both types combined),
  // so we only fall back to the type-split fields when the maturity split is unavailable.
  // ─────────────────────────────────────────────────────────────────────────

  const leaseCurrentDirect = dc.lease_liabilities_current ?? 0;
  const leaseLongTermDirect = dc.lease_liabilities_long_term ?? 0;
  const financeLease = dc.finance_lease_liabilities ?? 0;
  const operatingLease = dc.operating_lease_liabilities ?? 0;

  let totalLeaseDebt = leaseCurrentDirect + leaseLongTermDirect;
  if (totalLeaseDebt === 0) {
    totalLeaseDebt = financeLease + operatingLease;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Calculate Non-Senior (Subordinated) Debt
  // ─────────────────────────────────────────────────────────────────────────

  const notesPayable = dc.notes_payable ?? 0;
  const subordinatedDebt = dc.subordinated_debt ?? 0;
  const convertibleDebt = dc.convertible_debt ?? 0;
  const bondsDebentures = dc.bonds_debentures ?? 0;
  const otherBorrowings = dc.other_borrowings ?? 0;

  const totalNonSeniorDebt =
    notesPayable + subordinatedDebt + convertibleDebt + bondsDebentures + otherBorrowings;

  // ─────────────────────────────────────────────────────────────────────────
  // Compute Senior Debt (configurable lease treatment)
  // ─────────────────────────────────────────────────────────────────────────

  const leasesInSeniorDebt = leaseConfig.mode === 'include' ? totalLeaseDebt : 0;
  const computedSeniorDebt = totalBankDebt + leasesInSeniorDebt;

  // Total debt = bank debt + lease liabilities + non-senior debt (all interest-bearing obligations)
  const computedTotalDebt = totalBankDebt + totalLeaseDebt + totalNonSeniorDebt;

  return {
    senior_debt:
      computedSeniorDebt > 0
        ? computedSeniorDebt
        : metrics.senior_debt ?? null,
    total_debt: computedTotalDebt > 0 ? computedTotalDebt : metrics.total_debt,
    debt_breakdown: {
      bank_debt: totalBankDebt,
      lease_liabilities: totalLeaseDebt,
      lease_liabilities_in_senior_debt: leasesInSeniorDebt,
      notes_payable: notesPayable,
      subordinated_debt: subordinatedDebt,
      other_non_senior_debt: convertibleDebt + bondsDebentures + otherBorrowings,
    },
  };
}

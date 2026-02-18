/**
 * Debt calculation utilities
 * Calculates senior debt, total debt, and debt breakdown from components
 */

import type { ExtractedMetrics, DebtBreakdown, DebtComponents } from '@/types';

export interface DebtCalculationResult {
  senior_debt: number | null;
  total_debt: number | null;
  debt_breakdown: DebtBreakdown;
}

/**
 * Calculate debt metrics from extracted debt components
 * Senior debt = funded bank debt ONLY (excludes IFRS 16 lease liabilities per banking covenant convention)
 * Total debt = bank debt + lease liabilities + subordinated debt (all interest-bearing obligations)
 */
export function calculateDebtMetrics(
  metrics: ExtractedMetrics
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
  // ─────────────────────────────────────────────────────────────────────────

  const leaseCurrentDirect = dc.lease_liabilities_current ?? 0;
  const leaseLongTermDirect = dc.lease_liabilities_long_term ?? 0;
  const financeLease = dc.finance_lease_liabilities ?? 0;
  const operatingLease = dc.operating_lease_liabilities ?? 0;

  // Total lease liabilities = explicit lease liabilities OR sum of lease types
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
  // Compute Final Values
  // ─────────────────────────────────────────────────────────────────────────

  // Senior Debt = funded bank debt ONLY (credit facilities, term loans, revolvers).
  // IFRS 16/ASC 842 lease liabilities are excluded per banking covenant convention.
  // Lease obligations are separately captured in FCCR/DSCR via payment_of_lease_liability.
  const computedSeniorDebt = totalBankDebt;

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
      notes_payable: notesPayable,
      subordinated_debt: subordinatedDebt,
      other_non_senior_debt: convertibleDebt + bondsDebentures + otherBorrowings,
    },
  };
}

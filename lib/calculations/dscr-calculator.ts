/**
 * DSCR (Debt Service Coverage Ratio) calculation utilities
 * Banker's covenant formula for debt servicing capacity
 *
 * This differs from FCCR in that it uses the simpler banker's definition:
 * DSCR = Adjusted EBITDA / Total Debt Service
 *
 * Banks typically require DSCR >= 1.25:1.00
 */

import type { ExtractedMetrics, DSCRBreakdown, DebtComponents } from '@/types';

export interface DSCRCalculationResult {
  dscr: number | null;
  funded_debt: number | null;
  funded_debt_to_ebitda: number | null;
  dscr_breakdown: DSCRBreakdown | null;
}

/**
 * Calculate Debt Service Coverage Ratio (DSCR) using banker's covenant formula
 *
 * Banker's formula:
 * - DSCR = Adjusted EBITDA / Total Debt Service
 * - Total Debt Service = Principal Payments + Interest Payments (cash basis)
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
  metrics: ExtractedMetrics
): DSCRCalculationResult {
  // Cannot calculate without EBITDA
  if (adjustedEbitda == null) {
    return {
      dscr: null,
      funded_debt: null,
      funded_debt_to_ebitda: null,
      dscr_breakdown: null,
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
  //   - Operating lease liabilities (excluded per IFRS 16 / ASC 842 covenant convention)
  //   - Subordinated debt, convertible debt, bonds/debentures, notes payable
  //
  // NOTE: senior_debt in debt-calculator.ts = totalBankDebt only (no lease components),
  // so adding finance leases here does NOT double-count.
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
  let totalBankDebt = bankDebtCurrent + bankDebtLongTerm;
  if (totalBankDebt === 0) {
    totalBankDebt = termLoans + revolvingCredit + overdraft + linesOfCredit;
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
  // Calculate Total Debt Service (Cash Basis)
  // ─────────────────────────────────────────────────────────────────────────

  // Principal payments (from cash flow statement)
  const repaymentOfDebt = metrics.repayment_of_debt ?? metrics.ttm_principal_payments ?? 0;
  const leasePayments = metrics.payment_of_lease_liability ?? 0;

  // Interest payments (prefer cash interest paid, fallback to income statement)
  const cashInterestPaid = metrics.cash_interest_paid ?? metrics.ttm_interest_expense ?? metrics.interest ?? 0;

  // Total debt service for DSCR calculation
  // Bankers typically include: bank debt principal + bank interest + lease payments
  const totalDebtService = repaymentOfDebt + cashInterestPaid + leasePayments;

  // Cannot calculate without debt service
  if (totalDebtService === 0) {
    return {
      dscr: null,
      funded_debt: fundedDebt > 0 ? fundedDebt : null,
      funded_debt_to_ebitda: null,
      dscr_breakdown: null,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Calculate DSCR
  // ─────────────────────────────────────────────────────────────────────────

  const dscr = parseFloat((adjustedEbitda / totalDebtService).toFixed(2));

  // ─────────────────────────────────────────────────────────────────────────
  // Calculate Funded Debt / EBITDA
  // ─────────────────────────────────────────────────────────────────────────

  const fundedDebtToEbitda =
    fundedDebt > 0 && adjustedEbitda > 0
      ? parseFloat((fundedDebt / adjustedEbitda).toFixed(2))
      : null;

  return {
    dscr,
    funded_debt: fundedDebt > 0 ? fundedDebt : null,
    funded_debt_to_ebitda: fundedDebtToEbitda,
    dscr_breakdown: {
      calculation_type: 'banker_covenant',
      adjusted_ebitda: adjustedEbitda,
      bank_principal_payments: repaymentOfDebt,
      bank_interest_expense: cashInterestPaid,
      lease_payments: leasePayments,
      total_debt_service: totalDebtService,
      dscr,
      // funded_debt = senior bank debt + finance lease liabilities
      // (excludes sub debt, convertible debt, bonds, notes payable)
      funded_debt: fundedDebt,
      funded_debt_to_ebitda: fundedDebtToEbitda ?? 0,
    },
  };
}

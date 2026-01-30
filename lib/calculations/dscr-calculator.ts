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
 * - Funded Debt = Bank debt only (excludes subordinated notes)
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
  // Calculate Funded Debt (Bank Debt Only - excludes subordinated notes)
  // ─────────────────────────────────────────────────────────────────────────

  const dc = (metrics.debt_components || {}) as DebtComponents;

  // Bank debt components (senior/secured)
  const bankDebtCurrent = dc.bank_debt_current ?? 0;
  const bankDebtLongTerm = dc.bank_debt_long_term ?? 0;
  const termLoans = dc.term_loans ?? 0;
  const revolvingCredit = dc.revolving_credit_facilities ?? 0;
  const overdraft = dc.overdraft_facilities ?? 0;
  const linesOfCredit = dc.lines_of_credit ?? 0;

  // Calculate total bank debt
  let totalBankDebt = bankDebtCurrent + bankDebtLongTerm;
  if (totalBankDebt === 0) {
    totalBankDebt = termLoans + revolvingCredit + overdraft + linesOfCredit;
  }

  // Funded Debt = Bank debt only (per typical bank covenant definition)
  // This EXCLUDES: lease liabilities, notes payable, subordinated debt
  const fundedDebt = totalBankDebt;

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
      funded_debt: fundedDebt,
      funded_debt_to_ebitda: fundedDebtToEbitda ?? 0,
    },
  };
}

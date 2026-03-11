/**
 * Shared debt service resolver for FCCR and DSCR denominators
 *
 * Resolves principal, interest, and lease components using priority chains
 * that prefer balance-sheet scheduled amounts over gross cash-flow figures.
 *
 * Priority chains:
 *   Principal: debt_components.bank_debt_current > repayment_of_debt > ttm_principal_payments
 *   Interest:  cash_interest_paid (cross-checked vs accrual) > total_interest_expense > ttm_interest_expense > interest (accrual)
 *   Leases:    fixed_charges.finance_lease_payments > debt_components.lease_liabilities_current > payment_of_lease_liability
 */

import type { ExtractedMetrics, DebtComponents, FixedCharges } from '@/types';

export type DebtServiceSource =
  | 'bank_debt_current'
  | 'repayment_of_debt'
  | 'ttm_principal_payments'
  | 'cash_interest_paid'
  | 'total_interest_expense'
  | 'ttm_interest_expense'
  | 'interest_accrual'
  | 'finance_lease_payments'
  | 'lease_liabilities_current'
  | 'payment_of_lease_liability'
  | 'none';

export interface ResolvedDebtService {
  principal: number;
  interest: number;
  leases: number;
  total: number;
  sources: {
    principal_source: DebtServiceSource;
    principal_value: number | null;
    interest_source: DebtServiceSource;
    /** Final resolved interest after any lease interest deduction. Not the raw extracted value. */
    interest_value: number | null;
    lease_source: DebtServiceSource;
    lease_value: number | null;
    /** Amount of lease interest deducted from the interest component to prevent
     *  double-counting when leases are added separately. Null when no deduction applied. */
    lease_interest_deducted: number | null;
  };
}

/**
 * Resolve debt service components using priority chains.
 *
 * The key fixes vs the previous ad-hoc approach:
 * 1. Principal prefers balance-sheet current portion (scheduled repayments)
 *    over cash-flow repayment_of_debt (which includes gross refinancing flows).
 * 2. Leases are resolved independently — no longer bundled inside ttm_principal_payments,
 *    eliminating the double-count that inflated FCCR/DSCR denominators.
 * 3. Finance leases only — operating lease payments are excluded per banking convention.
 */
export function resolveDebtService(metrics: ExtractedMetrics): ResolvedDebtService {
  const dc = (metrics.debt_components || {}) as DebtComponents;
  const fc = (metrics.fixed_charges || {}) as FixedCharges;

  // ── Principal ──────────────────────────────────────────────────────────
  // Prefer balance-sheet current portion of bank debt (scheduled repayments)
  // over cash-flow repayment_of_debt (which captures gross refinancing outflows).
  let principal = 0;
  let principalSource: DebtServiceSource = 'none';

  if (dc.bank_debt_current != null && dc.bank_debt_current > 0) {
    principal = dc.bank_debt_current;
    principalSource = 'bank_debt_current';
  } else if (metrics.repayment_of_debt != null && metrics.repayment_of_debt > 0) {
    principal = metrics.repayment_of_debt;
    principalSource = 'repayment_of_debt';
  } else if (metrics.ttm_principal_payments != null && metrics.ttm_principal_payments > 0) {
    principal = metrics.ttm_principal_payments;
    principalSource = 'ttm_principal_payments';
  }

  // ── Interest ───────────────────────────────────────────────────────────
  // Prefer cash basis interest, but cross-check against accrual totals.
  //
  // Problem this solves: Some financial statements disclose interest paid
  // as separate lines (e.g., "Interest on bank indebtedness" and "Interest
  // on lease liabilities"). The AI may extract only one component into
  // cash_interest_paid, producing an implausibly low figure. When the P&L
  // total_interest_expense or interest figure is materially larger, prefer
  // the larger value since the cash figure is likely incomplete.
  let interest = 0;
  let interestSource: DebtServiceSource = 'none';

  // Gather all available interest figures
  const cashInterest = metrics.cash_interest_paid ?? 0;
  const fcTotalInterest = fc.total_interest_expense ?? 0;
  const ttmInterest = metrics.ttm_interest_expense ?? 0;
  const plInterest = metrics.interest ?? 0;

  // Pick the best available figure using priority + cross-check
  if (cashInterest > 0) {
    interest = cashInterest;
    interestSource = 'cash_interest_paid';

    // Cross-check: if an accrual total is materially larger (>1.5x), the
    // cash figure likely captured only one component (e.g., lease interest
    // but not bank interest). Prefer the larger accrual figure.
    //
    // NOTE: plInterest (P&L finance costs) may include non-cash components
    // (accretion, amortization of financing fees) that slightly inflate the
    // denominator. It is retained as a last-resort fallback only. The preferred
    // signals are fcTotalInterest and ttmInterest which are closer to cash basis.
    // Determine the best accrual figure and track which variable won directly,
    // avoiding floating-point === comparisons after Math.max which can silently
    // mislabel the source when two values are nearly identical.
    let accrualBest = 0;
    let accrualBestSource: DebtServiceSource = 'none';
    if (fcTotalInterest >= ttmInterest && fcTotalInterest >= plInterest) {
      accrualBest = fcTotalInterest;
      accrualBestSource = 'total_interest_expense';
    } else if (ttmInterest >= plInterest) {
      accrualBest = ttmInterest;
      accrualBestSource = 'ttm_interest_expense';
    } else {
      accrualBest = plInterest;
      accrualBestSource = 'interest_accrual';
    }

    if (accrualBest > cashInterest * 1.5) {
      interest = accrualBest;
      interestSource = accrualBestSource;
    }
  } else if (fcTotalInterest > 0) {
    interest = fcTotalInterest;
    interestSource = 'total_interest_expense';
  } else if (ttmInterest > 0) {
    interest = ttmInterest;
    interestSource = 'ttm_interest_expense';
  } else if (plInterest > 0) {
    interest = plInterest;
    interestSource = 'interest_accrual';
  }

  // ── Leases (finance only) ─────────────────────────────────────────────
  // Banks exclude IFRS 16 operating lease payments from FCCR/DSCR.
  // Prefer explicit finance lease payments from fixed_charges,
  // then balance-sheet current lease liabilities,
  // then cash-flow payment_of_lease_liability as last resort.
  let leases = 0;
  let leaseSource: DebtServiceSource = 'none';

  if (fc.finance_lease_payments != null && fc.finance_lease_payments > 0) {
    leases = fc.finance_lease_payments;
    leaseSource = 'finance_lease_payments';
  } else if (dc.lease_liabilities_current != null && dc.lease_liabilities_current > 0) {
    leases = dc.lease_liabilities_current;
    leaseSource = 'lease_liabilities_current';
  } else if (metrics.payment_of_lease_liability != null && metrics.payment_of_lease_liability > 0) {
    leases = metrics.payment_of_lease_liability;
    leaseSource = 'payment_of_lease_liability';
  }

  // ── Lease Interest Double-Count Prevention ────────────────────────────
  // When the interest source is a P&L/accrual-based figure (total_interest_expense,
  // ttm_interest_expense, or interest_accrual), it includes IFRS 16 "Interest on
  // lease liabilities" as a P&L finance cost. Since lease payments are also added
  // separately above (and their payments include both principal AND interest on the
  // lease), the lease interest would be counted twice in the denominator:
  //   1. Inside the `interest` component (from the P&L total that includes lease interest)
  //   2. Inside the `leases` component (full lease payment which includes lease interest)
  //
  // Fix: when leases > 0 and the interest source is P&L-based, subtract
  // fc.lease_interest from interest. Floor at 0 to prevent negative interest.
  //
  // cash_interest_paid is excluded from this deduction — it is a cash-basis figure
  // representing actual bank interest outflows and typically does not include
  // the IFRS 16 lease interest accrual.
  const PL_BASED_SOURCES: DebtServiceSource[] = [
    'total_interest_expense',
    'ttm_interest_expense',
    'interest_accrual',
  ];

  let leaseInterestDeducted: number | null = null;

  if (
    leases > 0 &&
    PL_BASED_SOURCES.includes(interestSource) &&
    fc.lease_interest != null &&
    fc.lease_interest > 0
  ) {
    leaseInterestDeducted = fc.lease_interest;
    interest = Math.max(0, interest - fc.lease_interest);
  }

  return {
    principal,
    interest,
    leases,
    total: principal + interest + leases,
    sources: {
      principal_source: principalSource,
      principal_value: principal || null,
      interest_source: interestSource,
      interest_value: interest || null,
      lease_source: leaseSource,
      lease_value: leases || null,
      lease_interest_deducted: leaseInterestDeducted,
    },
  };
}

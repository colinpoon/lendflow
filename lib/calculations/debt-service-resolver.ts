/**
 * Shared debt service resolver for FCCR and DSCR denominators
 *
 * Resolves principal, interest, and lease components using priority chains
 * that prefer balance-sheet scheduled amounts over gross cash-flow figures.
 *
 * Priority chains:
 *   Principal: debt_components.bank_debt_current > repayment_of_debt > ttm_principal_payments
 *   Interest:  cash_interest_paid > ttm_interest_expense > interest (accrual)
 *   Leases:    fixed_charges.finance_lease_payments > debt_components.lease_liabilities_current > payment_of_lease_liability
 */

import type { ExtractedMetrics, DebtComponents, FixedCharges } from '@/types';

export type DebtServiceSource =
  | 'bank_debt_current'
  | 'repayment_of_debt'
  | 'ttm_principal_payments'
  | 'cash_interest_paid'
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
    interest_value: number | null;
    lease_source: DebtServiceSource;
    lease_value: number | null;
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
  // Prefer cash basis interest over accrual.
  let interest = 0;
  let interestSource: DebtServiceSource = 'none';

  if (metrics.cash_interest_paid != null && metrics.cash_interest_paid > 0) {
    interest = metrics.cash_interest_paid;
    interestSource = 'cash_interest_paid';
  } else if (metrics.ttm_interest_expense != null && metrics.ttm_interest_expense > 0) {
    interest = metrics.ttm_interest_expense;
    interestSource = 'ttm_interest_expense';
  } else if (metrics.interest != null && metrics.interest > 0) {
    interest = metrics.interest;
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
    },
  };
}

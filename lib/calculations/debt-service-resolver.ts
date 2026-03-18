/**
 * Shared debt service resolver for FCCR and DSCR denominators
 *
 * Resolves principal, interest, and lease components using priority chains.
 *
 * Priority chains:
 *   Principal: repayment_of_debt > debt_components.bank_debt_current > ttm_principal_payments
 *              (repayment_of_debt captures ALL debt classes retired, not just bank debt)
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
  | 'operating_lease_payments'
  | 'none';

export interface ResolvedDebtService {
  principal: number;
  interest: number;
  leases: number;
  /** Operating lease payments resolved separately — NOT included in `total`.
   *  Only added to FCCR denominator when operatingLeaseConfig.mode === 'include'. */
  operatingLeases: number;
  /**
   * Preferred dividends from fixed_charges.preferred_dividends.
   * NOT included in `total` — excluded from DSCR (banker's ratio) but added to
   * FCCR denominator by fccr-calculator.ts, where preferred dividends are a
   * contractual senior fixed obligation per commercial lending convention.
   */
  preferredDividends: number;
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
    operating_lease_source: 'operating_lease_payments' | 'none';
    operating_lease_value: number | null;
    preferred_dividends_value: number | null;
  };
  /**
   * Analyst-facing warnings that should be surfaced in the UI.
   * Populated when a data quality concern requires human review
   * (e.g., potential gross revolving credit distortion in principal).
   */
  warnings: string[];
}

/**
 * Resolve debt service components using priority chains.
 *
 * Key design decisions:
 * 1. Principal prefers repayment_of_debt (actual cash paid, all debt classes) over
 *    bank_debt_current (forward-looking bank portion only). bank_debt_current misses
 *    repayments on notes_payable, subordinated debt, and other obligations. For covenant
 *    compliance testing, actual debt service paid is the correct measure.
 * 2. Leases are resolved independently — no longer bundled inside ttm_principal_payments,
 *    eliminating the double-count that inflated FCCR/DSCR denominators.
 * 3. Finance leases only — operating lease payments are excluded per banking convention.
 * 4. Lease interest deduction only applies when lease source is a total cash payment
 *    (includes principal + interest). Balance sheet current portions are principal-only
 *    and do NOT embed interest — deducting lease interest in that case causes it to
 *    vanish from the denominator entirely.
 */
export function resolveDebtService(metrics: ExtractedMetrics, year?: string): ResolvedDebtService {
  const yearTag = year ? `[${year}] ` : '';
  const dc = (metrics.debt_components || {}) as DebtComponents;
  const fc = (metrics.fixed_charges || {}) as FixedCharges;

  // Analyst-facing warnings accumulated during resolution.
  // These are returned in the result and should be surfaced to the UI.
  const warnings: string[] = [];

  // ── Principal ──────────────────────────────────────────────────────────
  // Prefer repayment_of_debt (cash flow financing activities) — captures ALL
  // debt classes retired during the year (bank debt, notes payable, promissory
  // notes, other borrowings). bank_debt_current is the balance sheet current
  // portion of bank debt ONLY and systematically understates principal for
  // companies with non-bank obligations.
  //
  // Risk: repayment_of_debt can include gross revolving credit draws/repays
  // for US GAAP revolvers. For IFRS term borrowers this is rarely an issue.
  // A sanity-check warning is logged when repayment_of_debt materially exceeds
  // bank_debt_current to flag potential gross refinancing distortion.
  let principal = 0;
  let principalSource: DebtServiceSource = 'none';

  if (metrics.repayment_of_debt != null && metrics.repayment_of_debt > 0) {
    principal = metrics.repayment_of_debt;
    principalSource = 'repayment_of_debt';
  } else if (dc.bank_debt_current != null && dc.bank_debt_current > 0) {
    principal = dc.bank_debt_current;
    principalSource = 'bank_debt_current';
  } else if (metrics.ttm_principal_payments != null && metrics.ttm_principal_payments > 0) {
    principal = metrics.ttm_principal_payments;
    principalSource = 'ttm_principal_payments';
  }

  // Sanity check: warn when repayment_of_debt materially exceeds bank_debt_current.
  // A >50% gap suggests either (a) non-bank debt was repaid (legitimate), or
  // (b) gross revolving credit activity inflated the figure (needs analyst review).
  if (
    principalSource === 'repayment_of_debt' &&
    dc.bank_debt_current != null &&
    dc.bank_debt_current > 0 &&
    principal > dc.bank_debt_current * 1.5
  ) {
    const overagePct = ((principal / dc.bank_debt_current - 1) * 100).toFixed(0);
    const warnMsg =
      `${yearTag}DSCR/FCCR: repayment_of_debt (${principal.toLocaleString()}) exceeds ` +
      `bank_debt_current (${dc.bank_debt_current.toLocaleString()}) by ${overagePct}%. ` +
      `If the company has a revolving credit facility, gross draws and repayments may both ` +
      `appear in this line, inflating the denominator and understating coverage. ` +
      `Verify against the financing activities note.`;
    console.warn(`⚠️ ${warnMsg}`);
    warnings.push(warnMsg);
  }

  // Additional check: when repayment_of_debt is substantially larger than the
  // revolving credit balance, the excess is likely gross revolving activity.
  // A company drawing and fully repaying a $20M revolver 12x/year would show
  // $240M in repayment_of_debt against a $20M balance — a classic distortion.
  if (
    principalSource === 'repayment_of_debt' &&
    dc.revolving_credit_facilities != null &&
    dc.revolving_credit_facilities > 0 &&
    principal > dc.revolving_credit_facilities * 3
  ) {
    const revolvingWarnMsg =
      `${yearTag}DSCR/FCCR: repayment_of_debt (${principal.toLocaleString()}) is ` +
      `${(principal / dc.revolving_credit_facilities).toFixed(1)}x the revolving_credit_facilities ` +
      `balance (${dc.revolving_credit_facilities.toLocaleString()}). ` +
      `Gross revolving credit activity likely inflates the DSCR/FCCR denominator. ` +
      `Consider using net revolving repayment or capping principal at funded debt balance.`;
    console.warn(`⚠️ ${revolvingWarnMsg}`);
    // Only push if not already warned (avoid duplicate messages when both conditions fire)
    if (!warnings.some(w => w.includes('revolving_credit_facilities'))) {
      warnings.push(revolvingWarnMsg);
    }
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

    // Cross-check: if an accrual total is materially larger (>1.15x), the
    // cash figure likely captured only one component (e.g., lease interest
    // but not bank interest). Prefer the larger accrual figure.
    //
    // Threshold rationale: cash interest paid and accrual interest expense
    // should differ only by timing (accrued-but-unpaid at period boundaries,
    // amortization of issuance costs). A 15% tolerance accommodates those
    // legitimate timing differences without accepting materially incomplete
    // cash figures. The previous 1.5x threshold allowed a 33% shortfall —
    // understating the FCCR/DSCR denominator and overstating coverage,
    // the most dangerous direction of error for a lender.
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

    if (accrualBest > cashInterest * 1.15) {
      interest = accrualBest;
      interestSource = accrualBestSource;
    }

    // Symmetric check: warn when cash materially exceeds accrual.
    // Common cause: cash_interest_paid includes IFRS 16 lease interest
    // while P&L finance costs exclude it.
    if (cashInterest > accrualBest * 1.15 && accrualBest > 0) {
      console.warn(
        `⚠️ ${yearTag}INTEREST REVIEW: cash_interest_paid (${cashInterest}) exceeds ` +
        `best accrual (${accrualBest} via ${accrualBestSource}) by ` +
        `${((cashInterest / accrualBest - 1) * 100).toFixed(0)}%. ` +
        `Cash may include IFRS 16 lease interest. Retaining cash basis.`
      );
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
  // When the interest source is P&L-based, it includes IFRS 16 "Interest on
  // lease liabilities." If leases are a TOTAL CASH PAYMENT (finance_lease_payments
  // or payment_of_lease_liability), that payment includes both principal AND
  // interest — so lease interest would be counted twice:
  //   1. Inside `interest` (P&L total includes lease interest)
  //   2. Inside `leases` (full payment includes lease interest)
  //
  // Fix: deduct fc.lease_interest from interest ONLY when the lease source is
  // a total cash payment figure.
  //
  // CRITICAL: When leases = lease_liabilities_current (balance sheet current
  // portion), the figure is PRINCIPAL ONLY — it does NOT embed interest.
  // Deducting lease interest in this case causes it to fall out of the
  // denominator entirely, understating fixed charges. This was a confirmed bug
  // that inflated KITs FY2024 FCCR from 1.02x to 1.12x (missing $431K).
  //
  // cash_interest_paid is excluded from this deduction — it is a cash-basis
  // figure representing actual bank interest outflows and typically does not
  // include the IFRS 16 lease interest accrual.
  const PL_BASED_SOURCES: DebtServiceSource[] = [
    'total_interest_expense',
    'ttm_interest_expense',
    'interest_accrual',
  ];

  // Only deduct lease interest when the lease figure is a total cash payment
  // (includes both principal + interest). Balance sheet current portions are
  // principal-only and have no embedded interest to double-count.
  const TOTAL_PAYMENT_LEASE_SOURCES: DebtServiceSource[] = [
    'finance_lease_payments',
    'payment_of_lease_liability',
  ];

  let leaseInterestDeducted: number | null = null;

  if (
    leases > 0 &&
    PL_BASED_SOURCES.includes(interestSource) &&
    TOTAL_PAYMENT_LEASE_SOURCES.includes(leaseSource) &&
    fc.lease_interest != null &&
    fc.lease_interest > 0
  ) {
    leaseInterestDeducted = fc.lease_interest;
    interest = Math.max(0, interest - fc.lease_interest);
  }

  // ── Operating Leases (resolved separately, NOT in total) ────────────
  // Only used when FCCR operatingLeaseConfig.mode === 'include'.
  let operatingLeases = 0;
  let operatingLeaseSource: 'operating_lease_payments' | 'none' = 'none';

  if (fc.operating_lease_payments != null && fc.operating_lease_payments > 0) {
    operatingLeases = fc.operating_lease_payments;
    operatingLeaseSource = 'operating_lease_payments';
  }

  // ── Preferred Dividends (resolved separately, NOT in total) ──────────
  // Preferred dividends are a senior contractual fixed obligation in commercial
  // lending and belong in the FCCR denominator. They are NOT added to `total`
  // here because the DSCR (banker's ratio) excludes them — each calculator adds
  // this value to its own denominator as appropriate.
  //
  // Do NOT confuse with distributions_paid (common equity draws) which is a
  // FCCR numerator deduction. Preferred dividends are a separate senior claim.
  const preferredDividends = fc.preferred_dividends != null && fc.preferred_dividends > 0
    ? fc.preferred_dividends
    : 0;

  return {
    principal,
    interest,
    leases,
    operatingLeases,
    preferredDividends,
    total: principal + interest + leases,
    sources: {
      principal_source: principalSource,
      principal_value: principal || null,
      interest_source: interestSource,
      interest_value: interest || null,
      lease_source: leaseSource,
      lease_value: leases || null,
      lease_interest_deducted: leaseInterestDeducted,
      operating_lease_source: operatingLeaseSource,
      operating_lease_value: operatingLeases || null,
      preferred_dividends_value: preferredDividends || null,
    },
    warnings,
  };
}

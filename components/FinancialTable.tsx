'use client';

import React from 'react';
import { fmtCurrency } from '@/utils/format';
import type { FinancialDataProps } from '@/types/financial';

// Re-export canonical types so that the local alias `YearMetrics` used throughout
// this file continues to resolve without touching every downstream reference.
import type { ComputedMetrics as YearMetrics } from '@/types/financial';

type FinancialTableProps = FinancialDataProps;

// ─────────────────────────────────────────────────────────────────────────────
// Row & Section Configuration
// ─────────────────────────────────────────────────────────────────────────────

type RowFormat =
  | 'currency'
  | 'ratio'
  | 'percent'
  | 'margin'
  | 'rate'
  | 'string';

/**
 * Visual style variant for a row.
 * - 'normal'     : standard line item (default)
 * - 'subtotal'   : double-border above, bold — used for section subtotals
 * - 'total'      : heavy top border, bold + blue tint — used for key totals
 * - 'separator'  : thin visual spacer row, no data
 * - 'addback'    : indented add-back in a bridge (positive = green tint)
 * - 'deduction'  : indented deduction in a bridge (negative = red tint)
 */
type RowVariant =
  | 'normal'
  | 'subtotal'
  | 'total'
  | 'separator'
  | 'addback'
  | 'deduction';

interface RowConfig {
  key: string;
  label: string;
  format?: RowFormat;
  /**
   * Visual variant controlling styling and indentation.
   * Replaces the old `highlight` / `indent` boolean flags.
   */
  variant?: RowVariant;
  /** Path to a nested object on YearMetrics (e.g. 'debt_components') */
  nested?: string;
}

interface SectionConfig {
  title: string;
  rows: RowConfig[];
  collapsible?: boolean;
  /**
   * When true the section header is styled as a major statement heading
   * (e.g. "Income Statement", "EBITDA Bridge") rather than a sub-group.
   */
  major?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cash-Flow-Statement Layout
//
// Reading order mirrors how a credit analyst works through a CIM / CFS:
//   1. Income Statement — revenue quality, margins, net income
//   2. EBITDA Bridge    — net income → EBITDA → Adjusted EBITDA (add-backs)
//   3. CFADS Waterfall  — Adj EBITDA → cash available for debt service
//   4. Debt Service     — fixed charges consumed by debt obligations
//   5. Key Ratios       — the verdict derived from the above
//   6. Capital Structure — leverage and liquidity context
//   7. Detail drilldowns — collapsible debt/depreciation schedules
// ─────────────────────────────────────────────────────────────────────────────
const sections: SectionConfig[] = [
  // ── 1. INCOME STATEMENT ──────────────────────────────────────────────────
  {
    title: 'Income Statement',
    major: true,
    rows: [
      { key: 'revenue', label: 'Revenue', variant: 'normal' },
      {
        key: 'expenses',
        label: 'Total Operating Expenses',
        variant: 'normal',
      },
      { key: 'net_income', label: 'Net Income', variant: 'subtotal' },
      {
        key: 'profit_margins',
        label: 'Net Profit Margin',
        variant: 'normal',
        format: 'margin',
      },
    ],
  },

  // ── 2. EBITDA BRIDGE ─────────────────────────────────────────────────────
  {
    title: 'EBITDA Bridge',
    major: true,
    rows: [
      {
        key: 'net_income',
        label: 'Net Income (starting point)',
        variant: 'normal',
      },
      {
        key: 'interest',
        label: '+ Interest Expense',
        variant: 'addback',
      },
      { key: 'taxes', label: '+ Taxes', variant: 'addback' },
      {
        key: 'depreciation_amortization',
        label: '+ Depreciation & Amortization',
        variant: 'addback',
      },
      { key: 'ebitda', label: '= EBITDA', variant: 'subtotal' },
    ],
  },

  // ── 3. DEPRECIATION BREAKDOWN (collapsible detail) ───────────────────────
  {
    title: 'Depreciation & Amortization Detail',
    collapsible: true,
    rows: [
      {
        key: 'depreciation_equipment',
        label: 'Property & Equipment',
        variant: 'addback',
      },
      {
        key: 'depreciation_rou',
        label: 'ROU Asset (IFRS 16)',
        variant: 'addback',
      },
      {
        key: 'depreciation_other',
        label: 'Other Depreciation',
        variant: 'addback',
      },
      {
        key: 'amortization_intangibles',
        label: 'Amortization of Intangibles',
        variant: 'addback',
      },
      {
        key: 'depreciation_amortization',
        label: '= Total D&A',
        variant: 'subtotal',
      },
    ],
  },

  // ── 4. ADJUSTED EBITDA BRIDGE (collapsible) ──────────────────────────────
  {
    title: 'Adjusted EBITDA Bridge',
    collapsible: true,
    rows: [
      {
        key: 'ebitda',
        label: 'EBITDA (as above)',
        variant: 'normal',
      },
      // Non-cash add-backs
      {
        key: 'stock_based_compensation',
        label: '+ Stock-Based Compensation',
        variant: 'addback',
        nested: 'adjusted_ebitda_components',
      },
      {
        key: 'impairment_charges',
        label: '+ Impairment Charges',
        variant: 'addback',
        nested: 'adjusted_ebitda_components',
      },
      {
        key: 'goodwill_impairment',
        label: '+ Goodwill Impairment',
        variant: 'addback',
        nested: 'adjusted_ebitda_components',
      },
      {
        key: 'unrealized_gains_losses',
        label: '+ Unrealized Gains / Losses',
        variant: 'addback',
        nested: 'adjusted_ebitda_components',
      },
      {
        key: 'deferred_compensation',
        label: '+ Deferred Compensation',
        variant: 'addback',
        nested: 'adjusted_ebitda_components',
      },
      {
        key: 'loss_on_disposal',
        label: '+ Loss on Disposal',
        variant: 'addback',
        nested: 'adjusted_ebitda_components',
      },
      {
        key: 'other_non_cash',
        label: '+ Other Non-Cash Items',
        variant: 'addback',
        nested: 'adjusted_ebitda_components',
      },
      // One-time expense add-backs
      {
        key: 'restructuring_costs',
        label: '+ Restructuring Costs',
        variant: 'addback',
        nested: 'adjusted_ebitda_components',
      },
      {
        key: 'severance_costs',
        label: '+ Severance Costs',
        variant: 'addback',
        nested: 'adjusted_ebitda_components',
      },
      {
        key: 'transaction_costs',
        label: '+ Transaction Costs',
        variant: 'addback',
        nested: 'adjusted_ebitda_components',
      },
      {
        key: 'legal_settlements',
        label: '+ Legal Settlements',
        variant: 'addback',
        nested: 'adjusted_ebitda_components',
      },
      {
        key: 'other_one_time_expenses',
        label: '+ Other One-Time Expenses',
        variant: 'addback',
        nested: 'adjusted_ebitda_components',
      },
      {
        key: 'casualty_losses',
        label: '+ Casualty Losses',
        variant: 'addback',
        nested: 'adjusted_ebitda_components',
      },
      // One-time gain deductions
      {
        key: 'gain_on_disposal',
        label: '− Gain on Disposal',
        variant: 'deduction',
        nested: 'adjusted_ebitda_components',
      },
      {
        key: 'gain_on_asset_sale',
        label: '− Gain on Asset Sale',
        variant: 'deduction',
        nested: 'adjusted_ebitda_components',
      },
      {
        key: 'other_income_non_operating',
        label: '− Other Non-Operating Income',
        variant: 'deduction',
        nested: 'adjusted_ebitda_components',
      },
      {
        key: 'insurance_proceeds',
        label: '− Insurance Proceeds',
        variant: 'deduction',
        nested: 'adjusted_ebitda_components',
      },
      {
        key: 'other_one_time_gains',
        label: '− Other One-Time Gains',
        variant: 'deduction',
        nested: 'adjusted_ebitda_components',
      },
      // Owner/management adjustments
      {
        key: 'owner_compensation_adjustment',
        label: '± Owner Comp. Adj.',
        variant: 'addback',
        nested: 'adjusted_ebitda_components',
      },
      {
        key: 'related_party_adjustments',
        label: '± Related Party Adj.',
        variant: 'addback',
        nested: 'adjusted_ebitda_components',
      },
      {
        key: 'management_fees_adjustment',
        label: '± Management Fees Adj.',
        variant: 'addback',
        nested: 'adjusted_ebitda_components',
      },
      // FX
      {
        key: 'unrealized_fx_cash_flow',
        label: '+ Unrealized FX (CF Stmt)',
        variant: 'addback',
        nested: 'adjusted_ebitda_components',
      },
      {
        key: 'realized_fx_pl',
        label: 'Realized FX P&L (info only)',
        variant: 'normal',
        nested: 'adjusted_ebitda_components',
      },
      // Result
      {
        key: 'adjusted_ebitda',
        label: '= Adjusted EBITDA',
        variant: 'total',
      },
    ],
  },

  // ── 5. CFADS WATERFALL ───────────────────────────────────────────────────
  {
    title: 'Cash Available for Debt Service (CFADS)',
    major: true,
    rows: [
      {
        key: 'adjusted_ebitda',
        label: 'Adjusted EBITDA',
        variant: 'normal',
      },
      {
        key: 'capital_expenditures',
        label: '− Capital Expenditures',
        variant: 'deduction',
      },
      {
        key: 'proceeds_from_long_term_debt',
        label: '+ Proceeds from LT Debt (offsets CapEx)',
        variant: 'addback',
      },
      {
        key: 'cash_taxes_paid',
        label: '− Cash Taxes Paid',
        variant: 'deduction',
      },
      {
        key: 'cash_flow_for_debt_servicing',
        label: '= CFADS (Covenant FCCR Numerator)',
        variant: 'total',
      },
    ],
  },

  // ── 6. DEBT SERVICE (FCCR DENOMINATOR) ──────────────────────────────────
  {
    title: 'Debt Service (Fixed Charges)',
    major: true,
    collapsible: true,
    rows: [
      {
        key: 'ttm_principal_payments',
        label: 'Principal Payments (TTM)',
        variant: 'normal',
      },
      {
        key: 'ttm_interest_expense',
        label: 'Interest Expense (TTM)',
        variant: 'normal',
      },
      {
        key: 'payment_of_lease_liability',
        label: 'Lease Payments',
        variant: 'normal',
      },
      // Fixed charges detail
      {
        key: 'senior_debt_interest',
        label: 'Senior Debt Interest',
        variant: 'normal',
        nested: 'fixed_charges',
      },
      {
        key: 'subordinated_debt_interest',
        label: 'Subordinated Debt Interest',
        variant: 'normal',
        nested: 'fixed_charges',
      },
      {
        key: 'lease_interest',
        label: 'Lease Interest',
        variant: 'normal',
        nested: 'fixed_charges',
      },
      {
        key: 'total_interest_expense',
        label: '= Total Interest Expense',
        variant: 'subtotal',
        nested: 'fixed_charges',
      },
      {
        key: 'senior_debt_interest_rate',
        label: 'Senior Debt Rate',
        variant: 'normal',
        nested: 'fixed_charges',
        format: 'string',
      },
      {
        key: 'finance_lease_payments',
        label: 'Finance Lease Payments',
        variant: 'normal',
        nested: 'fixed_charges',
      },
      {
        key: 'operating_lease_payments',
        label: 'Operating Lease Payments',
        variant: 'normal',
        nested: 'fixed_charges',
      },
      {
        key: 'preferred_dividends',
        label: 'Preferred Dividends',
        variant: 'normal',
        nested: 'fixed_charges',
      },
      {
        key: 'principal_payments',
        label: 'Principal Payments',
        variant: 'normal',
        nested: 'fixed_charges',
      },
      {
        key: 'other_fixed_charges',
        label: 'Other Fixed Charges',
        variant: 'normal',
        nested: 'fixed_charges',
      },
    ],
  },

  // ── 7. KEY RATIOS ─────────────────────────────────────────────────────────
  {
    title: 'Key Credit Ratios',
    major: true,
    rows: [
      {
        key: 'fccr',
        label: 'Covenant FCCR',
        format: 'ratio',
        variant: 'total',
      },
      {
        key: 'dscr',
        label: 'EBITDA Coverage',
        format: 'ratio',
        variant: 'total',
      },
      {
        key: 'senior_debt_to_ebitda',
        label: 'Senior Debt / Adj. EBITDA',
        format: 'ratio',
        variant: 'subtotal',
      },
      {
        key: 'funded_debt_to_ebitda',
        label: 'Funded Debt / EBITDA',
        format: 'ratio',
        variant: 'subtotal',
      },
      {
        key: 'total_debt_to_capital',
        label: 'Total Debt / Capital',
        format: 'percent',
        variant: 'subtotal',
      },
      {
        key: 'interest_coverage_ratio',
        label: 'Interest Coverage',
        format: 'ratio',
        variant: 'normal',
      },
      {
        key: 'current_ratio',
        label: 'Current Ratio',
        format: 'ratio',
        variant: 'normal',
      },
      {
        key: 'debt_to_equity_ratio',
        label: 'Debt / Equity',
        format: 'ratio',
        variant: 'normal',
      },
    ],
  },

  // ── 8. CAPITAL STRUCTURE ─────────────────────────────────────────────────
  {
    title: 'Capital Structure',
    major: true,
    rows: [
      { key: 'total_debt', label: 'Total Debt', variant: 'subtotal' },
      { key: 'senior_debt', label: 'Senior Debt', variant: 'normal' },
      { key: 'funded_debt', label: 'Funded Debt', variant: 'normal' },
      {
        key: 'shareholders_equity',
        label: "Shareholders' Equity",
        variant: 'normal',
      },
      {
        key: 'current_assets',
        label: 'Current Assets',
        variant: 'normal',
      },
      {
        key: 'current_liabilities',
        label: 'Current Liabilities',
        variant: 'normal',
      },
    ],
  },

  // ── 9. ADDITIONAL CASH FLOW ITEMS ────────────────────────────────────────
  {
    title: 'Other Cash Flow Items',
    collapsible: true,
    rows: [
      {
        key: 'cash_interest_paid',
        label: 'Cash Interest Paid',
        variant: 'normal',
      },
      {
        key: 'non_cash_interest_expense',
        label: 'Non-Cash Interest Expense',
        variant: 'normal',
      },
      {
        key: 'repayment_of_debt',
        label: 'Repayment of Debt',
        variant: 'normal',
      },
    ],
  },

  // ── 10. DEBT COMPONENTS — SENIOR ─────────────────────────────────────────
  {
    title: 'Debt Detail — Senior Facilities',
    collapsible: true,
    rows: [
      {
        key: 'bank_debt_current',
        label: 'Bank Debt (Current)',
        variant: 'normal',
        nested: 'debt_components',
      },
      {
        key: 'bank_debt_long_term',
        label: 'Bank Debt (Long-Term)',
        variant: 'normal',
        nested: 'debt_components',
      },
      {
        key: 'term_loans',
        label: 'Term Loans',
        variant: 'normal',
        nested: 'debt_components',
      },
      {
        key: 'revolving_credit_facilities',
        label: 'Revolving Credit Facilities',
        variant: 'normal',
        nested: 'debt_components',
      },
      {
        key: 'overdraft_facilities',
        label: 'Overdraft Facilities',
        variant: 'normal',
        nested: 'debt_components',
      },
      {
        key: 'lines_of_credit',
        label: 'Lines of Credit',
        variant: 'normal',
        nested: 'debt_components',
      },
    ],
  },

  // ── 11. DEBT COMPONENTS — LEASES ─────────────────────────────────────────
  {
    title: 'Debt Detail — Lease Liabilities',
    collapsible: true,
    rows: [
      {
        key: 'lease_liabilities_current',
        label: 'Lease Liabilities (Current)',
        variant: 'normal',
        nested: 'debt_components',
      },
      {
        key: 'lease_liabilities_long_term',
        label: 'Lease Liabilities (Long-Term)',
        variant: 'normal',
        nested: 'debt_components',
      },
      {
        key: 'finance_lease_liabilities',
        label: 'Finance Lease Liabilities',
        variant: 'normal',
        nested: 'debt_components',
      },
      {
        key: 'operating_lease_liabilities',
        label: 'Operating Lease Liabilities',
        variant: 'normal',
        nested: 'debt_components',
      },
    ],
  },

  // ── 12. DEBT COMPONENTS — SUBORDINATED ───────────────────────────────────
  {
    title: 'Debt Detail — Subordinated & Other',
    collapsible: true,
    rows: [
      {
        key: 'notes_payable',
        label: 'Notes Payable',
        variant: 'normal',
        nested: 'debt_components',
      },
      {
        key: 'subordinated_debt',
        label: 'Subordinated Debt',
        variant: 'normal',
        nested: 'debt_components',
      },
      {
        key: 'convertible_debt',
        label: 'Convertible Debt',
        variant: 'normal',
        nested: 'debt_components',
      },
      {
        key: 'bonds_debentures',
        label: 'Bonds / Debentures',
        variant: 'normal',
        nested: 'debt_components',
      },
      {
        key: 'other_borrowings',
        label: 'Other Borrowings',
        variant: 'normal',
        nested: 'debt_components',
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Ratio Formula Components
//
// For each key ratio, define the numerator/denominator rows displayed inline
// under the ratio in the Key Credit Ratios section.
// ─────────────────────────────────────────────────────────────────────────────

interface FormulaRow {
  label: string;
  getValue: (metrics: YearMetrics) => number | null;
  format: RowFormat;
}

const ratioFormulas: Record<string, FormulaRow[]> = {
  fccr: [
    {
      label: '↳ CFADS (numerator)',
      getValue: (m) => m.fccr_breakdown?.numerator ?? null,
      format: 'currency',
    },
    {
      label: '↳ Fixed Charges (denominator)',
      getValue: (m) => m.fccr_breakdown?.denominator ?? null,
      format: 'currency',
    },
  ],
  senior_debt_to_ebitda: [
    {
      label: '↳ Senior Debt',
      getValue: (m) => m.senior_debt,
      format: 'currency',
    },
    {
      label: '↳ Adjusted EBITDA',
      getValue: (m) => m.adjusted_ebitda ?? m.ebitda,
      format: 'currency',
    },
  ],
  total_debt_to_capital: [
    {
      label: '↳ Total Debt',
      getValue: (m) => m.total_debt,
      format: 'currency',
    },
    {
      label: '↳ Total Capital (Debt + Equity)',
      getValue: (m) => {
        if (m.total_debt == null || m.shareholders_equity == null)
          return null;
        return m.total_debt + m.shareholders_equity;
      },
      format: 'currency',
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

const getMetricValue = (
  metrics: YearMetrics,
  key: string,
  nested?: string,
): number | null => {
  if (nested) {
    const nestedObj = metrics[nested as keyof YearMetrics];
    if (!nestedObj || typeof nestedObj !== 'object') return null;
    const value = (nestedObj as unknown as Record<string, unknown>)[
      key
    ];
    if (value === null || value === undefined) return null;
    return typeof value === 'number' ? value : null;
  }

  const value = metrics[key as keyof YearMetrics];
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return parseFloat(value) || null;
  return typeof value === 'number' ? value : null;
};

const formatValue = (
  value: number | null,
  format: RowFormat = 'currency',
): string => {
  if (value === null || value === undefined) return '—';

  switch (format) {
    case 'ratio':
      return `${value.toFixed(2)}x`;
    case 'percent':
      return `${(value * 100).toFixed(1)}%`;
    case 'margin':
      if (value <= 1 && value >= -1)
        return `${(value * 100).toFixed(1)}%`;
      return `${value.toFixed(1)}%`;
    case 'rate':
      return `${(value * 100).toFixed(2)}%`;
    case 'currency':
    default:
      return fmtCurrency(value);
  }
};

/** Format number for equation display (no $ sign, comma-separated) */
const fmtEq = (n: number): string => Math.round(n).toLocaleString();

/** Build equation terms string: "80,831 + 1,005 − 451" (skips zero-value terms) */
const eqLine = (
  start: number,
  terms: Array<{ v: number; op: string }>,
): string => {
  let eq = fmtEq(start);
  for (const t of terms) {
    if (t.v === 0) continue;
    eq += ` ${t.op} ${fmtEq(Math.abs(t.v))}`;
  }
  return eq;
};

/**
 * Returns a Tailwind color class for ratio cells based on the health of the value.
 * Uses semantic design tokens from ui-ux-3 (text-success, text-warning, text-error).
 */
const getRatioColor = (key: string, value: number | null): string => {
  if (value === null) return '';

  switch (key) {
    case 'fccr':
    case 'dscr':
      if (value >= 2.0) return 'text-success font-semibold';
      if (value >= 1.5) return 'text-success/70 font-semibold';
      if (value >= 1.2) return 'text-warning font-semibold';
      if (value >= 1.0) return 'text-warning/80 font-semibold';
      return 'text-error font-semibold';
    case 'senior_debt_to_ebitda':
    case 'funded_debt_to_ebitda':
      if (value <= 1.5) return 'text-success font-semibold';
      if (value <= 2.5) return 'text-success/70 font-semibold';
      if (value <= 3.0) return 'text-warning font-semibold';
      if (value <= 4.0) return 'text-warning/80 font-semibold';
      return 'text-error font-semibold';
    case 'total_debt_to_capital':
      if (value < 0.3) return 'text-success font-semibold';
      if (value <= 0.5) return 'text-success/70 font-semibold';
      if (value <= 0.6) return 'text-warning font-semibold';
      if (value <= 0.7) return 'text-warning/80 font-semibold';
      return 'text-error font-semibold';
    case 'interest_coverage_ratio':
      if (value >= 5.0) return 'text-success font-semibold';
      if (value >= 3.0) return 'text-success/70 font-semibold';
      if (value >= 2.0) return 'text-warning font-semibold';
      if (value >= 1.5) return 'text-warning/80 font-semibold';
      return 'text-error font-semibold';
    case 'current_ratio':
      if (value >= 2.0) return 'text-success font-semibold';
      if (value >= 1.5) return 'text-success/70 font-semibold';
      if (value >= 1.2) return 'text-warning font-semibold';
      if (value >= 1.0) return 'text-warning/80 font-semibold';
      return 'text-error font-semibold';
    default:
      return '';
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Row Styling by Variant
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps a RowVariant to Tailwind classes for the <tr> element.
 *
 * @param variant  - visual variant controlling border and background
 * @param isEven   - pass true for even-indexed data rows to apply zebra striping.
 *                   Ignored for 'total' and 'subtotal' variants which always
 *                   carry their own explicit background.
 */
const getRowClasses = (variant: RowVariant, isEven?: boolean): string => {
  switch (variant) {
    case 'total':
      // Always blue-tinted regardless of row parity
      return 'border-t-2 border-border bg-primary/5 dark:bg-primary/10 hover:bg-primary/10 dark:hover:bg-primary/15';
    case 'subtotal':
      // Always muted regardless of row parity
      return 'border-t border-border bg-muted/80 dark:bg-muted/60 hover:bg-muted dark:hover:bg-muted/80';
    case 'addback':
      return isEven
        ? 'border-b border-border bg-gray-50 dark:bg-zinc-800/50 hover:bg-muted/30 dark:hover:bg-zinc-700/40'
        : 'border-b border-border bg-white dark:bg-zinc-900 hover:bg-muted/30 dark:hover:bg-zinc-700/40';
    case 'deduction':
      return isEven
        ? 'border-b border-border bg-gray-50 dark:bg-zinc-800/50 hover:bg-muted/20 dark:hover:bg-zinc-700/30'
        : 'border-b border-border bg-white dark:bg-zinc-900 hover:bg-muted/20 dark:hover:bg-zinc-700/30';
    case 'separator':
      return 'h-1 bg-transparent';
    case 'normal':
    default:
      return isEven
        ? 'border-b border-border bg-gray-50 dark:bg-zinc-800/50 hover:bg-muted/50 dark:hover:bg-zinc-700/50'
        : 'border-b border-border bg-white dark:bg-zinc-900 hover:bg-muted/50 dark:hover:bg-zinc-700/50';
  }
};

/**
 * Maps a RowVariant to Tailwind classes for the label <td>.
 * `whitespace-nowrap` prevents metric names from wrapping awkwardly on
 * narrower viewports — the outer `overflow-x-auto` container handles scroll.
 */
const getLabelClasses = (variant: RowVariant): string => {
  const base = 'whitespace-nowrap';
  switch (variant) {
    case 'total':
      return `${base} py-2.5 px-4 font-bold text-foreground pl-4`;
    case 'subtotal':
      return `${base} py-2 px-4 font-semibold text-foreground pl-4`;
    case 'addback':
      return `${base} py-1.5 px-4 text-muted-foreground pl-10 text-sm`;
    case 'deduction':
      return `${base} py-1.5 px-4 text-muted-foreground pl-10 text-sm`;
    case 'normal':
    default:
      return `${base} py-2 px-4 text-foreground pl-4`;
  }
};

/**
 * Maps a RowVariant to Tailwind classes for value <td> cells.
 * `tabular-nums` ensures digits align vertically across rows.
 * `min-w-[120px]` prevents year columns from becoming too narrow to read.
 */
const getValueClasses = (
  variant: RowVariant,
  colorClass?: string,
): string => {
  const base = 'py-2 px-4 text-right tabular-nums min-w-[120px]';
  switch (variant) {
    case 'total':
      return `${base} font-bold text-foreground ${colorClass ?? ''}`.trim();
    case 'subtotal':
      return `${base} font-semibold text-foreground ${colorClass ?? ''}`.trim();
    case 'addback':
      return `${base} text-sm text-muted-foreground ${colorClass ?? ''}`.trim();
    case 'deduction':
      return `${base} text-sm text-muted-foreground ${colorClass ?? ''}`.trim();
    case 'normal':
    default:
      return `${base} text-foreground ${colorClass ?? ''}`.trim();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const FinancialTable: React.FC<FinancialTableProps> = ({ data }) => {
  // Sections collapsed by default — detail drilldowns kept out of the way
  const [collapsedSections, setCollapsedSections] = React.useState<
    Set<string>
  >(
    new Set([
      'Depreciation & Amortization Detail',
      'Adjusted EBITDA Bridge',
      'Debt Service (Fixed Charges)',
      'Other Cash Flow Items',
      'Debt Detail — Senior Facilities',
      'Debt Detail — Lease Liabilities',
      'Debt Detail — Subordinated & Other',
    ]),
  );

  if (
    !data ||
    !data.metrics_by_year ||
    Object.keys(data.metrics_by_year).length === 0
  ) {
    return (
      <p className="text-muted-foreground">
        No financial data available.
      </p>
    );
  }

  const years = Object.keys(data.metrics_by_year).sort().reverse();

  // Mutable parity counter shared across all row renderers within a single
  // render pass. Passed into renderRow so zebra striping spans section boundaries.
  const rowParity = { count: 0 };

  const toggleSection = (title: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  // ── Data presence checks ─────────────────────────────────────────────────

  const sectionHasData = (section: SectionConfig): boolean =>
    section.rows.some((row) =>
      years.some((y) => {
        if (row.format === 'string') {
          const metrics = data.metrics_by_year[y];
          const nestedObj = row.nested
            ? metrics[row.nested as keyof typeof metrics]
            : null;
          const rawVal =
            nestedObj && typeof nestedObj === 'object'
              ? (nestedObj as unknown as Record<string, unknown>)[
                  row.key
                ]
              : metrics[row.key as keyof typeof metrics];
          return typeof rawVal === 'string';
        }
        return (
          getMetricValue(
            data.metrics_by_year[y],
            row.key,
            row.nested,
          ) !== null
        );
      }),
    );

  const rowHasData = (row: RowConfig): boolean =>
    years.some(
      (y) =>
        getMetricValue(
          data.metrics_by_year[y],
          row.key,
          row.nested,
        ) !== null,
    );

  // ── FCCR breakdown helpers ───────────────────────────────────────────────

  const getFccrBreakdownValue = (
    year: string,
    key: string,
  ): number | null => {
    const breakdown = data.metrics_by_year[year]?.fccr_breakdown;
    if (!breakdown) return null;
    const value = (breakdown as unknown as Record<string, number>)[
      key
    ];
    return typeof value === 'number' ? value : null;
  };

  const hasFccrBreakdown = years.some(
    (y) => data.metrics_by_year[y]?.fccr_breakdown != null,
  );

  // ── Section header renderer ──────────────────────────────────────────────

  const renderSectionHeader = (section: SectionConfig) => {
    const isCollapsed =
      section.collapsible && collapsedSections.has(section.title);

    if (section.major) {
      return (
        <tr
          className={`${section.collapsible ? 'cursor-pointer hover:bg-primary/80' : ''}`}
          onClick={() =>
            section.collapsible && toggleSection(section.title)
          }
        >
          <td
            colSpan={years.length + 1}
            className="py-3 px-4 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest border-t-2 border-primary"
          >
            <div className="flex items-center gap-2">
              {section.collapsible && (
                <span className="text-primary-foreground/60 text-[11px]">
                  {isCollapsed ? '▶' : '▼'}
                </span>
              )}
              {section.title}
            </div>
          </td>
        </tr>
      );
    }

    return (
      <tr
        className={`bg-muted ${section.collapsible ? 'cursor-pointer hover:bg-muted/80' : ''}`}
        onClick={() =>
          section.collapsible && toggleSection(section.title)
        }
      >
        <td
          colSpan={years.length + 1}
          className="py-2 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wide border-t border-border"
        >
          <div className="flex items-center gap-2">
            {section.collapsible && (
              <span className="text-muted-foreground/60 text-[11px]">
                {isCollapsed ? '▶' : '▼'}
              </span>
            )}
            {section.title}
          </div>
        </td>
      </tr>
    );
  };

  // ── Row renderer ─────────────────────────────────────────────────────────

  /**
   * Renders a single data row. `parity` is a shared counter object mutated
   * in-place each time a visible row is emitted, enabling cross-section
   * zebra striping without lifting state.
   */
  const renderRow = (
    row: RowConfig,
    sectionTitle: string,
    parity: { count: number },
  ) => {
    const variant: RowVariant = row.variant ?? 'normal';

    if (variant === 'separator') {
      return (
        <tr
          key={`${sectionTitle}-sep-${row.key}`}
          className="h-2 bg-transparent"
        >
          <td colSpan={years.length + 1} />
        </tr>
      );
    }

    // String-format rows (e.g. interest rate)
    if (row.format === 'string') {
      const hasStrVal = years.some((y) => {
        const metrics = data.metrics_by_year[y];
        const nestedObj = row.nested
          ? metrics[row.nested as keyof typeof metrics]
          : null;
        const rawVal =
          nestedObj && typeof nestedObj === 'object'
            ? (nestedObj as unknown as Record<string, unknown>)[
                row.key
              ]
            : metrics[row.key as keyof typeof metrics];
        return typeof rawVal === 'string';
      });
      if (!hasStrVal) return null;

      const isEven = parity.count++ % 2 === 0;
      return (
        <tr
          key={`${sectionTitle}-${row.key}`}
          className={getRowClasses(variant, isEven)}
        >
          <td className={getLabelClasses(variant)}>{row.label}</td>
          {years.map((y) => {
            const metrics = data.metrics_by_year[y];
            const nestedObj = row.nested
              ? metrics[row.nested as keyof typeof metrics]
              : null;
            const rawVal =
              nestedObj && typeof nestedObj === 'object'
                ? (nestedObj as unknown as Record<string, unknown>)[
                    row.key
                  ]
                : metrics[row.key as keyof typeof metrics];
            return (
              <td key={y} className={getValueClasses(variant)}>
                {typeof rawVal === 'string' ? rawVal : '—'}
              </td>
            );
          })}
        </tr>
      );
    }

    // Numeric rows
    if (!rowHasData(row)) return null;

    const isRatioRow =
      row.format === 'ratio' || row.format === 'percent';

    // Show source badge on EBITDA & Adjusted EBITDA total rows
    const showBadge =
      (row.key === 'ebitda' &&
        row.variant === 'subtotal' &&
        sectionTitle === 'EBITDA Bridge') ||
      (row.key === 'adjusted_ebitda' &&
        row.variant === 'total' &&
        sectionTitle === 'Adjusted EBITDA Bridge');

    const isEven = parity.count++ % 2 === 0;
    return (
      <tr
        key={`${sectionTitle}-${row.key}`}
        className={getRowClasses(variant, isEven)}
      >
        <td className={getLabelClasses(variant)}>{row.label}</td>
        {years.map((y) => {
          const val = getMetricValue(
            data.metrics_by_year[y],
            row.key,
            row.nested,
          );
          const colorClass = isRatioRow
            ? getRatioColor(row.key, val)
            : '';

          // EBITDA source badge — "Reported" (green) vs "Calc" (amber)
          let badge: React.ReactNode = null;
          if (showBadge && val !== null) {
            const metrics = data.metrics_by_year[y];
            const isCalc =
              row.key === 'ebitda'
                ? metrics.ebitda_calculated === true
                : metrics.reported_adjusted_ebitda == null;
            badge = (
              <span
                className={`ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${
                  isCalc
                    ? 'bg-warning/15 text-warning border border-warning/25'
                    : 'bg-success/12 text-success border border-success/20'
                }`}
              >
                {isCalc ? 'Calc' : 'Reported'}
              </span>
            );
          }

          return (
            <td
              key={y}
              className={getValueClasses(variant, colorClass)}
            >
              {badge ? (
                <div className="flex items-center justify-end gap-1">
                  <span>{formatValue(val, row.format)}</span>
                  {badge}
                </div>
              ) : (
                formatValue(val, row.format)
              )}
            </td>
          );
        })}
      </tr>
    );
  };

  // ── CFADS detail (from fccr_breakdown) ─────────────────────────────────
  // This is shown inline within the CFADS section only when the breakdown
  // data exists, giving a transparent build-up from Adj EBITDA to CFADS.

  const renderCfadsDetail = (parity: { count: number }) => {
    if (!hasFccrBreakdown) return null;

    const rows: Array<{
      key: string;
      label: string;
      variant: RowVariant;
    }> = [
      {
        key: 'adjusted_ebitda',
        label: 'Adjusted EBITDA',
        variant: 'normal',
      },
      {
        key: 'unfunded_capex',
        label: '− Unfunded CapEx',
        variant: 'deduction',
      },
      {
        key: 'cash_taxes_paid',
        label: '− Cash Taxes Paid',
        variant: 'deduction',
      },
      {
        key: 'numerator',
        label: '= CFADS (= Covenant FCCR Numerator)',
        variant: 'total',
      },
    ];

    return rows
      .filter((r) =>
        years.some((y) => getFccrBreakdownValue(y, r.key) !== null),
      )
      .map((r) => {
        const isEven = parity.count++ % 2 === 0;
        return (
          <tr
            key={`cfads-detail-${r.key}`}
            className={getRowClasses(r.variant, isEven)}
          >
            <td className={getLabelClasses(r.variant)}>{r.label}</td>
            {years.map((y) => (
              <td key={y} className={getValueClasses(r.variant)}>
                {formatValue(
                  getFccrBreakdownValue(y, r.key),
                  'currency',
                )}
              </td>
            ))}
          </tr>
        );
      });
  };

  // ── FCCR denominator detail ─────────────────────────────────────────────

  const renderFccrDenominatorDetail = (parity: { count: number }) => {
    if (!hasFccrBreakdown) return null;

    const rows: Array<{
      key: string;
      label: string;
      variant: RowVariant;
    }> = [
      {
        key: 'ttm_principal_payments',
        label: 'Principal Payments (TTM)',
        variant: 'normal',
      },
      {
        key: 'ttm_interest_expense',
        label: 'Interest Expense (TTM)',
        variant: 'normal',
      },
      {
        key: 'lease_payments',
        label: 'Lease Payments',
        variant: 'normal',
      },
      {
        key: 'denominator',
        label: '= Total Fixed Charges',
        variant: 'subtotal',
      },
    ];

    return rows
      .filter((r) =>
        years.some((y) => {
          const v = getFccrBreakdownValue(y, r.key);
          return v !== null && v !== 0;
        }),
      )
      .map((r) => {
        const isEven = parity.count++ % 2 === 0;
        return (
          <tr
            key={`fccr-denom-${r.key}`}
            className={getRowClasses(r.variant, isEven)}
          >
            <td className={getLabelClasses(r.variant)}>{r.label}</td>
            {years.map((y) => (
              <td key={y} className={getValueClasses(r.variant)}>
                {formatValue(
                  getFccrBreakdownValue(y, r.key),
                  'currency',
                )}
              </td>
            ))}
          </tr>
        );
      });
  };

  // ── Ratio formula component rows ─────────────────────────────────────────

  const renderFormulaRows = (
    ratioKey: string,
    parity: { count: number },
  ) => {
    const formulas = ratioFormulas[ratioKey];
    if (!formulas) return null;

    return formulas
      .filter((f) =>
        years.some(
          (y) => f.getValue(data.metrics_by_year[y]) !== null,
        ),
      )
      .map((f, i) => {
        const isEven = parity.count++ % 2 === 0;
        return (
          <tr
            key={`formula-${ratioKey}-${i}`}
            className={getRowClasses('addback', isEven)}
          >
            <td className={getLabelClasses('addback')}>{f.label}</td>
            {years.map((y) => (
              <td key={y} className={getValueClasses('addback')}>
                {formatValue(
                  f.getValue(data.metrics_by_year[y]),
                  f.format,
                )}
              </td>
            ))}
          </tr>
        );
      });
  };

  // ── Equation verification cards ────────────────────────────────────────

  const renderEquationCards = () => {
    return (
      <div className="mt-8 space-y-6">
        {years.map((year) => {
          const m = data.metrics_by_year[year];
          const fb = m.fccr_breakdown;
          const ab = m.adjusted_ebitda_breakdown;

          const hasEbitda = ab != null && m.adjusted_ebitda != null;
          const hasFccr = fb != null && m.fccr != null;
          const hasSenior =
            m.senior_debt != null && m.senior_debt_to_ebitda != null;
          const hasDebtCap =
            m.total_debt != null && m.total_debt_to_capital != null;

          if (!hasEbitda && !hasFccr && !hasSenior && !hasDebtCap)
            return null;

          return (
            <div key={year} className="space-y-3">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                {year} — Formula Breakdown
              </h3>
              <div className="grid gap-3 lg:grid-cols-2">
                {/* Adjusted EBITDA breakdown */}
                {hasEbitda && ab && (
                  <div className="bg-muted border border-border rounded-lg px-5 py-4 font-mono text-sm leading-relaxed space-y-1">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 font-sans">
                      Adjusted EBITDA
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Reported EBITDA
                      </span>
                      <span className="text-muted-foreground/60">
                        {' '}
                        ={' '}
                      </span>
                      <span className="font-semibold text-foreground">
                        {fmtEq(ab.reported_ebitda)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Adj. EBITDA
                      </span>
                      <span className="text-muted-foreground/60">
                        {' '}
                        ={' '}
                      </span>
                      <span className="text-foreground">
                        {eqLine(ab.reported_ebitda, [
                          { v: ab.non_cash_adjustments, op: '+' },
                          { v: ab.one_time_expenses, op: '+' },
                          { v: ab.one_time_gains, op: '−' },
                          { v: ab.interest_income_excluded, op: '−' },
                          {
                            v: ab.owner_management_adjustments,
                            op: '+',
                          },
                          { v: ab.accounting_adjustments, op: '+' },
                          { v: ab.pro_forma_adjustments, op: '+' },
                        ])}
                      </span>
                    </div>
                    <div className="border-t border-border pt-2 mt-1">
                      <span className="text-muted-foreground">
                        Adjusted EBITDA
                      </span>
                      <span className="text-muted-foreground/60">
                        {' '}
                        ={' '}
                      </span>
                      <span className="font-bold text-success">
                        {fmtEq(
                          m.calculated_adjusted_ebitda ??
                            m.adjusted_ebitda ??
                            ab.reported_ebitda,
                        )}
                      </span>
                      {ab.uses_reported_value &&
                        m.adjusted_ebitda != null && (
                          <span className="text-muted-foreground/60 text-xs ml-2">
                            (using reported:{' '}
                            {fmtEq(m.adjusted_ebitda)})
                          </span>
                        )}
                    </div>
                  </div>
                )}

                {/* FCCR equation */}
                {hasFccr && fb && (
                  <div className="bg-muted border border-border rounded-lg px-5 py-4 font-mono text-sm leading-relaxed space-y-1">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 font-sans">
                      Covenant FCCR
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Numerator
                      </span>
                      <span className="text-muted-foreground/60">
                        {' '}
                        ={' '}
                      </span>
                      <span className="text-foreground">
                        {eqLine(fb.adjusted_ebitda, [
                          { v: fb.capex_deduction, op: '−' },
                          { v: fb.cash_taxes_paid, op: '−' },
                        ])}
                      </span>
                      <span className="text-muted-foreground/60">
                        {' '}
                        ={' '}
                      </span>
                      <span className="font-bold text-warning">
                        {fmtEq(fb.numerator)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Denominator
                      </span>
                      <span className="text-muted-foreground/60">
                        {' '}
                        ={' '}
                      </span>
                      <span className="text-foreground">
                        {[
                          fb.ttm_principal_payments,
                          fb.ttm_interest_expense,
                          fb.lease_payments,
                        ]
                          .filter((v) => v !== 0)
                          .map((v) => fmtEq(v))
                          .join(' + ')}
                      </span>
                      <span className="text-muted-foreground/60">
                        {' '}
                        ={' '}
                      </span>
                      <span className="font-bold text-primary">
                        {fmtEq(fb.denominator)}
                      </span>
                    </div>
                    <div className="border-t border-border pt-2 mt-1">
                      <span className="text-muted-foreground">
                        Covenant FCCR
                      </span>
                      <span className="text-muted-foreground/60">
                        {' '}
                        ={' '}
                      </span>
                      <span className="text-foreground">
                        {fmtEq(fb.numerator)} /{' '}
                        {fmtEq(fb.denominator)}
                      </span>
                      <span className="text-muted-foreground/60">
                        {' '}
                        ={' '}
                      </span>
                      <span className={getRatioColor('fccr', m.fccr)}>
                        {m.fccr!.toFixed(2)}x
                      </span>
                    </div>
                  </div>
                )}

                {/* Senior Debt / Adj. EBITDA */}
                {hasSenior && (
                  <div className="bg-muted border border-border rounded-lg px-5 py-4 font-mono text-sm leading-relaxed space-y-1">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 font-sans">
                      Senior Debt / Adj. EBITDA
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Senior Debt / Adj. EBITDA
                      </span>
                      <span className="text-muted-foreground/60">
                        {' '}
                        ={' '}
                      </span>
                      <span className="text-foreground">
                        {fmtEq(m.senior_debt!)} /{' '}
                        {fmtEq(m.adjusted_ebitda ?? m.ebitda ?? 0)}
                      </span>
                      <span className="text-muted-foreground/60">
                        {' '}
                        ={' '}
                      </span>
                      <span
                        className={getRatioColor(
                          'senior_debt_to_ebitda',
                          m.senior_debt_to_ebitda,
                        )}
                      >
                        {m.senior_debt_to_ebitda!.toFixed(2)}x
                      </span>
                    </div>
                  </div>
                )}

                {/* Total Debt / Total Capital */}
                {hasDebtCap && (
                  <div className="bg-muted border border-border rounded-lg px-5 py-4 font-mono text-sm leading-relaxed space-y-1">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 font-sans">
                      Total Debt / Total Capital
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Total Debt / Total Capital
                      </span>
                      <span className="text-muted-foreground/60">
                        {' '}
                        ={' '}
                      </span>
                      <span className="text-foreground">
                        {fmtEq(m.total_debt!)} /{' '}
                        {fmtEq(
                          m.total_debt! +
                            (m.shareholders_equity ?? 0),
                        )}
                      </span>
                      <span className="text-muted-foreground/60">
                        {' '}
                        ={' '}
                      </span>
                      <span
                        className={getRatioColor(
                          'total_debt_to_capital',
                          m.total_debt_to_capital,
                        )}
                      >
                        {(m.total_debt_to_capital! * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── Main render ──────────────────────────────────────────────────────────

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Financial Summary
        </h2>
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
          Values in thousands
        </span>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        {/*
         * `table-financial` activates the zebra/hover rules in globals.css
         * (kept as a fallback). Row-level parity classes take precedence via
         * Tailwind utility specificity, giving us cross-section striping that
         * respects variant overrides (subtotal, total).
         */}
        <table className="table-financial w-full text-sm tabular-nums border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-primary border-b-2 border-primary">
              {/* Label column — wide enough for longest metric name */}
              <th className="py-3 px-4 text-left text-xs font-bold uppercase tracking-wider text-primary-foreground w-56 whitespace-nowrap bg-primary">
                Line Item
              </th>
              {years.map((y) => (
                <th
                  key={y}
                  className="py-3 px-4 text-right text-xs font-bold uppercase tracking-wider text-primary-foreground tabular-nums min-w-[140px] bg-primary"
                >
                  {y}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {sections.map((section) => {
              if (!sectionHasData(section)) return null;

              const isCollapsed =
                section.collapsible &&
                collapsedSections.has(section.title);

              return (
                <React.Fragment key={section.title}>
                  {renderSectionHeader(section)}

                  {!isCollapsed && (
                    <>
                      {section.rows.map((row) => (
                        <React.Fragment
                          key={`${section.title}-${row.key}-wrap`}
                        >
                          {renderRow(row, section.title, rowParity)}
                          {renderFormulaRows(row.key, rowParity)}
                        </React.Fragment>
                      ))}

                      {/* Inject CFADS detail rows under "Cash Available for Debt Service" */}
                      {section.title ===
                        'Cash Available for Debt Service (CFADS)' &&
                        renderCfadsDetail(rowParity)}

                      {/* Inject FCCR denominator breakdown under "Debt Service" */}
                      {section.title ===
                        'Debt Service (Fixed Charges)' &&
                        renderFccrDenominatorDetail(rowParity)}
                    </>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Formula verification cards below the table */}
      {renderEquationCards()}
    </div>
  );
};

export default FinancialTable;

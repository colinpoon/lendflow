/**
 * Test script: Run extraction on PetValu PDF 3 times and compare results
 * Usage: npx tsx scripts/test-extraction-petvalu.ts
 */
import { config } from 'dotenv';
config();

async function main() {
  const { extractFinancialData } = await import('../utils/aiProcessor');
  const path = await import('path');
  const fs = await import('fs');

  const PDF_PATH = path.resolve(__dirname, '../public/financialReports/PetValu_Q4_2024_FinancialStatements.pdf');

  interface RunSummary {
    run: number;
    fy2024: Record<string, unknown> | null;
    fy2023: Record<string, unknown> | null;
    warnings: string[];
    duration_ms: number;
  }

  async function runExtraction(runNumber: number): Promise<RunSummary> {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`  RUN ${runNumber} STARTING`);
    console.log(`${'='.repeat(80)}\n`);

    const start = Date.now();
    const result = await extractFinancialData(PDF_PATH);
    const duration = Date.now() - start;

    const fy2024 = result.metrics_by_year?.['2024'] ?? null;
    const fy2023 = result.metrics_by_year?.['2023'] ?? null;

    const extractFields = (data: Record<string, unknown> | null) => {
      if (!data) return null;
      const d = data as Record<string, unknown>;
      return {
        ebitda: d.ebitda ?? null,
        adjusted_ebitda: d.adjusted_ebitda ?? null,
        calculated_adjusted_ebitda: d.calculated_adjusted_ebitda ?? null,
        reported_adjusted_ebitda: d.reported_adjusted_ebitda ?? null,
        fccr: d.fccr ?? null,
        fccr_numerator: d.fccr_numerator ?? null,
        total_fixed_charges: d.total_fixed_charges ?? null,
        dscr: d.dscr ?? null,
        senior_debt_to_ebitda: d.senior_debt_to_ebitda ?? null,
        total_debt_to_capital: d.total_debt_to_capital ?? null,
        net_income: d.net_income ?? null,
        revenue: d.revenue ?? null,
        interest: d.interest ?? null,
        taxes: d.taxes ?? null,
        depreciation_amortization: d.depreciation_amortization ?? null,
        depreciation_equipment: d.depreciation_equipment ?? null,
        depreciation_rou: d.depreciation_rou ?? null,
        depreciation_other: d.depreciation_other ?? null,
        amortization_intangibles: d.amortization_intangibles ?? null,
        capital_expenditures: d.capital_expenditures ?? null,
        cash_taxes_paid: d.cash_taxes_paid ?? null,
        distributions_paid: d.distributions_paid ?? null,
        cash_interest_paid: d.cash_interest_paid ?? null,
        repayment_of_debt: d.repayment_of_debt ?? null,
        payment_of_lease_liability: d.payment_of_lease_liability ?? null,
        total_debt: d.total_debt ?? null,
        senior_debt: d.senior_debt ?? null,
        interest_income: d.interest_income ?? null,
        non_cash_interest_expense: d.non_cash_interest_expense ?? null,
        ttm_interest_expense: d.ttm_interest_expense ?? null,
        ttm_principal_payments: d.ttm_principal_payments ?? null,
        proceeds_from_long_term_debt: d.proceeds_from_long_term_debt ?? null,
        fccr_breakdown: d.fccr_breakdown ?? null,
        adjusted_ebitda_breakdown: d.adjusted_ebitda_breakdown ?? null,
        debt_breakdown: d.debt_breakdown ?? null,
        dscr_breakdown: d.dscr_breakdown ?? null,
        debt_components: d.debt_components ?? null,
        fixed_charges: d.fixed_charges ?? null,
        adjusted_ebitda_components: d.adjusted_ebitda_components ?? null,
      };
    };

    return {
      run: runNumber,
      fy2024: extractFields(fy2024 as unknown as Record<string, unknown>),
      fy2023: extractFields(fy2023 as unknown as Record<string, unknown>),
      warnings: result.extraction_warnings ?? [],
      duration_ms: duration,
    };
  }

  function printComparison(runs: RunSummary[]) {
    console.log(`\n${'='.repeat(100)}`);
    console.log(`  COMPARISON ACROSS ${runs.length} RUNS — FY2024 PetValu`);
    console.log(`${'='.repeat(100)}\n`);

    const metrics = [
      'ebitda', 'adjusted_ebitda', 'calculated_adjusted_ebitda', 'reported_adjusted_ebitda',
      'fccr', 'fccr_numerator', 'total_fixed_charges',
      'dscr', 'senior_debt_to_ebitda', 'total_debt_to_capital',
      'net_income', 'revenue', 'interest', 'taxes',
      'depreciation_amortization', 'depreciation_equipment', 'depreciation_rou',
      'depreciation_other', 'amortization_intangibles',
      'capital_expenditures', 'cash_taxes_paid', 'distributions_paid',
      'cash_interest_paid', 'repayment_of_debt', 'payment_of_lease_liability',
      'total_debt', 'senior_debt', 'interest_income',
      'non_cash_interest_expense', 'ttm_interest_expense', 'ttm_principal_payments',
      'proceeds_from_long_term_debt',
    ];

    // Header
    const header = ['Metric'.padEnd(35), ...runs.map((r) => `Run ${r.run}`.padStart(15))].join(' | ');
    console.log(header);
    console.log('-'.repeat(header.length));

    for (const metric of metrics) {
      const values = runs.map((r) => {
        const val = (r.fy2024 as Record<string, unknown> | null)?.[metric];
        if (val == null) return 'null'.padStart(15);
        if (typeof val === 'number') return val.toLocaleString('en-US', { maximumFractionDigits: 2 }).padStart(15);
        return String(val).padStart(15);
      });

      const numValues = runs
        .map((r) => (r.fy2024 as Record<string, unknown> | null)?.[metric])
        .filter((v): v is number => typeof v === 'number');

      const allSame = numValues.length > 1 && numValues.every((v) => v === numValues[0]);
      const flag = allSame ? '  OK' : numValues.length > 1 ? '  DIFF' : '';

      console.log(`${metric.padEnd(35)} | ${values.join(' | ')}${flag}`);
    }

    // FCCR breakdown comparison
    console.log(`\n${'─'.repeat(100)}`);
    console.log(`  FCCR BREAKDOWN DETAIL\n`);

    for (const r of runs) {
      const bd = (r.fy2024 as Record<string, unknown> | null)?.fccr_breakdown as Record<string, unknown> | null;
      const sources = bd?.sources as Record<string, unknown> | null;
      console.log(`  Run ${r.run}:`);
      if (bd) {
        console.log(`    Adj EBITDA:         ${bd.adjusted_ebitda}`);
        console.log(`    - CapEx Deduction:  ${bd.capex_deduction} (capex: ${bd.capital_expenditures}, proceeds: ${bd.proceeds_from_lt_debt})`);
        console.log(`    - Cash Taxes:       ${bd.cash_taxes_paid}`);
        console.log(`    - Distributions:    ${bd.distributions_paid}`);
        console.log(`    = Numerator:        ${bd.numerator}`);
        console.log(`    Principal:          ${bd.ttm_principal_payments} (source: ${sources?.principal_source}, value: ${sources?.principal_value})`);
        console.log(`    Interest:           ${bd.ttm_interest_expense} (source: ${sources?.interest_source}, value: ${sources?.interest_value})`);
        console.log(`    Leases:             ${bd.lease_payments} (source: ${sources?.lease_source}, value: ${sources?.lease_value})`);
        console.log(`    Lease int deducted: ${sources?.lease_interest_deducted ?? 'none'}`);
        console.log(`    = Denominator:      ${bd.denominator}`);
        console.log(`    FCCR:               ${(r.fy2024 as Record<string, unknown>)?.fccr}x`);
      } else {
        console.log(`    (no breakdown)`);
      }
      console.log('');
    }

    // Adjusted EBITDA breakdown
    console.log(`  ADJUSTED EBITDA BREAKDOWN DETAIL\n`);

    for (const r of runs) {
      const bd = (r.fy2024 as Record<string, unknown> | null)?.adjusted_ebitda_breakdown as Record<string, unknown> | null;
      const adj = (r.fy2024 as Record<string, unknown> | null)?.adjusted_ebitda_components as Record<string, unknown> | null;
      console.log(`  Run ${r.run}:`);
      if (bd) {
        console.log(`    Base EBITDA:            ${bd.reported_ebitda}`);
        console.log(`    + Non-cash adj:         ${bd.non_cash_adjustments}`);
        console.log(`      SBC:                  ${adj?.stock_based_compensation ?? 'null'}`);
        console.log(`      Impairment:           ${adj?.impairment_charges ?? 'null'}`);
        console.log(`      Other non-cash:       ${adj?.other_non_cash ?? 'null'}`);
        console.log(`    + One-time expenses:    ${bd.one_time_expenses}`);
        console.log(`      Other one-time exp:   ${adj?.other_one_time_expenses ?? 'null'}`);
        console.log(`    - One-time gains:       ${bd.one_time_gains}`);
        console.log(`      Gain on asset sale:   ${adj?.gain_on_asset_sale ?? 'null'}`);
        console.log(`      Gain on disposal:     ${adj?.gain_on_disposal ?? 'null'}`);
        console.log(`      Other OT gains:       ${adj?.other_one_time_gains ?? 'null'}`);
        console.log(`      Other inc non-op:     ${adj?.other_income_non_operating ?? 'null'}`);
        console.log(`    - Interest income excl: ${bd.interest_income_excluded}`);
        console.log(`    + Unrealized FX:        ${bd.unrealized_fx_adjustment}`);
        console.log(`      Unrealized FX CF:     ${adj?.unrealized_fx_cash_flow ?? 'null'}`);
        console.log(`      Realized FX P&L:      ${bd.realized_fx_pl}`);
        console.log(`    + Owner/mgmt adj:       ${bd.owner_management_adjustments}`);
        console.log(`    + Accounting adj:       ${bd.accounting_adjustments}`);
        console.log(`    + Pro forma:            ${bd.pro_forma_adjustments}`);
        console.log(`    Uses reported:          ${bd.uses_reported_value}`);
        console.log(`    = Calc'd Adj EBITDA:    ${(r.fy2024 as Record<string, unknown>)?.calculated_adjusted_ebitda}`);
        console.log(`    = Final Adj EBITDA:     ${(r.fy2024 as Record<string, unknown>)?.adjusted_ebitda}`);
      } else {
        console.log(`    (no breakdown)`);
      }
      console.log('');
    }

    // Debt components
    console.log(`  DEBT COMPONENTS\n`);
    for (const r of runs) {
      const dc = (r.fy2024 as Record<string, unknown> | null)?.debt_components as Record<string, unknown> | null;
      const fc = (r.fy2024 as Record<string, unknown> | null)?.fixed_charges as Record<string, unknown> | null;
      console.log(`  Run ${r.run}:`);
      if (dc) {
        console.log(`    bank_debt_current:         ${dc.bank_debt_current ?? 'null'}`);
        console.log(`    bank_debt_long_term:       ${dc.bank_debt_long_term ?? 'null'}`);
        console.log(`    lease_liabilities_current:  ${dc.lease_liabilities_current ?? 'null'}`);
        console.log(`    lease_liabilities_long_term:${dc.lease_liabilities_long_term ?? 'null'}`);
        console.log(`    notes_payable:             ${dc.notes_payable ?? 'null'}`);
        console.log(`    other_borrowings:          ${dc.other_borrowings ?? 'null'}`);
        console.log(`    term_loans:                ${dc.term_loans ?? 'null'}`);
        console.log(`    revolving_credit_facilities:${dc.revolving_credit_facilities ?? 'null'}`);
      }
      if (fc) {
        console.log(`    --- Fixed Charges ---`);
        console.log(`    total_interest_expense:    ${fc.total_interest_expense ?? 'null'}`);
        console.log(`    senior_debt_interest:      ${fc.senior_debt_interest ?? 'null'}`);
        console.log(`    lease_interest:            ${fc.lease_interest ?? 'null'}`);
        console.log(`    finance_lease_payments:    ${fc.finance_lease_payments ?? 'null'}`);
        console.log(`    operating_lease_payments:  ${fc.operating_lease_payments ?? 'null'}`);
        console.log(`    principal_payments:        ${fc.principal_payments ?? 'null'}`);
      }
      console.log('');
    }

    // Duration
    console.log(`\n  TIMING:`);
    for (const r of runs) {
      console.log(`    Run ${r.run}: ${(r.duration_ms / 1000).toFixed(1)}s`);
    }

    // Warnings
    console.log(`\n  WARNINGS:`);
    for (const r of runs) {
      console.log(`\n  Run ${r.run} (${r.warnings.length} warnings):`);
      for (const w of r.warnings) {
        console.log(`    - ${w}`);
      }
    }
  }

  console.log(`\nPetValu FY2024 Extraction Test — 3 Sequential Runs`);
  console.log(`PDF: ${PDF_PATH}\n`);

  const runs: RunSummary[] = [];

  for (let i = 1; i <= 3; i++) {
    const summary = await runExtraction(i);
    runs.push(summary);
  }

  printComparison(runs);

  // Write full results to file for analysis
  const outputPath = path.resolve(__dirname, '../tmp/petvalu-3run-results.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(runs, null, 2));
  console.log(`\nFull results written to: ${outputPath}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

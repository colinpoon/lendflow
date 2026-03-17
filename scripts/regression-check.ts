/**
 * Regression check: Run extraction on multiple PDFs and output key ratios
 * Usage: npx tsx scripts/regression-check.ts
 */
import { config } from 'dotenv';
config();

async function main() {
  const { extractFinancialData } = await import('../utils/aiProcessor');
  const path = await import('path');

  const pdfs = [
    { name: 'Zedcor FY2024', file: '2024-12-31-Q4-Zedcor-Inc.-Financial-Stmts-4.9.2025v1.pdf', year: '2024' },
    { name: 'Taiga FY2024', file: 'Taiga_-_December_31,_2024_audited_financial_statements.pdf', year: '2024' },
  ];

  for (const pdf of pdfs) {
    const pdfPath = path.resolve(__dirname, '../public/financialReports', pdf.file);
    console.log(`\n${'='.repeat(80)}`);
    console.log(`  ${pdf.name}`);
    console.log(`${'='.repeat(80)}`);

    const start = Date.now();
    const result = await extractFinancialData(pdfPath);
    const duration = ((Date.now() - start) / 1000).toFixed(1);

    const data = result.metrics_by_year?.[pdf.year] as Record<string, unknown> | undefined;
    if (!data) {
      console.log(`  ⚠ No data for year ${pdf.year}`);
      continue;
    }

    const fmt = (v: unknown) => {
      if (v == null) return 'null';
      if (typeof v === 'number') return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
      return String(v);
    };

    console.log(`  Duration: ${duration}s`);
    console.log(`  EBITDA:              ${fmt(data.ebitda)}`);
    console.log(`  Adj EBITDA:          ${fmt(data.adjusted_ebitda)}`);
    console.log(`  FCCR:                ${fmt(data.fccr)}`);
    console.log(`  FCCR numerator:      ${fmt(data.fccr_numerator)}`);
    console.log(`  Total fixed charges: ${fmt(data.total_fixed_charges)}`);
    console.log(`  DSCR:                ${fmt(data.dscr)}`);
    console.log(`  Sr Debt/EBITDA:      ${fmt(data.senior_debt_to_ebitda)}`);
    console.log(`  Debt/Capital:        ${fmt(data.total_debt_to_capital)}%`);

    // Debt service details
    const bd = data.fccr_breakdown as Record<string, unknown> | null;
    if (bd) {
      const src = bd.sources as Record<string, unknown> | null;
      console.log(`\n  Debt Service Breakdown:`);
      console.log(`    Principal:  ${fmt(bd.ttm_principal_payments)} (source: ${src?.principal_source})`);
      console.log(`    Interest:   ${fmt(bd.ttm_interest_expense)} (source: ${src?.interest_source})`);
      console.log(`    Leases:     ${fmt(bd.lease_payments)} (source: ${src?.lease_source})`);
      console.log(`    Lease int deducted: ${fmt(src?.lease_interest_deducted)}`);
      console.log(`    CapEx ded:  ${fmt(bd.capex_deduction)} (mode: ${bd.capex_treatment})`);
      console.log(`    Cash taxes: ${fmt(bd.cash_taxes_paid)}`);
    }

    // Warnings
    const warnings = result.extraction_warnings ?? [];
    if (warnings.length > 0) {
      console.log(`\n  Warnings (${warnings.length}):`);
      for (const w of warnings) console.log(`    - ${w}`);
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

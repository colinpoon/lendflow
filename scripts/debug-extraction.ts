/**
 * Debug script to analyze extracted financial data
 * Run with: npx ts-node --esm scripts/debug-extraction.ts
 */

import { extractFinancialData } from '../utils/aiProcessor';
import path from 'path';
import fs from 'fs';

async function debugExtraction() {
  // Find the most recent uploaded file
  const uploadsDir = path.join(process.cwd(), 'uploads');

  if (!fs.existsSync(uploadsDir)) {
    console.log('No uploads directory found');
    return;
  }

  const files = fs.readdirSync(uploadsDir)
    .filter(f => f.endsWith('.pdf'))
    .map(f => ({
      name: f,
      path: path.join(uploadsDir, f),
      mtime: fs.statSync(path.join(uploadsDir, f)).mtime
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  if (files.length === 0) {
    console.log('No PDF files found in uploads/');
    return;
  }

  const latestFile = files[0];
  console.log(`\n🔍 Analyzing: ${latestFile.name}\n`);

  try {
    const result = await extractFinancialData(latestFile.path);

    if (!result.metrics_by_year) {
      console.log('No metrics extracted');
      return;
    }

    for (const [year, metrics] of Object.entries(result.metrics_by_year)) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`FISCAL YEAR ${year}`);
      console.log(`${'='.repeat(60)}\n`);

      // Core EBITDA values
      console.log('📊 EBITDA VALUES:');
      console.log(`   EBITDA (reported/calculated): ${metrics.ebitda}`);
      console.log(`   Adjusted EBITDA:              ${metrics.adjusted_ebitda}`);
      console.log(`   Reported Adjusted EBITDA:     ${metrics.reported_adjusted_ebitda ?? 'N/A'}`);
      console.log(`   Calculated Adjusted EBITDA:   ${metrics.calculated_adjusted_ebitda ?? 'N/A'}`);

      // Adjusted EBITDA Components - THE KEY DEBUG INFO
      const adj = (metrics.adjusted_ebitda_components || {}) as Record<string, unknown>;
      console.log('\n📋 ADJUSTED EBITDA COMPONENTS (Raw Extracted Values):');
      console.log('   NON-CASH ADJUSTMENTS (should be added back):');
      console.log(`     stock_based_compensation:   ${adj.stock_based_compensation ?? 'null'}`);
      console.log(`     impairment_charges:         ${adj.impairment_charges ?? 'null'}`);
      console.log(`     goodwill_impairment:        ${adj.goodwill_impairment ?? 'null'}`);
      console.log(`     unrealized_gains_losses:    ${adj.unrealized_gains_losses ?? 'null'}`);
      console.log(`     deferred_compensation:      ${adj.deferred_compensation ?? 'null'}`);
      console.log(`     ⚠️  loss_on_disposal:        ${adj.loss_on_disposal ?? 'null'} ← CURRENTLY EXCLUDED`);
      console.log(`     other_non_cash:             ${adj.other_non_cash ?? 'null'}`);

      console.log('\n   ONE-TIME EXPENSES (should be added back):');
      console.log(`     restructuring_costs:        ${adj.restructuring_costs ?? 'null'}`);
      console.log(`     severance_costs:            ${adj.severance_costs ?? 'null'}`);
      console.log(`     transaction_costs:          ${adj.transaction_costs ?? 'null'}`);
      console.log(`     legal_settlements:          ${adj.legal_settlements ?? 'null'}`);
      console.log(`     professional_fees_one_time: ${adj.professional_fees_one_time ?? 'null'}`);
      console.log(`     casualty_losses:            ${adj.casualty_losses ?? 'null'}`);
      console.log(`     other_one_time_expenses:    ${adj.other_one_time_expenses ?? 'null'}`);

      console.log('\n   ONE-TIME GAINS (should be subtracted):');
      console.log(`     ⚠️  gain_on_disposal:        ${adj.gain_on_disposal ?? 'null'} ← CURRENTLY EXCLUDED`);
      console.log(`     gain_on_asset_sale:         ${adj.gain_on_asset_sale ?? 'null'}`);
      console.log(`     other_income_non_operating: ${adj.other_income_non_operating ?? 'null'}`);
      console.log(`     insurance_proceeds:         ${adj.insurance_proceeds ?? 'null'}`);
      console.log(`     other_one_time_gains:       ${adj.other_one_time_gains ?? 'null'}`);

      console.log('\n   OTHER ADJUSTMENTS:');
      console.log(`     foreign_exchange_adjustments: ${adj.foreign_exchange_adjustments ?? 'null'}`);
      console.log(`     owner_compensation_adjustment: ${adj.owner_compensation_adjustment ?? 'null'}`);
      console.log(`     related_party_adjustments:    ${adj.related_party_adjustments ?? 'null'}`);
      console.log(`     management_fees_adjustment:   ${adj.management_fees_adjustment ?? 'null'}`);

      // Breakdown if available
      const breakdown = metrics.adjusted_ebitda_breakdown;
      if (breakdown) {
        console.log('\n📈 ADJUSTED EBITDA BREAKDOWN (Calculated):');
        console.log(`   Reported EBITDA:             ${breakdown.reported_ebitda}`);
        console.log(`   + Non-cash Adjustments:      ${breakdown.non_cash_adjustments}`);
        console.log(`   + One-time Expenses:         ${breakdown.one_time_expenses}`);
        console.log(`   - One-time Gains:            ${breakdown.one_time_gains}`);
        console.log(`   + Owner/Mgmt Adjustments:    ${breakdown.owner_management_adjustments}`);
        console.log(`   + Accounting Adjustments:    ${breakdown.accounting_adjustments}`);
        console.log(`   + FX Adjustments:            ${breakdown.fx_adjustments}`);
        console.log(`   + Pro Forma Adjustments:     ${breakdown.pro_forma_adjustments}`);
        console.log(`   ─────────────────────────────────────`);

        // Calculate what the value WOULD be if we included loss_on_disposal
        const lossOnDisposal = (adj.loss_on_disposal as number) ?? 0;
        const gainOnDisposal = (adj.gain_on_disposal as number) ?? 0;
        const potentialAdjustedEbitda = (metrics.adjusted_ebitda ?? 0) + lossOnDisposal - gainOnDisposal;

        console.log(`   = Current Adjusted EBITDA:   ${metrics.adjusted_ebitda}`);
        if (lossOnDisposal !== 0 || gainOnDisposal !== 0) {
          console.log(`\n   🔧 IF DISPOSAL ITEMS WERE INCLUDED:`);
          console.log(`      + loss_on_disposal:       ${lossOnDisposal}`);
          console.log(`      - gain_on_disposal:       ${gainOnDisposal}`);
          console.log(`      = Potential Adj. EBITDA:  ${potentialAdjustedEbitda}`);
        }
      }

      // Key ratios
      console.log('\n📊 KEY RATIOS:');
      console.log(`   FCCR:                        ${metrics.fccr}`);
      console.log(`   Senior Debt/EBITDA:          ${metrics.senior_debt_to_ebitda}`);
      console.log(`   Total Debt/Total Capital:    ${metrics.total_debt_to_capital ? (metrics.total_debt_to_capital * 100).toFixed(1) + '%' : 'N/A'}`);

      // Debt values
      console.log('\n💰 DEBT VALUES:');
      console.log(`   Senior Debt:                 ${metrics.senior_debt}`);
      console.log(`   Total Debt:                  ${metrics.total_debt}`);
      console.log(`   Shareholders Equity:         ${metrics.shareholders_equity}`);
    }

  } catch (error) {
    console.error('Error during extraction:', error);
  }
}

debugExtraction();

/**
 * AI Financial Data Extraction Processor
 * Main orchestrator for extracting financial metrics from documents
 *
 * This module coordinates:
 * 1. Document parsing (PDF/text)
 * 2. Text chunking and deduplication
 * 3. AI-powered metric extraction (SEQUENTIAL for determinism)
 * 4. Conflict reconciliation (AI-powered resolution)
 * 5. Financial calculations (debt, EBITDA, FCCR, ratios)
 * 6. Risk assessment generation
 */

import { parseDocument } from '@/lib/document-parser';
import {
  chunkText,
  deduplicateChunks,
  processChunksSequentially,
  type ProgressCallback,
  type ChunkResult,
  type AIExtractionResponse,
} from '@/lib/chunk-processor';
import { mergeExtractions, normalizeScaleMismatch } from '@/lib/extraction-merger';
import {
  generateRiskAssessment,
  generateDebtHealthAssessment,
} from '@/lib/risk-generator';
import {
  calculateDebtMetrics,
  calculateEBITDA,
  calculateAdjustedEBITDA,
  calculateFCCR,
  calculateDSCR,
  calculateTotalDebtToCapital,
  calculateSeniorDebtToEBITDA,
  calculateInterestCoverageRatio,
  calculateDebtToEquityRatio,
  calculateCurrentRatio,
} from '@/lib/calculations';
import {
  calculateQuantitativeRisk,
  type QuantitativeRiskAssessment,
} from '@/lib/quantitative-risk';
import { AI_CONFIG } from '@/lib/constants';
import type { ComputedMetrics, ExtractedMetrics, RiskData, DebtHealthAssessment } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Main Export
// ─────────────────────────────────────────────────────────────────────────────

export interface ExtractionResult {
  metrics_by_year?: Record<string, ComputedMetrics>;
  riskAssessment?: RiskData | null;
  debtHealthAssessment?: DebtHealthAssessment | null;
  quantitativeRiskAssessment?: QuantitativeRiskAssessment | null;
  validation_issues?: Record<string, string[]>;
  extraction_warnings?: string[];
  chunk_stats?: {
    total: number;
    successful: number;
    failed: number;
  };
  /** Raw chunk results when no metrics could be extracted */
  raw_chunks?: ChunkResult[];
}

// Re-export ProgressCallback for API route
export type { ProgressCallback };

/**
 * Extract financial data from an uploaded document
 * Main entry point for the AI extraction pipeline
 *
 * @param filePath - Path to the document (PDF, Excel, or text)
 * @param onProgress - Optional callback for progress updates
 * @returns Extracted financial metrics, ratios, and risk assessments
 */
export const extractFinancialData = async (
  filePath: string,
  onProgress?: ProgressCallback
): Promise<ExtractionResult> => {
  try {
    // Validate environment
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        'OpenAI API key is missing. Please configure it in the environment variables.'
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 1: Document Parsing
    // ─────────────────────────────────────────────────────────────────────────

    onProgress?.({
      stage: 'parsing',
      progress: 10,
      message: 'Parsing document...',
    });

    const fileContent = await parseDocument(filePath);

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 2: Text Chunking & Deduplication
    // ─────────────────────────────────────────────────────────────────────────

    onProgress?.({
      stage: 'chunking',
      progress: 15,
      message: 'Chunking document...',
    });

    const textChunks = chunkText(fileContent, AI_CONFIG.CHUNK_SIZE);
    console.log(`✅ Prepared ${textChunks.length} text chunk(s) for analysis.`);

    const uniqueChunks = deduplicateChunks(textChunks);
    console.log(
      `📊 Processing ${uniqueChunks.length} unique chunks (${textChunks.length - uniqueChunks.length} duplicates removed)`
    );

    onProgress?.({
      stage: 'extracting',
      progress: 20,
      message: `Starting AI extraction on ${uniqueChunks.length} chunks...`,
      chunk: 0,
      totalChunks: uniqueChunks.length,
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 3: AI Extraction (SEQUENTIAL for determinism)
    // ─────────────────────────────────────────────────────────────────────────

    const chunkResults = await processChunksSequentially(uniqueChunks, onProgress);

    // Calculate chunk stats
    const successfulChunks = chunkResults.filter((r) => r.result !== null);
    const failedChunkCount = chunkResults.length - successfulChunks.length;
    const chunkStats = {
      total: chunkResults.length,
      successful: successfulChunks.length,
      failed: failedChunkCount,
    };

    // Track extraction warnings
    const extractionWarnings: string[] = [];
    if (failedChunkCount > 0) {
      extractionWarnings.push(
        `${failedChunkCount} of ${chunkResults.length} document sections could not be processed`
      );
    }

    // Filter to successful extractions only
    const allExtractions = successfulChunks.map((r) => r.result);

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 4: Merge & Consolidate (deterministic first-wins)
    // ─────────────────────────────────────────────────────────────────────────

    onProgress?.({
      stage: 'merging',
      progress: 70,
      message: 'Merging extractions...',
    });

    const rawMerged = mergeExtractions(allExtractions);

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 4b: Normalize Scale Mismatches
    // Detect and fix when AI returns raw dollars vs thousands inconsistently
    // ─────────────────────────────────────────────────────────────────────────

    const merged = normalizeScaleMismatch(rawMerged);

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 5: Compute Derived Metrics
    // ─────────────────────────────────────────────────────────────────────────

    onProgress?.({
      stage: 'computing',
      progress: 75,
      message: 'Computing financial ratios...',
    });

    const computed: Record<string, ComputedMetrics> = {};
    for (const yr of Object.keys(merged)) {
      computed[yr] = computeMetrics(merged[yr]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 6: Validation
    // ─────────────────────────────────────────────────────────────────────────

    onProgress?.({
      stage: 'validating',
      progress: 80,
      message: 'Validating data...',
    });

    const validationIssues = validateMetrics(computed);

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 7: Risk Assessment Generation
    // ─────────────────────────────────────────────────────────────────────────

    onProgress?.({
      stage: 'assessing',
      progress: 85,
      message: 'Generating risk assessment...',
    });

    const riskSnapshot = await generateRiskAssessment(computed);
    const debtHealthAssessment = await generateDebtHealthAssessment(computed);

    console.log(`📊 Computing quantitative risk for ${Object.keys(computed).length} years:`, Object.keys(computed));
    const quantitativeRiskAssessment = calculateQuantitativeRisk(computed);
    console.log(`📊 Quantitative risk result:`, quantitativeRiskAssessment ? 'SUCCESS' : 'NULL');

    if (quantitativeRiskAssessment) {
      console.log(`\n📊 QUANTITATIVE RISK ASSESSMENT:`);
      console.log(`   Normalized Score: ${quantitativeRiskAssessment.normalized_score}/100`);
      console.log(`   Risk Band: ${quantitativeRiskAssessment.risk_band}`);
      console.log(`   ${quantitativeRiskAssessment.trend_summary}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 8: Build Result
    // ─────────────────────────────────────────────────────────────────────────

    if (Object.keys(computed).length > 0 || riskSnapshot || debtHealthAssessment || quantitativeRiskAssessment) {
      console.log('✅ Extraction complete. Returning combined result.');
      return {
        ...(Object.keys(computed).length > 0 && { metrics_by_year: computed }),
        ...(riskSnapshot && { riskAssessment: riskSnapshot }),
        ...(debtHealthAssessment && { debtHealthAssessment }),
        ...(quantitativeRiskAssessment && { quantitativeRiskAssessment }),
        ...(Object.keys(validationIssues).length > 0 && {
          validation_issues: validationIssues,
        }),
        ...(extractionWarnings.length > 0 && { extraction_warnings: extractionWarnings }),
        chunk_stats: chunkStats,
      };
    }

    return {
      raw_chunks: chunkResults,
      ...(extractionWarnings.length > 0 && { extraction_warnings: extractionWarnings }),
      chunk_stats: chunkStats,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❗ AI processing failed:', errorMessage);
    throw new Error('AI processing failed: ' + errorMessage);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Metric Computation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute all derived metrics for a single year
 * @param m - Extracted metrics for one year
 * @returns Computed metrics including ratios and breakdowns
 */
function computeMetrics(m: ExtractedMetrics): ComputedMetrics {
  const result = m as ComputedMetrics;

  // ─────────────────────────────────────────────────────────────────────────
  // Debt Calculation
  // ─────────────────────────────────────────────────────────────────────────

  const debtResult = calculateDebtMetrics(m);
  result.senior_debt = debtResult.senior_debt;
  result.total_debt = debtResult.total_debt;
  result.debt_breakdown = debtResult.debt_breakdown;

  // ─────────────────────────────────────────────────────────────────────────
  // EBITDA Calculation
  // ─────────────────────────────────────────────────────────────────────────

  // Debug: Show extracted EBITDA components
  console.log(`\n📊 EBITDA COMPONENTS (Extracted):`);
  console.log(`   net_income:                ${m.net_income}`);
  console.log(`   interest:                  ${m.interest}`);
  console.log(`   taxes:                     ${m.taxes}`);
  console.log(`   depreciation_amortization: ${m.depreciation_amortization}`);
  console.log(`   ebitda (if reported):      ${m.ebitda ?? 'N/A (will calculate)'}`);

  const ebitda = calculateEBITDA(m);
  if (ebitda != null) {
    if (m.ebitda == null) {
      result.ebitda = ebitda;
      result.ebitda_calculated = true;
      console.log(`   CALCULATED EBITDA:         ${ebitda} = ${m.net_income} + ${m.interest ?? 0} + ${m.taxes ?? 0} + ${m.depreciation_amortization}`);
    } else {
      console.log(`   USING REPORTED EBITDA:     ${m.ebitda}`);
    }

    // Adjusted EBITDA
    const ebitdaResult = calculateAdjustedEBITDA(ebitda, m);
    result.adjusted_ebitda = ebitdaResult.adjusted_ebitda;
    result.calculated_adjusted_ebitda = ebitdaResult.calculated_adjusted_ebitda;
    result.adjusted_ebitda_breakdown = ebitdaResult.adjusted_ebitda_breakdown;

    // Debug logging
    logAdjustedEBITDA(ebitda, ebitdaResult, m);
  } else {
    result.adjusted_ebitda = m.reported_adjusted_ebitda ?? null;
    result.calculated_adjusted_ebitda = null;
    result.adjusted_ebitda_breakdown = null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FCCR Calculation
  // ─────────────────────────────────────────────────────────────────────────

  const fccrResult = calculateFCCR(result.adjusted_ebitda ?? result.ebitda, m);
  result.fccr = fccrResult.fccr;
  result.fccr_numerator = fccrResult.fccr_numerator;
  result.total_fixed_charges = fccrResult.total_fixed_charges;
  result.cash_flow_for_debt_servicing = fccrResult.cash_flow_for_debt_servicing;
  result.fccr_breakdown = fccrResult.fccr_breakdown;

  // Debug logging
  logFCCR(result.adjusted_ebitda ?? result.ebitda, m, fccrResult);

  // ─────────────────────────────────────────────────────────────────────────
  // Ratio Calculations
  // ─────────────────────────────────────────────────────────────────────────

  result.total_debt_to_capital = calculateTotalDebtToCapital(
    result.total_debt,
    result.shareholders_equity
  );

  result.senior_debt_to_ebitda = calculateSeniorDebtToEBITDA(
    result.senior_debt,
    result.adjusted_ebitda ?? result.ebitda
  );

  result.interest_coverage_ratio = calculateInterestCoverageRatio(
    result.ebitda,
    result.interest
  );

  result.debt_to_equity_ratio = calculateDebtToEquityRatio(
    result.total_debt,
    result.shareholders_equity
  );

  result.current_ratio = calculateCurrentRatio(
    result.current_assets,
    result.current_liabilities
  );

  // ─────────────────────────────────────────────────────────────────────────
  // DSCR Calculation (Banker's Covenant Method)
  // ─────────────────────────────────────────────────────────────────────────

  const dscrResult = calculateDSCR(result.adjusted_ebitda ?? result.ebitda, result);
  result.dscr = dscrResult.dscr;
  result.funded_debt = dscrResult.funded_debt;
  result.funded_debt_to_ebitda = dscrResult.funded_debt_to_ebitda;
  result.dscr_breakdown = dscrResult.dscr_breakdown;

  // Debug logging
  logDSCR(result.adjusted_ebitda ?? result.ebitda, result, dscrResult);

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate extracted metrics for common issues
 */
function validateMetrics(
  metrics: Record<string, ComputedMetrics>
): Record<string, string[]> {
  const issues: Record<string, string[]> = {};

  for (const [year, data] of Object.entries(metrics)) {
    const problems: string[] = [];

    if (data.expenses != null && data.revenue != null && data.expenses > data.revenue) {
      problems.push('Expenses exceed revenue');
    }
    if (data.debt_to_equity_ratio != null && !isFinite(data.debt_to_equity_ratio)) {
      problems.push('Debt-to-equity ratio is not a finite number');
    }
    if (data.interest_coverage_ratio != null && !isFinite(data.interest_coverage_ratio)) {
      problems.push('Interest coverage ratio is not a finite number');
    }

    if (problems.length > 0) {
      issues[year] = problems;
    }
  }

  return issues;
}

// ─────────────────────────────────────────────────────────────────────────────
// Debug Logging
// ─────────────────────────────────────────────────────────────────────────────

function logAdjustedEBITDA(
  ebitda: number,
  result: ReturnType<typeof calculateAdjustedEBITDA>,
  m: ExtractedMetrics
): void {
  const breakdown = result.adjusted_ebitda_breakdown;
  if (!breakdown) return;

  const adj = (m.adjusted_ebitda_components || {}) as NonNullable<typeof m.adjusted_ebitda_components>;
  console.log(`\n📊 ADJUSTED EBITDA CALCULATION DEBUG:`);
  console.log(`   Base EBITDA:                 ${ebitda}`);
  console.log(`   + Non-cash Adjustments:      ${breakdown.non_cash_adjustments}`);
  console.log(`     stock_based_compensation:  ${adj.stock_based_compensation ?? 0}`);
  console.log(`     impairment_charges:        ${adj.impairment_charges ?? 0}`);
  console.log(`     goodwill_impairment:       ${adj.goodwill_impairment ?? 0}`);
  console.log(`     unrealized_gains_losses:   ${adj.unrealized_gains_losses ?? 0}`);
  console.log(`     deferred_compensation:     ${adj.deferred_compensation ?? 0}`);
  console.log(`     other_non_cash:            ${adj.other_non_cash ?? 0}`);
  console.log(`     (disposal losses excluded - operational: ${adj.loss_on_disposal ?? 0})`);
  console.log(`   + One-time Expenses:         ${breakdown.one_time_expenses}`);
  console.log(`   + Owner/Mgmt Adjustments:    ${breakdown.owner_management_adjustments}`);
  console.log(`   + Accounting Adjustments:    ${breakdown.accounting_adjustments}`);
  console.log(`   + FX Adjustments:            ${breakdown.fx_adjustments}`);
  console.log(`   + Pro Forma Adjustments:     ${breakdown.pro_forma_adjustments}`);
  console.log(`   - One-time Gains:            ${breakdown.one_time_gains}`);
  console.log(`     other_income_non_operating: ${adj.other_income_non_operating ?? 0}`);
  console.log(`     (disposal gains excluded - operational: ${adj.gain_on_disposal ?? 0})`);
  console.log(`   ─────────────────────────────────────`);
  console.log(`   = Calculated Adj. EBITDA:    ${result.calculated_adjusted_ebitda}`);
  console.log(`   Reported Adj. EBITDA:        ${m.reported_adjusted_ebitda ?? 'N/A'}`);
  console.log(`   FINAL Adjusted EBITDA:       ${result.adjusted_ebitda}`);

  console.log('');
}

function logFCCR(
  adjustedEbitda: number | null,
  m: ExtractedMetrics,
  result: ReturnType<typeof calculateFCCR>
): void {
  const breakdown = result.fccr_breakdown;
  if (!breakdown) return;

  console.log(`\n📊 FCCR CALCULATION DEBUG:`);
  console.log(`   NUMERATOR COMPONENTS:`);
  console.log(`     Adjusted EBITDA:           ${adjustedEbitda}`);
  console.log(`     Capital Expenditures:      ${breakdown.capital_expenditures} (extracted: ${m.capital_expenditures})`);
  console.log(`     Proceeds from LT Debt:     ${breakdown.proceeds_from_lt_debt} (extracted: ${m.proceeds_from_long_term_debt})`);
  console.log(`     Unfunded CapEx:            ${breakdown.unfunded_capex} (= CapEx - Proceeds)`);
  console.log(`     Cash Taxes Paid:           ${breakdown.cash_taxes_paid} (extracted: ${m.cash_taxes_paid})`);
  console.log(`     Distributions Paid:        ${breakdown.distributions_paid} (extracted: ${m.distributions_paid})`);
  console.log(`   DENOMINATOR COMPONENTS:`);
  console.log(`     TTM Principal Payments:    ${breakdown.ttm_principal_payments} (extracted: ${m.ttm_principal_payments})`);
  console.log(`     TTM Interest Expense:      ${breakdown.ttm_interest_expense} (ttm: ${m.ttm_interest_expense}, cash_paid: ${m.cash_interest_paid}, accrual: ${m.interest})`);
  console.log(`     Lease Payments:            ${breakdown.lease_payments} (extracted: ${m.payment_of_lease_liability})`);
  console.log(`     Total Debt Service:        ${breakdown.denominator}`);
  console.log(`   FCCR CALCULATION:`);
  console.log(`     Numerator = ${adjustedEbitda} - ${breakdown.unfunded_capex} - ${breakdown.cash_taxes_paid} - ${breakdown.distributions_paid} = ${breakdown.numerator}`);
  console.log(`     Denominator = ${breakdown.denominator}`);
  console.log(`     FCCR = ${breakdown.numerator} / ${breakdown.denominator} = ${result.fccr}x\n`);
}

function logDSCR(
  adjustedEbitda: number | null,
  m: ExtractedMetrics,
  result: ReturnType<typeof calculateDSCR>
): void {
  const breakdown = result.dscr_breakdown;
  if (!breakdown) return;

  console.log(`\n📊 DSCR CALCULATION DEBUG (BANKER'S COVENANT METHOD):`);
  console.log(`   NUMERATOR:`);
  console.log(`     Adjusted EBITDA:           ${adjustedEbitda}`);
  console.log(`   DENOMINATOR COMPONENTS (Debt Service):`);
  console.log(`     Bank Principal Payments:   ${breakdown.bank_principal_payments} (extracted: ${m.repayment_of_debt})`);
  console.log(`     Cash Interest Paid:        ${breakdown.bank_interest_expense} (extracted: ${m.cash_interest_paid})`);
  console.log(`     Lease Payments:            ${breakdown.lease_payments} (extracted: ${m.payment_of_lease_liability})`);
  console.log(`     Total Debt Service:        ${breakdown.total_debt_service}`);
  console.log(`   DSCR = ${adjustedEbitda} / ${breakdown.total_debt_service} = ${result.dscr}x`);
  console.log(`   FUNDED DEBT METRICS:`);
  console.log(`     Funded Debt (Bank Only):   ${breakdown.funded_debt}`);
  console.log(`     Funded Debt / EBITDA:      ${breakdown.funded_debt_to_ebitda}x\n`);
}

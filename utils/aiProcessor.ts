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
  chunkTextSemantic,
  deduplicateChunks,
  processChunksSequentially,
  type ProgressCallback,
  type ChunkResult,
  type ChunkProcessingResult,
  type AIExtractionResponse,
  type ExtractionMetadata,
} from '@/lib/chunk-processor';
import { calculateTextCost } from '@/lib/benchmarks/cost';
import {
  mergeExtractionsWithConflicts,
  normalizeScaleMismatch,
  validateCrossMetricScale,
  validateArithmeticConsistency,
  applyDetectedScale,
  type MergeResult,
  type MetricConflict,
  type ScaleNormalizationResult,
} from '@/lib/extraction-merger';
import { MERGE_CONFIG } from '@/lib/constants';
import { resolveHighVarianceConflicts } from '@/lib/extraction-reconciler';
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
  /**
   * The most recent fiscal year that this document is primarily reporting on.
   * Derived from the AI's top-level primary_fiscal_year field — not per-year.
   * Used by detectYearConflicts to distinguish the document's main year from
   * comparative/prior-year columns that appear as secondary data.
   */
  primary_fiscal_year?: string | null;
  riskAssessment?: RiskData | null;
  debtHealthAssessment?: DebtHealthAssessment | null;
  quantitativeRiskAssessment?: QuantitativeRiskAssessment | null;
  validation_issues?: Record<string, string[]>;
  extraction_warnings?: string[];
  /** Conflicts detected during merge (>20% variance between chunks) */
  merge_conflicts?: MetricConflict[];
  chunk_stats?: {
    total: number;
    successful: number;
    failed: number;
    withWarnings: number;
  };
  /** Raw chunk results when no metrics could be extracted */
  raw_chunks?: ChunkResult[];
  /** Token usage for cost tracking (COST-01) */
  token_usage?: {
    input_tokens: number;
    output_tokens: number;
    model: string;
    cost_usd?: number;
  };
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
    // Validate environment - now using Anthropic Claude for text extraction
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        'ANTHROPIC_API_KEY is missing. Please configure it in the environment variables.'
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
      message: 'Chunking document with semantic boundaries...',
    });

    // Use semantic chunking that respects table/paragraph boundaries
    const textChunks = chunkTextSemantic(fileContent);
    console.log(`✅ Prepared ${textChunks.length} semantic chunk(s) for analysis.`);

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

    const chunkProcessingResult = await processChunksSequentially(uniqueChunks, onProgress);
    const chunkResults = chunkProcessingResult.results;

    // Calculate chunk stats
    const successfulChunks = chunkResults.filter((r) => r.result !== null);
    const failedChunkCount = chunkResults.length - successfulChunks.length;
    const chunksWithWarnings = chunkResults.filter(
      (r) => r.validationWarnings && r.validationWarnings.length > 0
    );
    const chunkStats = {
      total: chunkResults.length,
      successful: successfulChunks.length,
      failed: failedChunkCount,
      withWarnings: chunksWithWarnings.length,
    };

    // Calculate cost from token usage (COST-01)
    const tokenUsage = chunkProcessingResult.token_usage;
    const costBreakdown = calculateTextCost(tokenUsage);

    // Track extraction warnings
    const extractionWarnings: string[] = [];
    if (failedChunkCount > 0) {
      extractionWarnings.push(
        `${failedChunkCount} of ${chunkResults.length} document sections could not be processed`
      );
    }

    // Add validation warnings from chunks
    for (const chunk of chunksWithWarnings) {
      for (const warning of chunk.validationWarnings || []) {
        extractionWarnings.push(`Chunk ${chunk.index}: ${warning}`);
      }
    }

    // Filter to successful extractions only (filter out nulls with type guard)
    const allExtractions = successfulChunks
      .map((r) => r.result)
      .filter((result): result is AIExtractionResponse => result !== null);

    // Derive primary_fiscal_year from chunk responses.
    // Multiple chunks may each report one — take the first non-null value found.
    // The AI is instructed to emit the document's primary reporting year (not
    // comparative columns), so any chunk that identifies it is authoritative.
    const primary_fiscal_year: string | null =
      allExtractions.find((e) => e.primary_fiscal_year != null)?.primary_fiscal_year ?? null;

    if (primary_fiscal_year) {
      console.log(`📅 Primary fiscal year identified: ${primary_fiscal_year}`);
    }

    // Collect extraction_metadata from chunks — prefer the highest-confidence detection.
    // Multiple chunks may independently detect the document scale; we sort by confidence
    // (high > medium > low) and take the top result to drive the scale conversion step.
    const confidenceOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
    const extraction_metadata: ExtractionMetadata | null = allExtractions
      .map((e) => e.extraction_metadata)
      .filter((m): m is ExtractionMetadata => m != null)
      .sort((a, b) => (confidenceOrder[b.scale_confidence] ?? 0) - (confidenceOrder[a.scale_confidence] ?? 0))[0] ?? null;

    if (extraction_metadata) {
      console.log(
        `Scale detected: ${extraction_metadata.detected_scale}` +
        ` (confidence: ${extraction_metadata.scale_confidence},` +
        ` indicator: "${extraction_metadata.scale_indicator_found ?? 'none'}")`
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 4: Merge & Consolidate (conflict-aware weighted merge)
    // ─────────────────────────────────────────────────────────────────────────

    onProgress?.({
      stage: 'merging',
      progress: 70,
      message: 'Merging extractions with conflict resolution...',
    });

    // Cast is safe: AIExtractionResponse is structurally compatible with ExtractionInput
    const mergeResult = mergeExtractionsWithConflicts(allExtractions as Parameters<typeof mergeExtractionsWithConflicts>[0]);
    let rawMerged = mergeResult.metrics;

    // Log merge conflicts for transparency
    if (mergeResult.conflictsDetected > 0) {
      console.log(
        `⚠️ Detected ${mergeResult.conflictsDetected} metric conflicts during merge`
      );
      extractionWarnings.push(
        `${mergeResult.conflictsDetected} metric conflicts detected and resolved (see merge_conflicts for details)`
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 4a: AI Reconciliation for High-Variance Conflicts
    // Escalate conflicts with >20% variance to AI for resolution
    // NOTE: This runs BEFORE arithmetic validation so AI decisions can be
    // verified/corrected by the deterministic arithmetic check
    // ─────────────────────────────────────────────────────────────────────────

    const highVarianceConflicts = mergeResult.conflicts.filter(
      (c) =>
        c.variancePercent > MERGE_CONFIG.AI_RECONCILIATION_THRESHOLD_PERCENT &&
        c.resolution === 'highest_confidence'
    );

    if (highVarianceConflicts.length > 0) {
      console.log(
        `🤖 Escalating ${highVarianceConflicts.length} high-variance conflicts to AI reconciliation...`
      );

      try {
        const aiResolutions = await resolveHighVarianceConflicts(highVarianceConflicts);

        // Apply AI resolutions to merged data
        for (const [key, resolvedValue] of aiResolutions.entries()) {
          const [year, metric] = key.split(':');
          if (rawMerged[year]) {
            const oldValue = rawMerged[year][metric];
            rawMerged[year][metric] = resolvedValue;
            console.log(
              `   Applied AI resolution: ${year}/${metric}: ${oldValue} → ${resolvedValue}`
            );
          }
        }

        if (aiResolutions.size > 0) {
          extractionWarnings.push(
            `AI reconciliation resolved ${aiResolutions.size} high-variance conflicts`
          );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ AI reconciliation failed: ${errorMessage}`);
        extractionWarnings.push(`AI reconciliation failed: ${errorMessage}`);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 4b: Arithmetic Validation (FINAL GATE)
    // Verify EBITDA = Net Income + Interest + Taxes + D&A
    // This runs AFTER AI reconciliation to catch/correct AI errors
    // If a candidate matches the calculated value, use it instead
    // ─────────────────────────────────────────────────────────────────────────

    const arithmeticResult = validateArithmeticConsistency(rawMerged, mergeResult.candidatesMap);
    rawMerged = arithmeticResult.metrics;

    if (arithmeticResult.corrections.length > 0) {
      extractionWarnings.push(
        `Arithmetic corrections applied: ${arithmeticResult.corrections.join('; ')}`
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 4c-pre: AI-Detected Scale Conversion
    // Applies a uniform multiplier based on the document's declared unit (millions,
    // billions, raw_dollars). This runs BEFORE the heuristic scale checks so that
    // documents explicitly labelled "(in millions)" are correctly scaled without
    // relying on magnitude thresholds that can mis-fire on large companies.
    // ─────────────────────────────────────────────────────────────────────────

    const detectedScaleResult = applyDetectedScale(rawMerged, extraction_metadata);
    rawMerged = detectedScaleResult.metrics;

    if (detectedScaleResult.corrections.length > 0) {
      extractionWarnings.push(...detectedScaleResult.corrections);
      console.log(
        `Scale conversion applied: ${detectedScaleResult.corrections.length} year(s) converted`
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 4c: Cross-Metric Scale Validation
    // Detects when entire year is in raw dollars by checking EBITDA margin
    // Corrects ALL currency metrics if needed, or just Revenue if isolated
    // Runs AFTER detected-scale conversion as a safety net for ambiguous documents
    // ─────────────────────────────────────────────────────────────────────────

    const crossMetricResult = validateCrossMetricScale(rawMerged);

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 4d: Cross-Year Scale Normalization
    // Detect and fix when AI returns raw dollars vs thousands inconsistently
    // between years (e.g., 2023 in thousands, 2024 in raw dollars)
    // ─────────────────────────────────────────────────────────────────────────

    const crossYearResult = normalizeScaleMismatch(crossMetricResult.metrics);
    const merged = crossYearResult.metrics;

    // Surface scale corrections as warnings for transparency
    const allScaleCorrections = [
      ...crossMetricResult.corrections,
      ...crossYearResult.corrections,
    ];
    if (allScaleCorrections.length > 0) {
      extractionWarnings.push(
        `Scale corrections applied (${allScaleCorrections.length}): ${allScaleCorrections.join('; ')}`
      );
      console.log(
        `⚠️ Scale corrections applied: ${allScaleCorrections.length} corrections`
      );
    }

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
      computed[yr] = computeMetrics(merged[yr] as unknown as ExtractedMetrics);
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
        // Document-level field: the year this document primarily reports on.
        // null means the AI could not identify it (e.g., document title missing).
        primary_fiscal_year,
        ...(riskSnapshot && { riskAssessment: riskSnapshot }),
        ...(debtHealthAssessment && { debtHealthAssessment }),
        ...(quantitativeRiskAssessment && { quantitativeRiskAssessment }),
        ...(Object.keys(validationIssues).length > 0 && {
          validation_issues: validationIssues,
        }),
        ...(extractionWarnings.length > 0 && { extraction_warnings: extractionWarnings }),
        ...(mergeResult.conflicts.length > 0 && { merge_conflicts: mergeResult.conflicts }),
        chunk_stats: chunkStats,
        token_usage: {
          ...tokenUsage,
          cost_usd: costBreakdown.total_cost,
        },
      };
    }

    return {
      raw_chunks: chunkResults,
      ...(extractionWarnings.length > 0 && { extraction_warnings: extractionWarnings }),
      chunk_stats: chunkStats,
      token_usage: {
        ...tokenUsage,
        cost_usd: costBreakdown.total_cost,
      },
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
  // Deep clone to prevent nested objects (debt_components, fixed_charges,
  // adjusted_ebitda_components, etc.) from sharing references with the caller's
  // copy of `m`. A shallow spread would let mutations on `result` silently mutate
  // `m`, causing hard-to-diagnose cross-year contamination.
  // structuredClone is available in Node 17+ and all modern browsers.
  const result = structuredClone(m) as ComputedMetrics;

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

  // Debug: Show extracted EBITDA components (gated behind DEBUG_FINANCIALS)
  if (DEBUG_FINANCIALS) {
    console.log(`\n📊 EBITDA COMPONENTS (Extracted):`);
    console.log(`   net_income:                ${m.net_income}`);
    console.log(`   interest:                  ${m.interest}`);
    console.log(`   taxes:                     ${m.taxes}`);
    console.log(`   depreciation_amortization: ${m.depreciation_amortization}`);
    console.log(`   ebitda (if reported):      ${m.ebitda ?? 'N/A (will calculate)'}`);
  }

  const ebitdaCalc = calculateEBITDA(m);
  if (ebitdaCalc != null) {
    const ebitda = ebitdaCalc.value;
    const { usedGrossFallback } = ebitdaCalc;

    if (m.ebitda == null) {
      result.ebitda = ebitda;
      result.ebitda_calculated = true;
      if (DEBUG_FINANCIALS) {
        console.log(`   CALCULATED EBITDA:         ${ebitda} = ${m.net_income} + ${m.interest ?? 0} + ${m.taxes ?? 0} + ${m.depreciation_amortization}`);
        if (usedGrossFallback) {
          console.log(`   ⚠️ INTEREST SOURCE:        Gross fallback (P&L interest was negative/null)`);
        }
      }
    } else {
      if (DEBUG_FINANCIALS) {
        console.log(`   USING REPORTED EBITDA:     ${m.ebitda}`);
      }
    }

    // Adjusted EBITDA — pass usedGrossFallback to gate interest income exclusion
    const ebitdaResult = calculateAdjustedEBITDA(ebitda, m, usedGrossFallback);
    result.adjusted_ebitda = ebitdaResult.adjusted_ebitda;
    result.calculated_adjusted_ebitda = ebitdaResult.calculated_adjusted_ebitda;
    result.adjusted_ebitda_breakdown = ebitdaResult.adjusted_ebitda_breakdown;

    // Write back deduped component values so UI displays post-dedup figures
    if (result.adjusted_ebitda_components) {
      result.adjusted_ebitda_components = {
        ...result.adjusted_ebitda_components,
        other_non_cash: ebitdaResult.deduped_components.other_non_cash,
        other_one_time_expenses: ebitdaResult.deduped_components.other_one_time_expenses,
      };
    }

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
// Gate behind DEBUG_FINANCIALS to prevent sensitive data in production logs
// ─────────────────────────────────────────────────────────────────────────────

const DEBUG_FINANCIALS = process.env.DEBUG_FINANCIALS === 'true';

function logAdjustedEBITDA(
  ebitda: number,
  result: ReturnType<typeof calculateAdjustedEBITDA>,
  m: ExtractedMetrics
): void {
  if (!DEBUG_FINANCIALS) return;
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
  console.log(`   - Interest Income Excluded:  ${breakdown.interest_income_excluded}`);
  console.log(`     interest_income:            ${m.interest_income ?? 0}`);
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
  if (!DEBUG_FINANCIALS) return;
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
  if (!DEBUG_FINANCIALS) return;
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
  console.log(`     Funded Debt (Bank + Leases): ${breakdown.funded_debt}`);
  console.log(`     Funded Debt / EBITDA:      ${breakdown.funded_debt_to_ebitda}x\n`);
}

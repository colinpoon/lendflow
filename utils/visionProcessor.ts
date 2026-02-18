/**
 * Vision-based Financial Data Extraction Processor
 * Vision analog of utils/aiProcessor.ts
 *
 * This module bridges Phase 1's extractFromPdf() output (raw ExtractedMetrics keyed by year)
 * and the ExtractionResult shape that the API route expects (computed ratios + risk assessments).
 *
 * Pipeline:
 * 1. Validate Anthropic API key
 * 2. Run vision extraction (PDF → images → Claude Vision → ExtractedMetrics by year)
 * 3. Normalize fiscal year keys to 4-digit strings
 * 4. Compute derived metrics per year (EBITDA, FCCR, DSCR, ratios)
 * 5. Validate metrics
 * 6. Generate risk assessments
 * 7. Return ExtractionResult-compatible object
 */

import { validateApiKey, extractFromPdf } from '@/lib/vision';
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
import { calculateVisionCost } from '@/lib/benchmarks/cost';
import {
  generateRiskAssessment,
  generateDebtHealthAssessment,
} from '@/lib/risk-generator';
import {
  calculateQuantitativeRisk,
  type QuantitativeRiskAssessment,
} from '@/lib/quantitative-risk';
import type { ComputedMetrics, ExtractedMetrics, RiskData, DebtHealthAssessment } from '@/types';
import type { ExtractionResult } from './aiProcessor';

// Re-export type alias for callers who want the explicit vision type name
export type { ExtractionResult as VisionExtractionResult };

// ─────────────────────────────────────────────────────────────────────────────
// Fiscal Year Normalization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize a raw fiscal year key to a 4-digit year string.
 * Handles formats like "FY2023", "2023Q4", "December 31, 2023", "2023".
 *
 * @param raw - Raw fiscal year key from Claude
 * @returns 4-digit year string, or original key if no year found
 */
function normalizeFiscalYear(raw: string): string {
  const match = raw.match(/\b(20\d{2}|19\d{2})\b/);
  return match ? match[1] : raw;
}

// ─────────────────────────────────────────────────────────────────────────────
// Metric Computation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute all derived metrics for a single year.
 * Mirrors computeMetrics() in utils/aiProcessor.ts without debug logging.
 *
 * @param m - Extracted metrics for one year
 * @returns Computed metrics including ratios and breakdowns
 */
function computeVisionMetrics(m: ExtractedMetrics): ComputedMetrics {
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

  const ebitda = calculateEBITDA(m);
  if (ebitda != null) {
    if (m.ebitda == null) {
      result.ebitda = ebitda;
      result.ebitda_calculated = true;
    }

    // Adjusted EBITDA
    const ebitdaResult = calculateAdjustedEBITDA(ebitda, m);
    result.adjusted_ebitda = ebitdaResult.adjusted_ebitda;
    result.calculated_adjusted_ebitda = ebitdaResult.calculated_adjusted_ebitda;
    result.adjusted_ebitda_breakdown = ebitdaResult.adjusted_ebitda_breakdown;
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

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate computed metrics for common data quality issues.
 */
function validateVisionMetrics(
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
// Main Export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract financial data from a PDF buffer using Claude Vision.
 * Vision analog of extractFinancialData() from utils/aiProcessor.ts.
 *
 * Accepts a Buffer (not a file path) — the API route handles temp file to Buffer conversion.
 * Uses the Claude Vision pipeline from Phase 1 (lib/vision) to process each page sequentially.
 *
 * @param pdfBuffer - PDF file contents as a Node.js Buffer
 * @returns Extracted metrics, computed ratios, and risk assessments
 * @throws Error if API key is missing, no pages are processed, or PDF contains no financial data
 */
export const extractVisionData = async (pdfBuffer: Buffer): Promise<ExtractionResult> => {
  // ─────────────────────────────────────────────────────────────────────────
  // Step 1: Validate Anthropic API key
  // ─────────────────────────────────────────────────────────────────────────

  validateApiKey();

  // ─────────────────────────────────────────────────────────────────────────
  // Step 2: Run vision extraction
  // extractFromPdf handles page-by-page processing and year-based merging internally
  // ─────────────────────────────────────────────────────────────────────────

  const visionResult = await extractFromPdf(pdfBuffer);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 3: Guard empty result
  // ─────────────────────────────────────────────────────────────────────────

  if (
    visionResult.pagesProcessed === 0 ||
    Object.keys(visionResult.metricsByYear).length === 0
  ) {
    throw new Error(
      'Vision extraction returned no metrics. Document may not contain financial tables.'
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 4: Normalize fiscal year keys to 4-digit strings
  // Last-wins merge when two raw keys map to the same normalized year
  // ─────────────────────────────────────────────────────────────────────────

  const warnings: string[] = [];
  let unnormalizableCount = 0;

  const normalizedMetricsByYear: Record<string, ExtractedMetrics> = {};
  for (const [rawKey, metrics] of Object.entries(visionResult.metricsByYear)) {
    const normalizedKey = normalizeFiscalYear(rawKey);
    if (normalizedKey === rawKey && !/^\d{4}$/.test(rawKey)) {
      unnormalizableCount++;
    }
    // Last-wins: later entries overwrite earlier ones for same normalized key
    normalizedMetricsByYear[normalizedKey] = metrics;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 5 & 6: Compute derived metrics per year and build computed map
  // ─────────────────────────────────────────────────────────────────────────

  const computed: Record<string, ComputedMetrics> = {};
  for (const [year, metrics] of Object.entries(normalizedMetricsByYear)) {
    computed[year] = computeVisionMetrics(metrics);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 7: Validate metrics
  // ─────────────────────────────────────────────────────────────────────────

  const validationIssues = validateVisionMetrics(computed);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 8: Generate risk assessments
  // ─────────────────────────────────────────────────────────────────────────

  const riskAssessment = await generateRiskAssessment(computed);
  const debtHealthAssessment = await generateDebtHealthAssessment(computed);
  const quantitativeRiskAssessment = calculateQuantitativeRisk(computed);

  console.log(
    `Vision extraction complete: ${visionResult.pagesProcessed} pages, ${Object.keys(computed).length} fiscal years`
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Step 9: Build extraction warnings
  // ─────────────────────────────────────────────────────────────────────────

  warnings.push(`Vision extraction processed ${visionResult.pagesProcessed} pages`);

  if (unnormalizableCount > 0) {
    warnings.push(
      `${unnormalizableCount} fiscal year key${unnormalizableCount === 1 ? '' : 's'} could not be normalized to a 4-digit year`
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 10: Calculate token usage and cost for COST-01
  // ─────────────────────────────────────────────────────────────────────────

  const tokenUsage = {
    input_tokens: visionResult.totalUsage.inputTokens,
    output_tokens: visionResult.totalUsage.outputTokens,
    model: 'claude-sonnet-4-20250514',
  };
  const costBreakdown = calculateVisionCost(tokenUsage);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 11: Return ExtractionResult
  // Shape matches ExtractionResult from utils/aiProcessor.ts
  // Note: chunk_stats and merge_conflicts are not applicable to vision pipeline
  // ─────────────────────────────────────────────────────────────────────────

  return {
    metrics_by_year: computed,
    riskAssessment,
    debtHealthAssessment,
    quantitativeRiskAssessment,
    ...(Object.keys(validationIssues).length > 0 && { validation_issues: validationIssues }),
    extraction_warnings: warnings,
    token_usage: {
      ...tokenUsage,
      cost_usd: costBreakdown.total_cost,
    },
  };
};

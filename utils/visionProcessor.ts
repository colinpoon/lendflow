/**
 * Vision-based Financial Data Extraction Processor
 * Vision analog of utils/aiProcessor.ts
 *
 * Pipeline:
 * 1.  Validate Anthropic API key
 * 2.  Run vision extraction (PDF → images → Claude Vision → ExtractedMetrics by year)
 *     The extraction layer now handles:
 *       a. Multi-year pages (one API call captures all fiscal year columns)
 *       b. Conflict-aware weighted merge across pages
 *       c. Scale normalization (~1000× outlier correction)
 * 3.  Guard against empty results
 * 4.  Compute derived metrics per year (EBITDA, FCCR, DSCR, ratios)
 * 5.  Validate metrics
 * 6.  Generate risk assessments
 * 7.  Build extraction warnings (surfacing merge conflicts and scale notes)
 * 8.  Calculate token usage / cost
 * 9.  Return ExtractionResult-compatible object
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
import type { MergeConflict } from '@/lib/vision/vision-extractor';

// Re-export type alias for callers who want the explicit vision type name
export type { ExtractionResult as VisionExtractionResult };

// ─────────────────────────────────────────────────────────────────────────────
// Post-Extraction Corrections
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Correct common vision extraction errors before metric computation.
 * Modifies the metrics in-place and returns a list of corrections made.
 *
 * Key principle: We CALCULATE EBITDA and Adjusted EBITDA from components,
 * so we always clear any extracted values and let the calculation layer handle them.
 */
function correctExtractionErrors(
  metricsByYear: Record<string, ExtractedMetrics>
): string[] {
  const corrections: string[] = [];

  for (const [year, metrics] of Object.entries(metricsByYear)) {
    // Fix 1: Always clear reported_adjusted_ebitda - we calculate it from components
    // This ensures consistency and avoids conflation errors
    if (metrics.reported_adjusted_ebitda != null) {
      corrections.push(
        `${year}: Cleared reported_adjusted_ebitda (${metrics.reported_adjusted_ebitda}) — will be calculated from components`
      );
      metrics.reported_adjusted_ebitda = null;
    }

    // Fix 2: If senior_debt > total_debt, they were likely swapped or conflated
    if (
      metrics.senior_debt != null &&
      metrics.total_debt != null &&
      metrics.senior_debt > metrics.total_debt
    ) {
      corrections.push(
        `${year}: Swapped senior_debt and total_debt — senior (${metrics.senior_debt}) exceeded total (${metrics.total_debt})`
      );
      const temp = metrics.senior_debt;
      metrics.senior_debt = metrics.total_debt;
      metrics.total_debt = temp;
    }
  }

  return corrections;
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
  // Shallow copy to avoid mutating the input object
  const result = { ...m } as ComputedMetrics;

  // ── Debt ──────────────────────────────────────────────────────────────────
  const debtResult = calculateDebtMetrics(m);
  result.senior_debt = debtResult.senior_debt;
  result.total_debt = debtResult.total_debt;
  result.debt_breakdown = debtResult.debt_breakdown;

  // ── EBITDA ────────────────────────────────────────────────────────────────
  const ebitda = calculateEBITDA(m);
  if (ebitda != null) {
    if (m.ebitda == null) {
      result.ebitda = ebitda;
      result.ebitda_calculated = true;
    }

    const ebitdaResult = calculateAdjustedEBITDA(ebitda, m);
    result.adjusted_ebitda = ebitdaResult.adjusted_ebitda;
    result.calculated_adjusted_ebitda = ebitdaResult.calculated_adjusted_ebitda;
    result.adjusted_ebitda_breakdown = ebitdaResult.adjusted_ebitda_breakdown;
  } else {
    result.adjusted_ebitda = m.reported_adjusted_ebitda ?? null;
    result.calculated_adjusted_ebitda = null;
    result.adjusted_ebitda_breakdown = null;
  }

  // ── FCCR ──────────────────────────────────────────────────────────────────
  const fccrResult = calculateFCCR(result.adjusted_ebitda ?? result.ebitda, m);
  result.fccr = fccrResult.fccr;
  result.fccr_numerator = fccrResult.fccr_numerator;
  result.total_fixed_charges = fccrResult.total_fixed_charges;
  result.cash_flow_for_debt_servicing = fccrResult.cash_flow_for_debt_servicing;
  result.fccr_breakdown = fccrResult.fccr_breakdown;

  // ── Ratios ────────────────────────────────────────────────────────────────
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

  // ── DSCR (Banker's Covenant Method) ───────────────────────────────────────
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
 * Returns a map of year → list of problem descriptions.
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
      problems.push('Debt-to-equity ratio is not finite');
    }
    if (data.interest_coverage_ratio != null && !isFinite(data.interest_coverage_ratio)) {
      problems.push('Interest coverage ratio is not finite');
    }
    if (
      data.total_debt != null &&
      data.senior_debt != null &&
      data.senior_debt > data.total_debt
    ) {
      problems.push(
        `Senior debt (${data.senior_debt}) exceeds total debt (${data.total_debt}) — likely a conflation error`
      );
    }
    // Note: We no longer check for EBITDA = Adjusted EBITDA conflation here
    // because correctExtractionErrors() always clears reported_adjusted_ebitda
    // (we calculate it from components instead of extracting it)

    if (problems.length > 0) {
      issues[year] = problems;
    }
  }

  return issues;
}

// ─────────────────────────────────────────────────────────────────────────────
// Warning Builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build human-readable extraction warnings from merge conflicts and scale notes.
 */
function buildExtractionWarnings(
  pagesProcessed: number,
  scaleNotes: Array<{ pageNumber: number; note: string }>,
  mergeConflicts: MergeConflict[],
  unnormalizableCount: number
): string[] {
  const warnings: string[] = [];

  warnings.push(`Vision extraction processed ${pagesProcessed} pages`);

  if (scaleNotes.length > 0) {
    const uniqueNotes = [...new Set(scaleNotes.map((s) => s.note))];
    warnings.push(`Scale inference: ${uniqueNotes.join(' | ')}`);
  }

  if (unnormalizableCount > 0) {
    warnings.push(
      `${unnormalizableCount} fiscal year key${unnormalizableCount === 1 ? '' : 's'} could not be normalized to a 4-digit year`
    );
  }

  // Surface high-variance conflicts as warnings (low-variance ones are routine)
  const highVarianceConflicts = mergeConflicts.filter((c) => c.variancePercent > 50);
  if (highVarianceConflicts.length > 0) {
    warnings.push(
      `${highVarianceConflicts.length} high-variance merge conflict${highVarianceConflicts.length === 1 ? '' : 's'} detected — ` +
        highVarianceConflicts
          .map((c) => `${c.year}/${c.metric} (${c.variancePercent.toFixed(0)}% variance, resolved via ${c.resolution})`)
          .join(', ')
    );
  }

  return warnings;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Export
// ─────────────────────────────────────────────────────────────────────────────

const VISION_MODEL_ID = 'claude-sonnet-4-20250514';

/**
 * Extract financial data from a PDF buffer using Claude Vision.
 * Vision analog of extractFinancialData() from utils/aiProcessor.ts.
 *
 * Accepts a Buffer — the API route handles temp-file → Buffer conversion.
 *
 * @param pdfBuffer - PDF file contents as a Node.js Buffer
 * @returns Extracted metrics, computed ratios, and risk assessments
 * @throws Error if API key is missing, no pages are processed, or no financial data is found
 */
export const extractVisionData = async (pdfBuffer: Buffer): Promise<ExtractionResult> => {
  // ── Step 1: Validate API key ───────────────────────────────────────────────
  validateApiKey();

  // ── Step 2: Run vision extraction ─────────────────────────────────────────
  // The extraction layer now handles multi-year pages, conflict-aware merging,
  // and scale normalization internally. No additional merge step needed here.
  const visionResult = await extractFromPdf(pdfBuffer);

  // ── Step 3: Guard against empty results ───────────────────────────────────
  if (
    visionResult.pagesProcessed === 0 ||
    Object.keys(visionResult.metricsByYear).length === 0
  ) {
    throw new Error(
      'Vision extraction returned no metrics. Document may not contain financial tables.'
    );
  }

  // ── Step 4: Count unnormalizable year keys (for warnings) ─────────────────
  // The extraction layer already normalizes years internally. We count how many
  // raw keys from page results could not be mapped to a 4-digit year.
  let unnormalizableCount = 0;
  for (const key of Object.keys(visionResult.metricsByYear)) {
    if (!/^\d{4}$/.test(key)) {
      unnormalizableCount++;
    }
  }

  // ── Step 4b: Apply post-extraction corrections ────────────────────────────
  // Fix common vision errors like Adjusted EBITDA = EBITDA conflation
  const extractionCorrections = correctExtractionErrors(visionResult.metricsByYear);
  if (extractionCorrections.length > 0) {
    console.log(`🔧 Applied ${extractionCorrections.length} extraction correction(s):`);
    extractionCorrections.forEach((c) => console.log(`   - ${c}`));
  }

  // ── Step 5: Compute derived metrics per year ───────────────────────────────
  const computed: Record<string, ComputedMetrics> = {};
  for (const [year, metrics] of Object.entries(visionResult.metricsByYear)) {
    computed[year] = computeVisionMetrics(metrics);
  }

  // ── Step 6: Validate metrics ───────────────────────────────────────────────
  const validationIssues = validateVisionMetrics(computed);

  // ── Step 7: Generate risk assessments ─────────────────────────────────────
  const riskAssessment = await generateRiskAssessment(computed);
  const debtHealthAssessment = await generateDebtHealthAssessment(computed);
  const quantitativeRiskAssessment = calculateQuantitativeRisk(computed);

  console.log(
    `Vision extraction complete: ${visionResult.pagesProcessed} pages, ` +
      `${Object.keys(computed).length} fiscal years, ` +
      `${visionResult.mergeConflicts.length} merge conflicts`
  );

  // ── Step 8: Build warnings ────────────────────────────────────────────────
  const extractionWarnings = buildExtractionWarnings(
    visionResult.pagesProcessed,
    visionResult.scaleNotes,
    visionResult.mergeConflicts,
    unnormalizableCount
  );

  // Add extraction corrections to warnings
  if (extractionCorrections.length > 0) {
    extractionWarnings.push(
      `Applied ${extractionCorrections.length} auto-correction(s): ${extractionCorrections.join('; ')}`
    );
  }

  // ── Step 9: Calculate token usage and cost ────────────────────────────────
  const tokenUsage = {
    input_tokens: visionResult.totalUsage.inputTokens,
    output_tokens: visionResult.totalUsage.outputTokens,
    model: VISION_MODEL_ID,
  };
  const costBreakdown = calculateVisionCost(tokenUsage);

  // ── Step 10: Return ExtractionResult ──────────────────────────────────────
  return {
    metrics_by_year: computed,
    riskAssessment,
    debtHealthAssessment,
    quantitativeRiskAssessment,
    ...(Object.keys(validationIssues).length > 0 && { validation_issues: validationIssues }),
    extraction_warnings: extractionWarnings,
    token_usage: {
      ...tokenUsage,
      cost_usd: costBreakdown.total_cost,
    },
  };
};

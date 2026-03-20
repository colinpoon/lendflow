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
import { MERGE_CONFIG, CANONICAL_STATEMENT_MAP } from '@/lib/constants';
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
  calculateProfitMargin,
} from '@/lib/calculations';
import {
  calculateQuantitativeRisk,
  type QuantitativeRiskAssessment,
} from '@/lib/quantitative-risk';
import { AI_CONFIG } from '@/lib/constants';
import type { ComputedMetrics, ExtractedMetrics, RiskData, DebtHealthAssessment } from '@/types';

// Gate financial data logs behind DEBUG_FINANCIALS to prevent sensitive data in production logs
const DEBUG_FINANCIALS = process.env.DEBUG_FINANCIALS === 'true';
// Separate flag for Financial Summary table output with source provenance
const DEBUG_FINANCE = process.env.DEBUG_FINANCE === 'true';

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
    /** Chunks never attempted because the pipeline aborted early (fatal error) */
    skipped: number;
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
  onProgress?: ProgressCallback,
  userId?: string
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

    // Check for fatal API errors (billing, auth) that aborted the pipeline
    const fatalError = chunkResults.find((r) => r.fatalError)?.fatalError;
    if (fatalError) {
      throw new Error(`API ${fatalError.type} error: ${fatalError.message}`);
    }

    // Calculate chunk stats — distinguish actual failures from skipped (pipeline aborted)
    const successfulChunks = chunkResults.filter((r) => r.result !== null);
    const skippedChunkCount = chunkResults.filter((r) => r.skipped).length;
    const failedChunkCount = chunkResults.length - successfulChunks.length - skippedChunkCount;
    const chunksWithWarnings = chunkResults.filter(
      (r) => r.validationWarnings && r.validationWarnings.length > 0
    );
    const chunkStats = {
      total: chunkResults.length,
      successful: successfulChunks.length,
      failed: failedChunkCount,
      skipped: skippedChunkCount,
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
    // Multiple chunks may each report different values — chunk 1 might see only notes
    // pages with a comparative year header. Use the most commonly reported value;
    // break ties by taking the latest (most recent) year.
    const primary_fiscal_year: string | null = (() => {
      const counts = new Map<string, number>();
      for (const e of allExtractions) {
        if (e.primary_fiscal_year) {
          counts.set(e.primary_fiscal_year, (counts.get(e.primary_fiscal_year) ?? 0) + 1);
        }
      }
      if (counts.size === 0) return null;
      const maxCount = Math.max(...counts.values());
      const candidates = [...counts.entries()].filter(([, c]) => c === maxCount).map(([y]) => y);
      // Break ties by choosing the latest year
      return candidates.sort().pop()!;
    })();

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

    if (extraction_metadata && DEBUG_FINANCIALS) {
      console.log(
        `Scale detected: ${extraction_metadata.detected_scale}` +
        ` (confidence: ${extraction_metadata.scale_confidence},` +
        ` indicator: "${extraction_metadata.scale_indicator_found ?? 'none'}")`
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 3.5: Normalize fiscal year keys BEFORE merge
    // Two chunks producing "FY2023" and "2023" for the same year would be
    // treated as separate years during merge, then one silently dropped by
    // post-merge normalization. Normalize on each individual extraction first
    // so the merge sees consistent keys.
    // ─────────────────────────────────────────────────────────────────────────
    for (const extraction of allExtractions) {
      if (extraction.metrics_by_year) {
        extraction.metrics_by_year = normalizeFiscalYearKeys(
          extraction.metrics_by_year,
          extractionWarnings
        );
      }
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

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 4 post-merge: Fiscal Year Key Normalization (safety net)
    // Primary normalization happens pre-merge (Phase 3.5 above). This second
    // pass catches any keys that the merge itself might produce or any edge
    // cases missed in individual chunk normalization.
    // ─────────────────────────────────────────────────────────────────────────
    rawMerged = normalizeFiscalYearKeys(rawMerged, extractionWarnings);

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
    // Phase 4 post-merge: Canonical Source Validation
    // Check if resolved metrics came from their canonical statement.
    // Non-canonical wins are informational warnings to track accuracy.
    // ─────────────────────────────────────────────────────────────────────────

    for (const conflict of mergeResult.conflicts) {
      if (conflict.resolution === 'canonical_statement') continue; // already canonical
      const canonicalStatement = CANONICAL_STATEMENT_MAP[conflict.metric];
      if (!canonicalStatement) continue;

      // Check if the winning candidate came from a non-canonical source
      const winner = conflict.candidates.find((c) => c.value === conflict.resolvedValue);
      if (winner && winner.sourceStatement !== 'unknown' && winner.sourceStatement !== canonicalStatement) {
        extractionWarnings.push(
          `${conflict.year}/${conflict.metric}: resolved from ${winner.sourceStatement} (canonical: ${canonicalStatement})`
        );
      }
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

    // Pass the set of years already scaled in Pass 1 so Passes 2 and 3 skip
    // them — preventing double-correction (e.g., millions→thousands then ÷1000).
    // Also pass extraction_metadata so low-confidence AI scale hints that were
    // skipped by applyDetectedScale can still surface as analyst warnings.
    const pass1CorrectedYears = detectedScaleResult.correctedYears;
    const crossMetricResult = validateCrossMetricScale(rawMerged, pass1CorrectedYears, extraction_metadata);

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 4d: Cross-Year Scale Normalization
    // Detect and fix when AI returns raw dollars vs thousands inconsistently
    // between years (e.g., 2023 in thousands, 2024 in raw dollars)
    // ─────────────────────────────────────────────────────────────────────────

    // Combine corrected years from both prior passes so cross-year check
    // treats them as the reference scale rather than outliers.
    const allPriorCorrectedYears = new Set<string>([
      ...(pass1CorrectedYears ?? []),
      ...(crossMetricResult.correctedYears ?? []),
    ]);
    const crossYearResult = normalizeScaleMismatch(crossMetricResult.metrics, allPriorCorrectedYears);
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
      const { metrics: yearMetrics, warnings: yearWarnings } = computeMetrics(
        merged[yr] as unknown as ExtractedMetrics,
        yr
      );
      computed[yr] = yearMetrics;
      // Surface debt service warnings (e.g. gross revolving credit distortion) to the UI
      for (const w of yearWarnings) {
        extractionWarnings.push(w);
      }
    }

    // ── DEBUG_FINANCE: Financial Summary with source provenance ─────────────
    if (DEBUG_FINANCE) {
      const wMap = mergeResult.winnersMap;
      const sortedYears = Object.keys(computed).sort();

      // Helper: get the winning candidate's source info for a metric
      const src = (year: string, metric: string): string => {
        const winner = wMap.get(`${year}:${metric}`);
        if (!winner) return '';
        const stmt = winner.sourceStatement !== 'unknown' ? winner.sourceStatement : '';
        const desc = winner.sourceDescription || '';
        // Format: [statement | description | chunk N]
        const parts: string[] = [];
        if (stmt) parts.push(stmt.replace(/_/g, ' '));
        if (desc && desc !== stmt) parts.push(desc);
        parts.push(`chunk ${winner.chunkIndex}`);
        return `  ← [${parts.join(' | ')}]`;
      };

      const fmt = (v: unknown) => v != null ? Number(v).toLocaleString() : '—';

      console.log('\n╔══════════════════════════════════════════════════════════════════════════════════════╗');
      console.log('║                  DEBUG_FINANCE — Financial Summary with Sources                     ║');
      console.log('╚══════════════════════════════════════════════════════════════════════════════════════╝');
      console.log(`Years found: ${sortedYears.join(', ') || '(none)'}\n`);

      for (const year of sortedYears) {
        const m = computed[year] as unknown as Record<string, unknown>;
        const adj = (m?.adjusted_ebitda_components ?? {}) as Record<string, unknown>;
        const fc = (m?.fixed_charges ?? {}) as Record<string, unknown>;

        console.log(`┌─── ${year} ${'─'.repeat(75)}`);

        // Income Statement
        console.log('│ INCOME STATEMENT');
        console.log(`│   Revenue:                    ${fmt(m.revenue).padEnd(16)}${src(year, 'revenue')}`);
        console.log(`│   Total Operating Expenses:   ${fmt(m.expenses).padEnd(16)}${src(year, 'expenses')}`);
        console.log(`│   Net Income:                 ${fmt(m.net_income).padEnd(16)}${src(year, 'net_income')}`);
        console.log(`│   Net Profit Margin:          ${(m.profit_margins != null ? m.profit_margins + '%' : '—').toString().padEnd(16)}${src(year, 'profit_margins')}`);

        // EBITDA Bridge
        console.log('│ EBITDA BRIDGE');
        console.log(`│   + Interest Expense:         ${fmt(m.interest).padEnd(16)}${src(year, 'interest')}`);
        console.log(`│   + Taxes:                    ${fmt(m.taxes).padEnd(16)}${src(year, 'taxes')}`);
        console.log(`│   + D&A:                      ${fmt(m.depreciation_amortization).padEnd(16)}${src(year, 'depreciation_amortization')}`);
        console.log(`│   = EBITDA:                   ${fmt(m.ebitda).padEnd(16)}${src(year, 'ebitda')}`);

        // Adjusted EBITDA (only non-zero items)
        const adjKeys: [string, string][] = [
          ['stock_based_compensation',    '+ Stock-Based Comp'],
          ['impairment_charges',          '+ Impairment'],
          ['goodwill_impairment',         '+ Goodwill Impairment'],
          ['unrealized_gains_losses',     '+ Unrealized G/L'],
          ['deferred_compensation',       '+ Deferred Comp'],
          ['loss_on_disposal',            '+ Loss on Disposal'],
          ['other_non_cash',              '+ Other Non-Cash'],
          ['restructuring_costs',         '+ Restructuring'],
          ['severance_costs',             '+ Severance'],
          ['transaction_costs',           '+ Transaction Costs'],
          ['legal_settlements',           '+ Legal Settlements'],
          ['other_one_time_expenses',     '+ Other One-Time Exp'],
          ['casualty_losses',             '+ Casualty Losses'],
          ['gain_on_disposal',            '− Gain on Disposal'],
          ['gain_on_asset_sale',          '− Gain on Asset Sale'],
          ['other_income_non_operating',  '− Other Non-Op Income'],
          ['insurance_proceeds',          '− Insurance Proceeds'],
          ['other_one_time_gains',        '− Other One-Time Gains'],
          ['owner_compensation_adjustment','± Owner Comp Adj'],
          ['related_party_adjustments',   '± Related Party Adj'],
          ['management_fees_adjustment',  '± Mgmt Fees Adj'],
          ['unrealized_fx_cash_flow',     '+ Unrealized FX'],
          ['realized_fx_pl',              '  Realized FX P&L'],
        ];
        const nonZeroAdj = adjKeys.filter(([k]) => adj[k] != null && adj[k] !== 0);
        if (nonZeroAdj.length > 0) {
          console.log('│ ADJUSTED EBITDA BRIDGE');
          for (const [, label] of nonZeroAdj) {
            console.log(`│   ${label.padEnd(28)} ${fmt(adj[label])}`);
          }
        }
        console.log(`│   = Adjusted EBITDA:          ${fmt(m.adjusted_ebitda).padEnd(16)}${src(year, 'adjusted_ebitda')}`);

        // CFADS
        console.log('│ CFADS');
        console.log(`│   − Capital Expenditures:     ${fmt(m.capital_expenditures).padEnd(16)}${src(year, 'capital_expenditures')}`);
        console.log(`│   − Cash Taxes Paid:          ${fmt(m.cash_taxes_paid).padEnd(16)}${src(year, 'cash_taxes_paid')}`);
        console.log(`│   = CFADS:                    ${fmt(m.cash_flow_for_debt_servicing)}`);

        // Debt Service / Fixed Charges
        console.log('│ DEBT SERVICE (FIXED CHARGES)');
        console.log(`│   Principal Payments (TTM):   ${fmt(m.ttm_principal_payments).padEnd(16)}${src(year, 'ttm_principal_payments')}`);
        console.log(`│   Interest Expense (TTM):     ${fmt(m.ttm_interest_expense).padEnd(16)}${src(year, 'ttm_interest_expense')}`);
        console.log(`│   Lease Payments:             ${fmt(m.payment_of_lease_liability).padEnd(16)}${src(year, 'payment_of_lease_liability')}`);
        const fcKeys: [string, string][] = [
          ['senior_debt_interest',        'Senior Debt Interest'],
          ['subordinated_debt_interest',  'Sub Debt Interest'],
          ['principal_payments',          'Principal Payments'],
          ['preferred_dividends',         'Preferred Dividends'],
          ['other_fixed_charges',         'Other Fixed Charges'],
        ];
        const nonZeroFc = fcKeys.filter(([k]) => fc[k] != null && fc[k] !== 0);
        for (const [k, label] of nonZeroFc) {
          console.log(`│   ${label.padEnd(28)} ${fmt(fc[k])}`);
        }

        // Capital Structure
        console.log('│ CAPITAL STRUCTURE');
        console.log(`│   Total Debt:                 ${fmt(m.total_debt).padEnd(16)}${src(year, 'total_debt')}`);
        console.log(`│   Senior Debt:                ${fmt(m.senior_debt).padEnd(16)}${src(year, 'senior_debt')}`);
        console.log(`│   Shareholders' Equity:       ${fmt(m.shareholders_equity).padEnd(16)}${src(year, 'shareholders_equity')}`);
        console.log(`│   Debt Service Payments:      ${fmt(m.debt_service_payments).padEnd(16)}${src(year, 'debt_service_payments')}`);

        // Key Ratios
        console.log('│ KEY RATIOS');
        console.log(`│   DSCR:                       ${m.dscr != null ? m.dscr + 'x' : '—'}`);
        console.log(`│   Senior Debt/EBITDA:          ${m.senior_debt_to_ebitda != null ? m.senior_debt_to_ebitda + 'x' : '—'}`);
        console.log(`│   Total Debt/Total Capital:    ${m.total_debt_to_capital != null ? (Number(m.total_debt_to_capital) * 100).toFixed(1) + '%' : '—'}`);
        console.log(`│   FCCR:                       ${m.fccr != null ? m.fccr + 'x' : '—'}`);

        console.log(`└${'─'.repeat(80)}\n`);
      }
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

    // Each risk generator runs in its own try/catch so a failure in one does not
    // abort the entire extraction. Partial results (e.g. riskSnapshot without
    // debtHealthAssessment) are still returned to the caller.
    let riskSnapshot: Awaited<ReturnType<typeof generateRiskAssessment>> = null;
    let riskError: string | null = null;
    try {
      riskSnapshot = await generateRiskAssessment(computed, userId);
    } catch (riskErr) {
      console.warn('⚠️ generateRiskAssessment failed — returning null:', riskErr);
      riskError = riskErr instanceof Error ? riskErr.message : String(riskErr);
    }

    let debtHealthAssessment: Awaited<ReturnType<typeof generateDebtHealthAssessment>> = null;
    try {
      debtHealthAssessment = await generateDebtHealthAssessment(computed);
    } catch (debtHealthErr) {
      console.warn('⚠️ generateDebtHealthAssessment failed — returning null:', debtHealthErr);
      if (!riskError) {
        riskError = debtHealthErr instanceof Error ? debtHealthErr.message : String(debtHealthErr);
      }
    }

    console.log(`📊 Computing quantitative risk for ${Object.keys(computed).length} years:`, Object.keys(computed));
    let quantitativeRiskAssessment: ReturnType<typeof calculateQuantitativeRisk> = null;
    try {
      quantitativeRiskAssessment = calculateQuantitativeRisk(computed);
    } catch (quantErr) {
      console.warn('⚠️ calculateQuantitativeRisk failed — returning null:', quantErr);
    }
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

    // Surface risk assessment failures as analyst-visible warnings
    if (!riskSnapshot && riskError) {
      const isBillingError = riskError.includes('credit') || riskError.includes('billing');
      const isAuthError = riskError.includes('authentication') || riskError.includes('api key') || riskError.includes('invalid x-api-key');
      if (isBillingError) {
        extractionWarnings.push(
          'Risk assessment unavailable — API credit balance issue. Financial metrics were extracted successfully, but the AI risk assessment could not be generated. Add credits at console.anthropic.com and re-run.'
        );
      } else if (isAuthError) {
        extractionWarnings.push(
          'Risk assessment unavailable — API authentication error. Check your ANTHROPIC_API_KEY configuration.'
        );
      } else {
        extractionWarnings.push(
          'Risk assessment could not be generated. Financial metrics were extracted successfully but the AI risk analysis is unavailable. Try re-running the extraction.'
        );
      }
    }

    // Cap warnings to prevent UI/storage overload — summarize overflow entries
    const MAX_WARNINGS = 50;
    if (extractionWarnings.length > MAX_WARNINGS) {
      const overflow = extractionWarnings.length - MAX_WARNINGS;
      extractionWarnings.splice(MAX_WARNINGS);
      extractionWarnings.push(`...and ${overflow} more warning${overflow === 1 ? '' : 's'} (set DEBUG_FINANCIALS=true for full list)`);
    }

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
// Fiscal Year Key Normalization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate and normalize the year keys of the merged metrics object.
 *
 * Accepted canonical form: 4-digit year string, 1900–2099 (e.g. "2023").
 * Common AI variants are normalized:
 *   - "FY2023", "fy2023"            → "2023"
 *   - "2023E", "2023A", "2023F"     → "2023" (estimated/actual/forecast suffixes)
 *   - "2022/23", "2022-23"          → "2023" (fiscal overlap — use later year)
 *   - "2023/2024", "2023-2024"      → "2024" (full overlap — use later year)
 *
 * Keys that cannot be resolved to a valid 4-digit year are dropped and a
 * warning is pushed. Duplicate keys (two variants resolving to the same year)
 * retain the higher-confidence original; the duplicate is dropped with a warning.
 *
 * @param metrics  - Raw merged metrics keyed by AI-provided year strings
 * @param warnings - Mutable warnings array; entries are appended in place
 * @returns        - Metrics re-keyed with canonical 4-digit year strings
 */
function normalizeFiscalYearKeys<T>(
  metrics: Record<string, T>,
  warnings: string[]
): Record<string, T> {
  const VALID_YEAR_RE = /^\d{4}$/;
  const VALID_YEAR_RANGE = { min: 1900, max: 2099 };

  function tryNormalize(raw: string): string | null {
    const trimmed = raw.trim();

    // Already canonical
    if (VALID_YEAR_RE.test(trimmed)) {
      const yr = parseInt(trimmed, 10);
      return yr >= VALID_YEAR_RANGE.min && yr <= VALID_YEAR_RANGE.max ? trimmed : null;
    }

    // "FY2023", "fy23" (2-digit → unsupported, skip), "FY 2023"
    const fyMatch = trimmed.match(/^[Ff][Yy]\s*(\d{4})$/);
    if (fyMatch) return fyMatch[1];

    // "2023E", "2023A", "2023F", "2023P" (suffix indicators)
    const suffixMatch = trimmed.match(/^(\d{4})[EeAaFfPp]$/);
    if (suffixMatch) return suffixMatch[1];

    // "2022/23" or "2022-23" — short overlap, use later year (20XX)
    const shortOverlapMatch = trimmed.match(/^(\d{4})[\/\-](\d{2})$/);
    if (shortOverlapMatch) {
      const century = shortOverlapMatch[1].slice(0, 2);
      return `${century}${shortOverlapMatch[2]}`;
    }

    // "2023/2024" or "2023-2024" — full overlap, use later year
    const fullOverlapMatch = trimmed.match(/^(\d{4})[\/\-](\d{4})$/);
    if (fullOverlapMatch) return fullOverlapMatch[2];

    return null;
  }

  const normalized: Record<string, T> = {};
  for (const [key, value] of Object.entries(metrics) as [string, T][]) {
    const canonical = tryNormalize(key);
    if (canonical === null) {
      warnings.push(
        `Fiscal year key "${key}" is not a recognizable year format and was dropped — ` +
        `expected 4-digit year (1900–2099); check document header or AI extraction`
      );
      console.warn(`⚠️ Dropped unrecognizable fiscal year key: "${key}"`);
      continue;
    }

    const yr = parseInt(canonical, 10);
    if (yr < VALID_YEAR_RANGE.min || yr > VALID_YEAR_RANGE.max) {
      warnings.push(
        `Fiscal year "${canonical}" (from "${key}") is outside the valid range ` +
        `${VALID_YEAR_RANGE.min}–${VALID_YEAR_RANGE.max} and was dropped`
      );
      continue;
    }

    if (canonical !== key) {
      console.log(`📅 Normalized fiscal year key: "${key}" → "${canonical}"`);
    }

    if (Object.prototype.hasOwnProperty.call(normalized, canonical)) {
      warnings.push(
        `Duplicate fiscal year "${canonical}" after normalization (from "${key}") — ` +
        `keeping earlier entry; duplicate dropped`
      );
      continue;
    }

    normalized[canonical] = value;
  }

  return normalized;
}

// ─────────────────────────────────────────────────────────────────────────────
// Metric Computation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute all derived metrics for a single year
 * @param m - Extracted metrics for one year
 * @returns Computed metrics including ratios and breakdowns, plus analyst-facing warnings
 */
function computeMetrics(m: ExtractedMetrics, year?: string): { metrics: ComputedMetrics; warnings: string[] } {
  // Deep clone to prevent nested objects (debt_components, fixed_charges,
  // adjusted_ebitda_components, etc.) from sharing references with the caller's
  // copy of `m`. A shallow spread would let mutations on `result` silently mutate
  // `m`, causing hard-to-diagnose cross-year contamination.
  // structuredClone is available in Node 17+ and all modern browsers.
  const result = structuredClone(m) as ComputedMetrics;
  let negativeCapitalWarning: string | null = null;

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
    console.log(`   ebitda:                    N/A (always calculated from components)`);
  }

  const ebitdaCalc = calculateEBITDA(m);
  if (ebitdaCalc != null) {
    const ebitda = ebitdaCalc.value;
    const { usedGrossFallback } = ebitdaCalc;

    result.ebitda = ebitda;
    result.ebitda_calculated = true;
    if (DEBUG_FINANCIALS) {
      console.log(`   CALCULATED EBITDA:         ${ebitda} = ${m.net_income} + ${m.interest ?? 0} + ${m.taxes ?? 0} + ${m.depreciation_amortization}`);
      if (usedGrossFallback) {
        console.log(`   ⚠️ INTEREST SOURCE:        Gross fallback (P&L interest was negative/null)`);
      }
    }

    // Adjusted EBITDA — pass usedGrossFallback to gate interest income exclusion
    const ebitdaResult = calculateAdjustedEBITDA(ebitda, m, usedGrossFallback, ebitdaCalc.resolvedComponents);
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
    result.adjusted_ebitda = null;
    result.calculated_adjusted_ebitda = null;
    result.adjusted_ebitda_breakdown = null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FCCR Calculation
  // ─────────────────────────────────────────────────────────────────────────

  // Pass `result` (not `m`) so FCCR sees updated debt/EBITDA values from earlier
  // computation phases — consistent with how DSCR receives `result` below.
  const fccrResult = calculateFCCR(result.adjusted_ebitda ?? result.ebitda, result, undefined, year);
  result.fccr = fccrResult.fccr;
  result.fccr_numerator = fccrResult.fccr_numerator;
  result.total_fixed_charges = fccrResult.total_fixed_charges;
  result.cash_flow_for_debt_servicing = fccrResult.cash_flow_for_debt_servicing;
  result.fccr_breakdown = fccrResult.fccr_breakdown;

  // Debug logging
  logFCCR(result.adjusted_ebitda ?? result.ebitda, result, fccrResult);

  // ─────────────────────────────────────────────────────────────────────────
  // Ratio Calculations
  // ─────────────────────────────────────────────────────────────────────────

  result.total_debt_to_capital = calculateTotalDebtToCapital(
    result.total_debt,
    result.shareholders_equity
  );

  // Flag negative total capital (negative equity exceeds debt) — ratio is mathematically
  // valid but threshold comparisons become misleading for distressed borrowers.
  if (result.total_debt != null && result.shareholders_equity != null) {
    const totalCapital = result.total_debt + result.shareholders_equity;
    if (totalCapital <= 0) {
      negativeCapitalWarning = `Negative total capital (${totalCapital.toLocaleString()}K): shareholders' equity (${result.shareholders_equity.toLocaleString()}K) is negative. Debt/Capital ratio may be misleading — treat as maximum leverage risk.`;
    }
  }

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

  result.profit_margins = calculateProfitMargin(
    result.net_income,
    result.revenue
  );

  // ─────────────────────────────────────────────────────────────────────────
  // EBITDA Coverage Ratio (Adj. EBITDA / Total Debt Service)
  // ─────────────────────────────────────────────────────────────────────────

  const dscrResult = calculateDSCR(result.adjusted_ebitda ?? result.ebitda, result, year);
  result.dscr = dscrResult.dscr;
  result.funded_debt = dscrResult.funded_debt;
  result.funded_debt_to_ebitda = dscrResult.funded_debt_to_ebitda;
  result.dscr_breakdown = dscrResult.dscr_breakdown;

  // Debug logging
  logDSCR(result.adjusted_ebitda ?? result.ebitda, result, dscrResult);

  // Collect analyst-facing warnings from debt service resolution.
  // Both FCCR and EBITDA Coverage call resolveDebtService independently — deduplicate by text
  // since the same revolver warning can fire from both paths.
  const calculationWarnings: string[] = [];
  const seenWarnings = new Set<string>();
  const allWarnings = [...fccrResult.warnings, ...dscrResult.warnings];
  if (negativeCapitalWarning) allWarnings.push(negativeCapitalWarning);
  for (const w of allWarnings) {
    if (!seenWarnings.has(w)) {
      seenWarnings.add(w);
      calculationWarnings.push(w);
    }
  }

  return { metrics: result, warnings: calculationWarnings };
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
  console.log(`     loss_on_disposal:          ${adj.loss_on_disposal ?? 0}`);
  console.log(`   + One-time Expenses:         ${breakdown.one_time_expenses}`);
  console.log(`   + Owner/Mgmt Adjustments:    ${breakdown.owner_management_adjustments}`);
  console.log(`   + Accounting Adjustments:    ${breakdown.accounting_adjustments}`);
  console.log(`   + FX Adjustments:            ${breakdown.fx_adjustments}`);
  console.log(`   + Pro Forma Adjustments:     ${breakdown.pro_forma_adjustments}`);
  console.log(`   - One-time Gains:            ${breakdown.one_time_gains}`);
  console.log(`     other_income_non_operating: ${adj.other_income_non_operating ?? 0}`);
  console.log(`     gain_on_disposal:           ${adj.gain_on_disposal ?? 0}`);
  console.log(`   - Interest Income Excluded:  ${breakdown.interest_income_excluded}`);
  console.log(`     interest_income:            ${m.interest_income ?? 0}`);
  console.log(`   ─────────────────────────────────────`);
  console.log(`   = Adjusted EBITDA:           ${result.adjusted_ebitda}`);

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

  console.log(`\n📊 EBITDA COVERAGE RATIO DEBUG:`);
  console.log(`   NUMERATOR:`);
  console.log(`     Adjusted EBITDA:           ${adjustedEbitda}`);
  console.log(`   DENOMINATOR COMPONENTS (Debt Service):`);
  console.log(`     Bank Principal Payments:   ${breakdown.bank_principal_payments} (extracted: ${m.repayment_of_debt})`);
  console.log(`     Cash Interest Paid:        ${breakdown.bank_interest_expense} (extracted: ${m.cash_interest_paid})`);
  console.log(`     Lease Payments:            ${breakdown.lease_payments} (extracted: ${m.payment_of_lease_liability})`);
  console.log(`     Total Debt Service:        ${breakdown.total_debt_service}`);
  console.log(`   EBITDA Coverage = ${adjustedEbitda} / ${breakdown.total_debt_service} = ${result.dscr}x`);
  console.log(`   FUNDED DEBT METRICS:`);
  console.log(`     Funded Debt (Bank + Leases): ${breakdown.funded_debt}`);
  console.log(`     Funded Debt / EBITDA:      ${breakdown.funded_debt_to_ebitda != null ? `${breakdown.funded_debt_to_ebitda}x` : 'N/A'}\n`);
}

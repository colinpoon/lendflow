/**
 * Vision-based Financial Document Extractor
 * Combines PDF-to-image conversion with Claude Vision analysis.
 *
 * MERGE STRATEGY (replaces v1 "last-page wins"):
 * Each page can now return multiple fiscal years. When the same year appears
 * on more than one page (e.g., a summary page and a detail page) we collect
 * ALL extracted values for every metric and resolve conflicts using:
 *   1. Consensus — all values within 1% → use highest-confidence value
 *   2. Highest confidence — any variance > 1% → prefer the source with the highest
 *      page-source score (earlier pages score higher as they tend to be
 *      consolidated statements rather than segment/note disclosures)
 *
 * NOTE: We do NOT use weighted averaging for financial data. If two pages show
 * different values, one is correct and the other is wrong - averaging fabricates
 * a value that appears in neither source.
 *
 * After merging, a scale-normalization pass detects any remaining ~1000×
 * outliers across years (raw dollars vs thousands) and corrects them.
 */

import { convertPdfToImages, convertPdfPage } from './pdf-converter';
import {
  createVisionClient,
  analyzeFinancialImage,
  type PageExtractionResult,
  type YearExtraction,
} from './claude-client';
import type { ExtractedMetrics } from '@/types/financial';
import type Anthropic from '@anthropic-ai/sdk';
import { MERGE_CONFIG } from '@/lib/constants';
import { normalizeScaleMismatch } from '@/lib/extraction-merger';

// ─────────────────────────────────────────────────────────────────────────────
// Public Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ExtractionOptions {
  /** Pages to extract (1-based). Defaults to all pages. */
  pages?: number[];
  /** Scale factor for image conversion. Default: 4.17 (≈300 DPI) */
  scale?: number;
  /** Existing Anthropic client to reuse. Creates a new one if omitted. */
  client?: Anthropic;
}

export interface MergeConflict {
  year: string;
  metric: string;
  candidateCount: number;
  resolvedValue: number;
  resolution: 'single' | 'consensus' | 'highest_confidence';
  variancePercent: number;
}

export interface PdfExtractionResult {
  /** Merged metrics keyed by normalized fiscal year (e.g., "2023") */
  metricsByYear: Record<string, ExtractedMetrics>;
  /** Per-page raw extraction results (for debugging / auditing) */
  pageResults: Array<{
    pageNumber: number;
    result: PageExtractionResult;
  }>;
  /** Aggregated token usage across all pages */
  totalUsage: {
    inputTokens: number;
    outputTokens: number;
  };
  /** Number of pages that produced at least one extraction */
  pagesProcessed: number;
  /** Conflicts detected and resolved during merge */
  mergeConflicts: MergeConflict[];
  /** Scale notes reported by Claude for each page */
  scaleNotes: Array<{ pageNumber: number; note: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Merge Types
// ─────────────────────────────────────────────────────────────────────────────

interface ValueCandidate {
  value: number;
  /** 1-based page number — used to derive source confidence */
  pageNumber: number;
  /** Confidence weight 0–1. Earlier pages get higher confidence. */
  confidence: number;
}

type MetaValue = string | boolean | null;

// Metrics that are plain currency amounts (not ratios / flags)
const CURRENCY_METRICS: ReadonlySet<string> = new Set([
  'revenue',
  'net_income',
  'expenses',
  'interest',
  'taxes',
  'depreciation_amortization',
  'depreciation_equipment',
  'depreciation_rou',
  'depreciation_other',
  'ebitda',
  'shareholders_equity',
  'total_debt',
  'senior_debt',
  'current_assets',
  'current_liabilities',
  'capital_expenditures',
  'proceeds_from_long_term_debt',
  'cash_taxes_paid',
  'distributions_paid',
  'ttm_principal_payments',
  'ttm_interest_expense',
  'repayment_of_debt',
  'payment_of_lease_liability',
  'cash_interest_paid',
  'non_cash_interest_expense',
]);

// Nested object fields that need their own merging strategy
const NESTED_KEYS: ReadonlySet<string> = new Set([
  'debt_components',
  'fixed_charges',
  'adjusted_ebitda_components',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Single-Page Extraction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract financial metrics from a single PDF page.
 * Returns raw PageExtractionResult (all years found on that page).
 */
export async function extractFromPdfPage(
  pdfInput: string | Buffer,
  pageNumber: number,
  options: Omit<ExtractionOptions, 'pages'> = {}
): Promise<PageExtractionResult> {
  const client = options.client ?? createVisionClient();
  const scale = options.scale ?? 4.17;

  const imageBuffer = await convertPdfPage(pdfInput, pageNumber, { scale });
  return analyzeFinancialImage(client, imageBuffer);
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-Page Extraction with Conflict-Aware Merge
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract financial metrics from all (or selected) PDF pages.
 * Merges results by fiscal year using conflict-aware weighted selection.
 *
 * @param pdfInput - PDF file path or Buffer
 * @param options - Extraction options
 * @returns Combined extraction results with conflict report
 */
export async function extractFromPdf(
  pdfInput: string | Buffer,
  options: ExtractionOptions = {}
): Promise<PdfExtractionResult> {
  const client = options.client ?? createVisionClient();
  const scale = options.scale ?? 4.17;

  const allPages = await convertPdfToImages(pdfInput, { scale });

  const pagesToProcess = options.pages
    ? allPages.filter((p) => options.pages!.includes(p.pageNumber))
    : allPages;

  if (pagesToProcess.length === 0) {
    throw new Error('No pages to process');
  }

  // ── Step 1: Process pages sequentially to avoid rate limits ────────────────

  const pageResults: PdfExtractionResult['pageResults'] = [];
  const scaleNotes: PdfExtractionResult['scaleNotes'] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Accumulate candidates: "normalizedYear:metric" → ValueCandidate[]
  const numericCandidates = new Map<string, ValueCandidate[]>();
  // First-seen nested objects per "normalizedYear:nestedKey"
  const nestedValues = new Map<string, Record<string, number | null>>();
  // First-seen string/boolean metadata values per "normalizedYear:field"
  const metaValues = new Map<string, MetaValue>();

  for (const page of pagesToProcess) {
    console.log(`Processing page ${page.pageNumber}/${allPages.length}...`);

    let result: PageExtractionResult;
    try {
      result = await analyzeFinancialImage(client, page.image);
    } catch (error) {
      console.error(`Error processing page ${page.pageNumber}:`, error);
      continue; // Skip failed pages rather than aborting the whole document
    }

    pageResults.push({ pageNumber: page.pageNumber, result });
    totalInputTokens += result.usage.inputTokens;
    totalOutputTokens += result.usage.outputTokens;

    if (result.scaleNote) {
      scaleNotes.push({ pageNumber: page.pageNumber, note: result.scaleNote });
    }

    // Assign source confidence: earlier pages score higher (consolidated
    // statements appear before notes/schedules in most financial reports)
    const pageConfidence = computePageConfidence(page.pageNumber, allPages.length);

    for (const yearExtraction of result.yearExtractions) {
      const normalizedYear = normalizeFiscalYear(yearExtraction.fiscalYear);
      accumulateCandidates(
        yearExtraction,
        normalizedYear,
        page.pageNumber,
        pageConfidence,
        numericCandidates,
        nestedValues,
        metaValues
      );
    }
  }

  // ── Step 2: Resolve conflicts for each metric ──────────────────────────────

  const { metricsByYear, mergeConflicts } = resolveAllCandidates(
    numericCandidates,
    nestedValues,
    metaValues
  );

  // ── Step 3: Scale normalization pass ──────────────────────────────────────
  // Re-use the existing cross-year normalizer from lib/extraction-merger.ts.
  // It detects ~1000× outliers between years (raw dollars vs thousands) and
  // divides outlier values by 1000.
  // The double-cast through `unknown` is intentional: normalizeScaleMismatch
  // uses its own internal YearMetrics type that is structurally compatible but
  // not nominally identical to ExtractedMetrics.
  const normalizedMetricsByYear = normalizeScaleMismatch(
    metricsByYear as unknown as Record<string, Record<string, number | null>>
  ) as unknown as Record<string, ExtractedMetrics>;

  return {
    metricsByYear: normalizedMetricsByYear,
    pageResults,
    totalUsage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
    pagesProcessed: pageResults.length,
    mergeConflicts,
    scaleNotes,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Candidate Accumulation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute a confidence weight for a page based on its position.
 * Pages near the front of the document are more likely to be consolidated
 * statements; later pages are more likely to be notes or segment details.
 * Range: 0.65 (last page) → 0.92 (first page).
 */
function computePageConfidence(pageNumber: number, totalPages: number): number {
  const MIN_CONFIDENCE = 0.65;
  const MAX_CONFIDENCE = 0.92;
  if (totalPages <= 1) return MAX_CONFIDENCE;
  const fraction = (pageNumber - 1) / (totalPages - 1); // 0 for first, 1 for last
  return MAX_CONFIDENCE - fraction * (MAX_CONFIDENCE - MIN_CONFIDENCE);
}

/**
 * Walk through a single YearExtraction and accumulate every numeric value
 * into the candidate map (for later conflict resolution).
 */
function accumulateCandidates(
  yearExtraction: YearExtraction,
  normalizedYear: string,
  pageNumber: number,
  pageConfidence: number,
  numericCandidates: Map<string, ValueCandidate[]>,
  nestedValues: Map<string, Record<string, number | null>>,
  metaValues: Map<string, MetaValue>
): void {
  const metrics = yearExtraction.metrics as unknown as Record<string, unknown>;

  for (const [field, rawValue] of Object.entries(metrics)) {
    // ── Nested objects: keep the first non-null value seen ─────────────────
    if (NESTED_KEYS.has(field)) {
      const nestedKey = `${normalizedYear}:${field}`;
      if (!nestedValues.has(nestedKey) && rawValue != null && typeof rawValue === 'object') {
        nestedValues.set(nestedKey, rawValue as Record<string, number | null>);
      }
      continue;
    }

    // ── Non-numeric metadata (strings / booleans like fiscal_year_end_date) ─
    if (typeof rawValue === 'string' || typeof rawValue === 'boolean') {
      const metaKey = `${normalizedYear}:${field}`;
      if (!metaValues.has(metaKey)) {
        metaValues.set(metaKey, rawValue);
      }
      continue;
    }

    // ── Null: record first-seen null for metadata (skip numeric candidates) ─
    if (rawValue === null) continue;

    // ── Numeric values: add to candidates map ─────────────────────────────
    if (typeof rawValue === 'number' && CURRENCY_METRICS.has(field)) {
      const candidateKey = `${normalizedYear}:${field}`;
      const existing = numericCandidates.get(candidateKey) ?? [];
      existing.push({ value: rawValue, pageNumber, confidence: pageConfidence });
      numericCandidates.set(candidateKey, existing);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Conflict Resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve all collected candidates into final per-year metric values.
 */
function resolveAllCandidates(
  numericCandidates: Map<string, ValueCandidate[]>,
  nestedValues: Map<string, Record<string, number | null>>,
  metaValues: Map<string, MetaValue>
): {
  metricsByYear: Record<string, ExtractedMetrics>;
  mergeConflicts: MergeConflict[];
} {
  // Use a loose internal record type to accumulate heterogeneous values.
  // The cast to ExtractedMetrics at the end is safe because we only write
  // fields that are defined on ExtractedMetrics (numeric metrics, nested
  // objects, and string metadata fields).
  const metricsByYear: Record<string, Record<string, unknown>> = {};
  const mergeConflicts: MergeConflict[] = [];

  // Resolve numeric metrics
  for (const [key, candidates] of numericCandidates.entries()) {
    const colonIndex = key.indexOf(':');
    const year = key.slice(0, colonIndex);
    const metric = key.slice(colonIndex + 1);

    if (!metricsByYear[year]) metricsByYear[year] = {};

    const resolution = resolveConflict(candidates);
    metricsByYear[year][metric] = resolution.value;

    if (
      candidates.length > 1 &&
      resolution.variancePercent > MERGE_CONFIG.CONFLICT_THRESHOLD_PERCENT
    ) {
      mergeConflicts.push({
        year,
        metric,
        candidateCount: candidates.length,
        resolvedValue: resolution.value,
        resolution: resolution.strategy,
        variancePercent: resolution.variancePercent,
      });

      console.warn(
        `Vision merge conflict: ${year}/${metric} — ` +
          `${candidates.length} values, ${resolution.variancePercent.toFixed(1)}% variance. ` +
          `Resolved to ${resolution.value} via ${resolution.strategy}. ` +
          `Candidates: [${candidates.map((c) => `${c.value} (p${c.pageNumber}, conf=${c.confidence.toFixed(2)})`).join(', ')}]`
      );
    }
  }

  // Merge nested objects
  for (const [key, nestedObject] of nestedValues.entries()) {
    const colonIndex = key.indexOf(':');
    const year = key.slice(0, colonIndex);
    const field = key.slice(colonIndex + 1);
    if (!metricsByYear[year]) metricsByYear[year] = {};
    metricsByYear[year][field] = nestedObject;
  }

  // Merge metadata strings
  for (const [key, value] of metaValues.entries()) {
    const colonIndex = key.indexOf(':');
    const year = key.slice(0, colonIndex);
    const field = key.slice(colonIndex + 1);
    if (!metricsByYear[year]) metricsByYear[year] = {};
    // Only set if not already populated by numeric resolution
    if (metricsByYear[year][field] === undefined) {
      metricsByYear[year][field] = value;
    }
  }

  return {
    metricsByYear: metricsByYear as unknown as Record<string, ExtractedMetrics>,
    mergeConflicts,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Conflict Resolution Helpers
// ─────────────────────────────────────────────────────────────────────────────

interface Resolution {
  value: number;
  strategy: MergeConflict['resolution'];
  variancePercent: number;
}

function resolveConflict(candidates: ValueCandidate[]): Resolution {
  if (candidates.length === 1) {
    return { value: candidates[0].value, strategy: 'single', variancePercent: 0 };
  }

  const variancePercent = calculateVariancePercent(candidates.map((c) => c.value));

  // All values within 1% → treat as consensus, use highest-confidence source
  if (variancePercent < 1) {
    const best = highestConfidenceCandidate(candidates);
    return { value: best.value, strategy: 'consensus', variancePercent };
  }

  // For financial data, we do NOT use weighted averaging.
  // If two pages show different values (e.g., 12,000 vs 12,600), the true answer
  // is one of them, not their average. Averaging fabricates values.
  // Always use the highest-confidence source (earliest page wins ties).
  const best = highestConfidenceCandidate(candidates);
  return { value: best.value, strategy: 'highest_confidence', variancePercent };
}

function highestConfidenceCandidate(candidates: ValueCandidate[]): ValueCandidate {
  return candidates.reduce((best, current) => {
    if (current.confidence > best.confidence) return current;
    if (current.confidence === best.confidence && current.pageNumber < best.pageNumber) {
      return current; // Earlier page wins tiebreaker
    }
    return best;
  });
}

function calculateVariancePercent(values: number[]): number {
  if (values.length < 2) return 0;
  const absValues = values.map(Math.abs);
  const min = Math.min(...absValues);
  const max = Math.max(...absValues);
  if (min === 0) return max === 0 ? 0 : 100;
  return ((max - min) / min) * 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fiscal Year Normalization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize a raw fiscal year label to a 4-digit year string.
 * Handles: "FY2023", "2023Q4", "Year ended December 31, 2023", "2023".
 *
 * @param raw - Fiscal year label returned by Claude
 * @returns 4-digit year string, or the original label if no year is found
 */
function normalizeFiscalYear(raw: string): string {
  const match = raw.match(/\b(20\d{2}|19\d{2})\b/);
  return match ? match[1] : raw;
}

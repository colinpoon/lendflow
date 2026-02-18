/**
 * Extraction merger utilities
 * Consolidates partial JSON extractions from multiple chunks
 *
 * CONFLICT-AWARE MERGING:
 * - Collects ALL values for each metric from all chunks
 * - Scores values by source type (table > primary text > overlap)
 * - Uses weighted selection for conflicts
 * - Logs all resolution decisions for debugging
 */

import { MERGE_CONFIG, SCALE_VALIDATION, CURRENCY_METRICS } from './constants';
import { isTableSource } from './validation';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A candidate value extracted from a chunk
 */
interface ValueCandidate {
  value: number;
  chunkIndex: number;
  sourceType: 'table' | 'primary' | 'overlap' | 'inferred';
  confidence: number;
}

/**
 * Conflict information for a metric
 */
export interface MetricConflict {
  year: string;
  metric: string;
  candidates: ValueCandidate[];
  resolvedValue: number;
  resolution: 'single' | 'highest_confidence' | 'weighted_average' | 'consensus';
  variancePercent: number;
}

/** Metric value - can be number, null, or nested object */
type MetricValue = number | null | Record<string, number | null>;

/** Year metrics - a record of metric names to values */
type YearMetrics = Record<string, MetricValue>;

/** Extraction input type */
interface ExtractionInput {
  metrics_by_year?: Record<string, YearMetrics>;
  [key: string]: unknown;
}

/**
 * Merge result with conflict information
 */
export interface MergeResult {
  metrics: Record<string, YearMetrics>;
  conflicts: MetricConflict[];
  totalMetrics: number;
  conflictsDetected: number;
}

/**
 * Result from scale normalization functions
 * Includes both corrected metrics and human-readable correction descriptions
 */
export interface ScaleNormalizationResult {
  metrics: Record<string, YearMetrics>;
  corrections: string[];
}

// Nested object keys that need special handling
const NESTED_KEYS = ['debt_components', 'fixed_charges', 'adjusted_ebitda_components'];

// ─────────────────────────────────────────────────────────────────────────────
// Value Collection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Collect all values for each metric across all chunks
 * Returns a map of "year:metric" -> array of candidates
 */
function collectAllValues(
  extractions: ExtractionInput[]
): Map<string, ValueCandidate[]> {
  const valueMap = new Map<string, ValueCandidate[]>();

  for (let chunkIndex = 0; chunkIndex < extractions.length; chunkIndex++) {
    const obj = extractions[chunkIndex];
    if (!obj || typeof obj !== 'object' || !obj.metrics_by_year) continue;

    for (const [year, metrics] of Object.entries(obj.metrics_by_year)) {
      if (!metrics || typeof metrics !== 'object') continue;

      for (const [metric, value] of Object.entries(metrics)) {
        // Skip nested objects - handle separately
        if (NESTED_KEYS.includes(metric)) continue;

        // Only collect numeric values
        if (typeof value !== 'number' || value === null) continue;

        const key = `${year}:${metric}`;
        if (!valueMap.has(key)) {
          valueMap.set(key, []);
        }

        // Determine source type and confidence
        const sourceType = determineSourceType(obj, year, metric);
        const confidence = MERGE_CONFIG.SOURCE_WEIGHTS[sourceType];

        valueMap.get(key)!.push({
          value,
          chunkIndex,
          sourceType,
          confidence,
        });
      }
    }
  }

  return valueMap;
}

/**
 * Determine the source type for a value
 * In future, this can use metadata from the AI response
 */
function determineSourceType(
  extraction: Record<string, unknown>,
  year: string,
  metric: string
): 'table' | 'primary' | 'overlap' | 'inferred' {
  // Check if there's source metadata in the extraction
  const metricsData = extraction.metrics_by_year as Record<string, Record<string, unknown>> | undefined;
  const sourceDescription =
    (metricsData?.[year]?._sources as Record<string, string> | undefined)?.[metric] || '';

  if (isTableSource(sourceDescription)) {
    return 'table';
  }

  // Default to primary for now
  // Future enhancement: detect overlap regions based on chunk boundaries
  return 'primary';
}

// ─────────────────────────────────────────────────────────────────────────────
// Conflict Resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate variance between values as a percentage
 */
function calculateVariance(values: number[]): number {
  if (values.length < 2) return 0;

  const min = Math.min(...values.map(Math.abs));
  const max = Math.max(...values.map(Math.abs));

  if (min === 0) return max === 0 ? 0 : 100;

  return ((max - min) / min) * 100;
}

/**
 * Resolve a conflict between multiple candidate values
 */
function resolveConflict(
  candidates: ValueCandidate[]
): { value: number; resolution: MetricConflict['resolution']; variancePercent: number } {
  const values = candidates.map((c) => c.value);
  const variancePercent = calculateVariance(values);

  // Single value - no conflict
  if (candidates.length === 1) {
    return {
      value: candidates[0].value,
      resolution: 'single',
      variancePercent: 0,
    };
  }

  // Check for consensus (all values within 1% of each other)
  if (variancePercent < 1) {
    // Values are essentially the same, use highest confidence
    const best = candidates.reduce((a, b) => (a.confidence > b.confidence ? a : b));
    return {
      value: best.value,
      resolution: 'consensus',
      variancePercent,
    };
  }

  // Low variance (< threshold) - use weighted average
  if (variancePercent <= MERGE_CONFIG.CONFLICT_THRESHOLD_PERCENT) {
    const totalWeight = candidates.reduce((sum, c) => sum + c.confidence, 0);
    const weightedSum = candidates.reduce((sum, c) => sum + c.value * c.confidence, 0);
    return {
      value: Math.round((weightedSum / totalWeight) * 100) / 100,
      resolution: 'weighted_average',
      variancePercent,
    };
  }

  // High variance - flag as conflict and use highest confidence source
  const best = candidates.reduce((a, b) => {
    // Prefer higher confidence
    if (a.confidence !== b.confidence) {
      return a.confidence > b.confidence ? a : b;
    }
    // Tie-breaker: prefer lower chunk index (earlier in document)
    return a.chunkIndex < b.chunkIndex ? a : b;
  });

  return {
    value: best.value,
    resolution: 'highest_confidence',
    variancePercent,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Merge Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Merge multiple extraction results with conflict detection and resolution
 * @param extractions - Array of extraction results from AI (with chunk indices)
 * @returns Merged metrics with conflict report
 */
export function mergeExtractionsWithConflicts(
  extractions: ExtractionInput[]
): MergeResult {
  const conflicts: MetricConflict[] = [];
  const merged: Record<string, YearMetrics> = {};

  // Collect all values
  const valueMap = collectAllValues(extractions);

  // Resolve each metric
  let totalMetrics = 0;
  let conflictsDetected = 0;

  for (const [key, candidates] of valueMap.entries()) {
    const [year, metric] = key.split(':');
    totalMetrics++;

    // Initialize year if needed
    if (!merged[year]) {
      merged[year] = {};
    }

    // Resolve conflict
    const { value, resolution, variancePercent } = resolveConflict(candidates);
    merged[year][metric] = value;

    // Track conflicts
    if (candidates.length > 1 && variancePercent > MERGE_CONFIG.CONFLICT_THRESHOLD_PERCENT) {
      conflictsDetected++;
      const conflict: MetricConflict = {
        year,
        metric,
        candidates,
        resolvedValue: value,
        resolution,
        variancePercent,
      };
      conflicts.push(conflict);

      // Log conflict for debugging
      console.warn(
        `⚠️ Conflict detected: ${year}/${metric} - ` +
          `${candidates.length} values with ${variancePercent.toFixed(1)}% variance. ` +
          `Resolved to ${value} via ${resolution}. ` +
          `Values: [${candidates.map((c) => `${c.value} (chunk ${c.chunkIndex}, ${c.sourceType})`).join(', ')}]`
      );
    }
  }

  // Handle nested objects (use legacy merge for now)
  mergeNestedObjects(extractions, merged);

  console.log(
    `📊 Merge complete: ${totalMetrics} metrics, ${conflictsDetected} conflicts detected`
  );

  return {
    metrics: merged,
    conflicts,
    totalMetrics,
    conflictsDetected,
  };
}

/** Nested metric object type */
type NestedMetrics = Record<string, number | null>;

/**
 * Merge nested objects (debt_components, fixed_charges, adjusted_ebitda_components)
 * Uses the legacy first-non-null strategy for nested objects
 */
function mergeNestedObjects(
  extractions: ExtractionInput[],
  merged: Record<string, YearMetrics>
): void {
  for (const obj of extractions) {
    if (!obj || typeof obj !== 'object' || !obj.metrics_by_year) continue;

    for (const [year, metrics] of Object.entries(obj.metrics_by_year)) {
      if (!merged[year]) {
        merged[year] = {};
      }

      for (const nestedKey of NESTED_KEYS) {
        const nestedValue = metrics[nestedKey];
        if (nestedValue != null && typeof nestedValue === 'object') {
          merged[year][nestedKey] = mergeNestedObject(
            merged[year][nestedKey] as NestedMetrics | null | undefined,
            nestedValue as NestedMetrics
          );
        }
      }
    }
  }
}

/**
 * Merge two nested objects, keeping non-null values
 * @param existing - Existing object (may be null/undefined)
 * @param incoming - Incoming object to merge
 * @returns Merged object
 */
function mergeNestedObject(
  existing: NestedMetrics | null | undefined,
  incoming: NestedMetrics
): NestedMetrics {
  if (!existing) {
    return { ...incoming };
  }

  const merged = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    if (merged[key] == null && value != null) {
      merged[key] = value;
    }
  }

  return merged;
}

/**
 * Legacy merge function for backward compatibility
 * @deprecated Use mergeExtractionsWithConflicts for better conflict handling
 */
export function mergeExtractions(extractions: ExtractionInput[]): Record<string, YearMetrics> {
  const result = mergeExtractionsWithConflicts(extractions);
  return result.metrics;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scale Normalization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize scale mismatches across years
 * Detects when one year's value is ~1000x larger than others (raw dollars vs thousands)
 * and corrects by dividing by 1000
 *
 * Uses median as reference (more robust when 2 of 3 years are wrong)
 *
 * @param merged - Merged metrics by year
 * @returns Normalized metrics with corrections log
 */
export function normalizeScaleMismatch(
  merged: Record<string, YearMetrics>
): ScaleNormalizationResult {
  const corrections: string[] = [];
  const years = Object.keys(merged);

  if (years.length < 2) {
    return { metrics: merged, corrections };
  }

  const normalized = structuredClone(merged);

  for (const metric of CURRENCY_METRICS) {
    // Collect non-null values for this metric across years
    const values: { year: string; value: number }[] = [];
    for (const yr of years) {
      const val = normalized[yr]?.[metric];
      if (typeof val === 'number' && val !== 0) {
        values.push({ year: yr, value: val });
      }
    }

    if (values.length < 2) continue;

    // Sort by absolute value
    const sorted = [...values].sort((a, b) => Math.abs(a.value) - Math.abs(b.value));
    const minAbs = Math.abs(sorted[0].value);
    const maxAbs = Math.abs(sorted[sorted.length - 1].value);

    // Use median as reference (more robust than min when multiple values are wrong)
    const medianValue = Math.abs(sorted[Math.floor(sorted.length / 2)].value);
    const referenceValue = sorted.length >= 3 ? medianValue : minAbs;

    const ratio = maxAbs / minAbs;
    if (
      ratio >= SCALE_VALIDATION.CROSS_YEAR_MIN_RATIO &&
      ratio <= SCALE_VALIDATION.CROSS_YEAR_MAX_RATIO
    ) {
      for (const { year, value } of values) {
        const absValue = Math.abs(value);
        if (absValue > referenceValue * SCALE_VALIDATION.OUTLIER_MULTIPLE) {
          const correctedValue = value / SCALE_VALIDATION.SCALE_FACTOR;
          const correction = `${metric}/${year}: ${value.toLocaleString()} → ${correctedValue.toLocaleString()} (÷${SCALE_VALIDATION.SCALE_FACTOR}, cross-year scale mismatch)`;
          corrections.push(correction);
          console.log(`⚠️ ${correction}`);
          normalized[year][metric] = correctedValue;
        }
      }
    }
  }

  return { metrics: normalized, corrections };
}

/**
 * Validate and correct cross-metric scale mismatches within each year
 * Detects when metrics are extracted at wrong scale by comparing ratios.
 *
 * Two modes:
 * 1. Only Revenue wrong: EBITDA margin impossibly low, but net income/EBITDA ratio is normal
 * 2. All metrics wrong: The entire year is in raw dollars - correct ALL currency metrics
 *
 * Business logic:
 * - EBITDA margin (EBITDA/Revenue) typically 5%-50%
 * - If EBITDA margin < 0.1%, something is wrong with scale
 * - If net income > corrected revenue, ALL metrics are wrong (not just revenue)
 *
 * @param metrics - Metrics by year
 * @returns Corrected metrics with corrections log
 */
export function validateCrossMetricScale(
  metrics: Record<string, YearMetrics>
): ScaleNormalizationResult {
  const corrections: string[] = [];
  const corrected = structuredClone(metrics);

  for (const [year, yearData] of Object.entries(corrected)) {
    const revenue = yearData.revenue as number | null | undefined;
    const ebitda = yearData.ebitda as number | null | undefined;
    const netIncome = yearData.net_income as number | null | undefined;

    if (typeof revenue !== 'number' || revenue <= 0) continue;

    // ─────────────────────────────────────────────────────────────────────────
    // CHECK 1: Absolute Magnitude Check
    // If Revenue > $100M (in thousands), suspect all values are in raw dollars
    // This catches the case where ALL metrics are consistently at wrong scale
    // ─────────────────────────────────────────────────────────────────────────
    if (revenue > SCALE_VALIDATION.MAX_PLAUSIBLE_REVENUE_K) {
      const correctedRevenue = revenue / SCALE_VALIDATION.SCALE_FACTOR;

      // Only correct if the result is plausible (> $10K in thousands)
      if (correctedRevenue >= SCALE_VALIDATION.MIN_PLAUSIBLE_REVENUE_K) {
        // Correct ALL currency metrics - the entire year is in raw dollars
        let correctedCount = 0;
        for (const metric of CURRENCY_METRICS) {
          const val = corrected[year][metric];
          if (typeof val === 'number' && val !== 0) {
            corrected[year][metric] = val / SCALE_VALIDATION.SCALE_FACTOR;
            correctedCount++;
          }
        }

        // Also scale nested objects (debt_components, fixed_charges, adjusted_ebitda_components)
        for (const nestedKey of NESTED_KEYS) {
          const nestedObj = corrected[year][nestedKey];
          if (nestedObj && typeof nestedObj === 'object') {
            for (const [key, val] of Object.entries(nestedObj as Record<string, unknown>)) {
              if (typeof val === 'number' && val !== 0) {
                (nestedObj as Record<string, number>)[key] = val / SCALE_VALIDATION.SCALE_FACTOR;
                correctedCount++;
              }
            }
          }
        }

        const correction = `${year}: Revenue ${revenue.toLocaleString()} exceeds $100M threshold - all ${correctedCount} currency values divided by ${SCALE_VALIDATION.SCALE_FACTOR} (likely raw dollars)`;
        corrections.push(correction);
        console.log(`⚠️ ${correction}`);
        continue; // Skip other checks for this year - already corrected
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CHECK 2: EBITDA Margin Check
    // If EBITDA margin is impossibly low, Revenue may be at wrong scale
    // ─────────────────────────────────────────────────────────────────────────

    // Check EBITDA margin if EBITDA is available
    if (typeof ebitda === 'number' && ebitda > 0) {
      const ebitdaMargin = ebitda / revenue;

      // If EBITDA margin < threshold, we have a scale mismatch
      if (ebitdaMargin < SCALE_VALIDATION.MIN_EBITDA_MARGIN) {
        const correctedRevenue = revenue / SCALE_VALIDATION.SCALE_FACTOR;
        const correctedMargin = ebitda / correctedRevenue;

        // Only proceed if the corrected margin is reasonable
        if (
          correctedMargin >= SCALE_VALIDATION.MIN_CORRECTED_MARGIN &&
          correctedMargin <= SCALE_VALIDATION.MAX_CORRECTED_MARGIN
        ) {
          // Determine: is ONLY revenue wrong, or is the ENTIRE year in raw dollars?
          // If net income > corrected revenue, then net income is ALSO at wrong scale
          const allMetricsWrongScale =
            typeof netIncome === 'number' &&
            netIncome > 0 &&
            netIncome / correctedRevenue > 1.0;

          if (allMetricsWrongScale) {
            // The entire year is in raw dollars - correct ALL currency metrics
            let correctedCount = 0;
            for (const metric of CURRENCY_METRICS) {
              const val = corrected[year][metric];
              if (typeof val === 'number' && val !== 0) {
                corrected[year][metric] = val / SCALE_VALIDATION.SCALE_FACTOR;
                correctedCount++;
              }
            }
            const correction = `${year}: All ${correctedCount} currency metrics divided by ${SCALE_VALIDATION.SCALE_FACTOR} (entire year in raw dollars, EBITDA margin was ${(ebitdaMargin * 100).toFixed(3)}%)`;
            corrections.push(correction);
            console.log(`⚠️ ${correction}`);
          } else {
            // Only revenue is wrong - other metrics are already in thousands
            corrected[year].revenue = correctedRevenue;
            const correction = `${year}/revenue: ${revenue.toLocaleString()} → ${correctedRevenue.toLocaleString()} (÷${SCALE_VALIDATION.SCALE_FACTOR}, EBITDA margin was ${(ebitdaMargin * 100).toFixed(3)}% → ${(correctedMargin * 100).toFixed(1)}%)`;
            corrections.push(correction);
            console.log(`⚠️ ${correction}`);
          }
        }
      }
    }

    // Secondary check: Net Income vs Revenue consistency
    const currentRevenue = corrected[year].revenue;
    const currentNetIncome = corrected[year].net_income;
    if (
      typeof currentRevenue === 'number' &&
      typeof currentNetIncome === 'number' &&
      currentNetIncome > currentRevenue
    ) {
      corrections.push(
        `${year}: Warning - Net Income (${currentNetIncome.toLocaleString()}) > Revenue (${currentRevenue.toLocaleString()}). Data may still be inconsistent.`
      );
    }
  }

  return { metrics: corrected, corrections };
}

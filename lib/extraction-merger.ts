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

import { MERGE_CONFIG } from './constants';
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

// Currency metrics that should be in thousands (not raw dollars)
const CURRENCY_METRICS = [
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
  'reported_adjusted_ebitda',
  'shareholders_equity',
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
  'total_debt',
  'senior_debt',
  'current_assets',
  'current_liabilities',
];

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
 * @param merged - Merged metrics by year
 * @returns Normalized metrics with consistent scaling
 */
export function normalizeScaleMismatch(
  merged: Record<string, YearMetrics>
): Record<string, YearMetrics> {
  const years = Object.keys(merged);
  if (years.length < 2) return merged; // Need 2+ years to detect mismatch

  const normalized = JSON.parse(JSON.stringify(merged)); // Deep clone

  for (const metric of CURRENCY_METRICS) {
    // Collect non-null values for this metric across years
    const values: { year: string; value: number }[] = [];
    for (const yr of years) {
      const val = normalized[yr]?.[metric];
      if (typeof val === 'number' && val !== 0) {
        values.push({ year: yr, value: val });
      }
    }

    if (values.length < 2) continue; // Need 2+ values to compare

    // Sort by absolute value to find min and max
    const sorted = [...values].sort((a, b) => Math.abs(a.value) - Math.abs(b.value));
    const minAbs = Math.abs(sorted[0].value);
    const maxAbs = Math.abs(sorted[sorted.length - 1].value);

    // If max is 500-2000x larger than min, the max values are likely in raw dollars
    const ratio = maxAbs / minAbs;
    if (ratio >= 500 && ratio <= 2000) {
      // Find all values that are close to the max (within 10x) and divide them by 1000
      for (const { year, value } of values) {
        const absValue = Math.abs(value);
        if (absValue > minAbs * 100) {
          // This value is an outlier (much larger than the min)
          const corrected = value / 1000;
          console.log(
            `⚠️ Scale mismatch detected: ${metric} in ${year} is ~${(absValue / minAbs).toFixed(0)}x larger than smallest value. ` +
              `Correcting ${value.toLocaleString()} → ${corrected.toLocaleString()} (÷1000)`
          );
          normalized[year][metric] = corrected;
        }
      }
    }
  }

  return normalized;
}

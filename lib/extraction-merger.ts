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
import type { ExtractionMetadata } from './chunk-processor';

// Gate financial data logs behind DEBUG_FINANCIALS to prevent sensitive data in production logs
const DEBUG_FINANCIALS = process.env.DEBUG_FINANCIALS === 'true';

// ─────────────────────────────────────────────────────────────────────────────
// Consensus Resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate the median of an array of numbers
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Cluster candidates by value within a tolerance
 * Returns groups of candidates whose values are within tolerance of each other
 *
 * Uses median as cluster reference to prevent tolerance drift where values
 * 100→100.9→101.8→102.7 would incorrectly cluster together
 */
function clusterByValue(
  candidates: ValueCandidate[],
  tolerance: number
): ValueCandidate[][] {
  const clusters: ValueCandidate[][] = [];

  for (const candidate of candidates) {
    let foundCluster = false;

    for (const cluster of clusters) {
      // Use median of cluster values as reference point (prevents drift)
      const clusterValues = cluster.map((c) => c.value);
      const clusterRef = median(clusterValues);

      // Check if candidate is within tolerance of cluster median
      const variance = Math.abs(candidate.value - clusterRef) / Math.abs(clusterRef || 1);

      if (variance <= tolerance) {
        cluster.push(candidate);
        foundCluster = true;
        break;
      }
    }

    if (!foundCluster) {
      clusters.push([candidate]);
    }
  }

  return clusters;
}

/**
 * Find consensus value if 3+ candidates agree within tolerance
 * @param candidates - Array of value candidates
 * @param tolerance - Maximum variance to consider values as "agreeing" (e.g., 0.01 = 1%)
 * @returns The consensus value if found, null otherwise
 */
function findConsensus(
  candidates: ValueCandidate[],
  tolerance: number
): { value: number; confidence: number } | null {
  if (candidates.length < MERGE_CONFIG.MIN_CANDIDATES_FOR_CONSENSUS) {
    return null;
  }

  // Group candidates by value (within tolerance)
  const clusters = clusterByValue(candidates, tolerance);

  // Find if any cluster has >= majority threshold of candidates
  const majorityThreshold = candidates.length * MERGE_CONFIG.CONSENSUS_MAJORITY_THRESHOLD;
  const majorityCluster = clusters.find((c) => c.length >= majorityThreshold);

  if (majorityCluster) {
    // Return the highest-confidence value from the majority cluster
    // IMPORTANT: Use spread to avoid mutating the original array
    const sorted = [...majorityCluster].sort((a, b) => b.confidence - a.confidence);
    return {
      value: sorted[0].value,
      confidence: sorted[0].confidence,
    };
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A candidate value extracted from a chunk
 */
export interface ValueCandidate {
  value: number;
  chunkIndex: number;
  sourceType: 'table' | 'primary' | 'overlap' | 'inferred';
  confidence: number;
  /** The actual source description from AI extraction (e.g., "Cash Flow Statement, Operating Activities") */
  sourceDescription: string;
  /** The confidence level from AI extraction (high/medium/low) */
  confidenceLevel: 'high' | 'medium' | 'low' | '';
}

/**
 * Conflict information for a metric
 */
export interface MetricConflict {
  year: string;
  metric: string;
  candidates: ValueCandidate[];
  resolvedValue: number;
  resolution: 'single' | 'highest_confidence' | 'weighted_average' | 'consensus' | 'near_consensus' | 'source_dominance';
  variancePercent: number;
}

/** Metric value - can be number, null, or nested object (nested objects may contain strings, e.g. senior_debt_interest_rate) */
type MetricValue = number | null | Record<string, number | string | null>;

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
  /** Map of "year:metric" -> candidates for post-merge validation */
  candidatesMap: Map<string, ValueCandidate[]>;
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

        // Determine source type, confidence, and get raw metadata
        const sourceMetadata = getSourceMetadata(obj, year, metric);
        const confidence = MERGE_CONFIG.SOURCE_WEIGHTS[sourceMetadata.sourceType];

        valueMap.get(key)!.push({
          value,
          chunkIndex,
          sourceType: sourceMetadata.sourceType,
          confidence,
          sourceDescription: sourceMetadata.sourceDescription,
          confidenceLevel: sourceMetadata.confidenceLevel,
        });
      }
    }
  }

  return valueMap;
}

/**
 * Source metadata extracted from AI response
 */
interface SourceMetadata {
  sourceType: 'table' | 'primary' | 'overlap' | 'inferred';
  sourceDescription: string;
  confidenceLevel: 'high' | 'medium' | 'low' | '';
}

/**
 * Extract full source metadata for a value from AI-provided _sources and _confidence
 * Returns both the classified type AND the original description for reconciliation context
 */
function getSourceMetadata(
  extraction: Record<string, unknown>,
  year: string,
  metric: string
): SourceMetadata {
  // Check if there's source metadata in the extraction
  const metricsData = extraction.metrics_by_year as Record<string, Record<string, unknown>> | undefined;
  const sources = metricsData?.[year]?._sources as Record<string, string> | undefined;
  const confidences = metricsData?.[year]?._confidence as Record<string, string> | undefined;

  const sourceDescription = sources?.[metric] || '';
  const confidenceLevel = (confidences?.[metric] || '') as 'high' | 'medium' | 'low' | '';

  // Determine source type based on description and confidence
  let sourceType: 'table' | 'primary' | 'overlap' | 'inferred' = 'primary';

  // Table sources (highest authority) - check source description
  if (isTableSource(sourceDescription)) {
    sourceType = 'table';
  }
  // Low confidence from AI = inferred
  else if (confidenceLevel === 'low') {
    sourceType = 'inferred';
  }
  // Check for overlap indicators in source description
  else if (isOverlapSource(sourceDescription)) {
    sourceType = 'overlap';
  }

  return {
    sourceType,
    sourceDescription,
    confidenceLevel,
  };
}

/**
 * Check if a source description indicates an overlap region
 * Overlap regions are where chunk boundaries may have split data
 */
function isOverlapSource(sourceDescription: string): boolean {
  const overlapPatterns = [
    /partial/i,
    /incomplete/i,
    /continued/i,
    /see also/i,
    /refer to/i,
    /truncated/i,
  ];
  return overlapPatterns.some((p) => p.test(sourceDescription));
}

// ─────────────────────────────────────────────────────────────────────────────
// Conflict Resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate variance between values as a percentage
 * Handles sign disagreements as high variance (not hidden by Math.abs)
 */
function calculateVariance(values: number[]): number {
  if (values.length < 2) return 0;

  // Check for sign disagreement - this is a fundamental conflict, not a rounding issue
  const hasPositive = values.some((v) => v > 0);
  const hasNegative = values.some((v) => v < 0);
  if (hasPositive && hasNegative) {
    // Sign disagreement is always a significant conflict
    // Return 200% to ensure it escalates to AI reconciliation
    return 200;
  }

  // Use raw values (not absolute) to detect actual variance
  const min = Math.min(...values);
  const max = Math.max(...values);

  // Handle near-zero values to avoid division issues
  // If the reference value is very small, use absolute comparison
  const absMin = Math.abs(min);
  const absMax = Math.abs(max);
  const reference = Math.max(absMin, absMax);

  if (reference === 0) return 0;

  // For very small values (< $1K in thousands), treat as equivalent
  // This prevents 0.5 vs 1.0 from showing as 100% variance
  if (reference < 1) {
    return Math.abs(max - min) < 1 ? 0 : 100;
  }

  return (Math.abs(absMax - absMin) / reference) * 100;
}

/**
 * Resolve a conflict between multiple candidate values
 *
 * CASCADE ORDER (optimized for accuracy):
 * 1. Consensus - if 3+ candidates agree within 1%, trust the consensus
 * 2. Near-consensus - if all values within 1%, use highest confidence
 * 3. Source quality dominance - if one source type is clearly superior, use it
 * 4. Weighted average - only for low variance among similar-quality sources
 * 5. Highest confidence - final fallback with chunk index tiebreaker
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

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1: Check for consensus (3+ candidates agree within tolerance)
  // ─────────────────────────────────────────────────────────────────────────
  const consensusResult = findConsensus(candidates, MERGE_CONFIG.CONSENSUS_TOLERANCE);
  if (consensusResult !== null) {
    return {
      value: consensusResult.value,
      resolution: 'consensus',
      variancePercent,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2: Check for near-consensus (all values within 1% - even with < 3 candidates)
  // This is distinct from true consensus (3+ candidates agreeing) - labeled separately
  // for audit trail accuracy
  // ─────────────────────────────────────────────────────────────────────────
  if (variancePercent < 1) {
    // Values are essentially the same, use highest confidence
    const best = candidates.reduce((a, b) => (a.confidence > b.confidence ? a : b));
    return {
      value: best.value,
      resolution: 'near_consensus',
      variancePercent,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 3: Source quality dominance check
  // If there's a clear winner by source type (table vs inferred), use it directly
  // This prevents blending authoritative table data with inferred values
  // ─────────────────────────────────────────────────────────────────────────
  const sourceQualityResult = checkSourceQualityDominance(candidates);
  if (sourceQualityResult !== null) {
    return {
      value: sourceQualityResult.value,
      resolution: 'source_dominance',
      variancePercent,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 4: Low variance among similar-quality sources - use weighted average
  // Only apply weighted average when sources are of similar authority
  // ─────────────────────────────────────────────────────────────────────────
  if (variancePercent <= MERGE_CONFIG.CONFLICT_THRESHOLD_PERCENT) {
    const totalWeight = candidates.reduce((sum, c) => sum + c.confidence, 0);
    const weightedSum = candidates.reduce((sum, c) => sum + c.value * c.confidence, 0);
    return {
      value: Math.round((weightedSum / totalWeight) * 100) / 100,
      resolution: 'weighted_average',
      variancePercent,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 5: High variance fallback - use highest confidence with chunk tiebreaker
  // ─────────────────────────────────────────────────────────────────────────
  const best = candidates.reduce((a, b) => {
    // Prefer higher confidence (which incorporates source type)
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

/**
 * Check if one source type clearly dominates and should be preferred
 * Returns the dominant candidate if there's a clear quality gap, null otherwise
 *
 * A source is "dominant" if:
 * - It's from a higher-tier source type (table > primary > overlap > inferred)
 * - AND there's no equally-authoritative opposing candidate
 */
function checkSourceQualityDominance(
  candidates: ValueCandidate[]
): ValueCandidate | null {
  // Group candidates by source type tier
  const tiers: Record<string, ValueCandidate[]> = {
    table: [],
    primary: [],
    overlap: [],
    inferred: [],
  };

  for (const c of candidates) {
    tiers[c.sourceType]?.push(c);
  }

  // Check tiers in order of authority
  const tierOrder: Array<'table' | 'primary' | 'overlap' | 'inferred'> = [
    'table', 'primary', 'overlap', 'inferred'
  ];

  for (const tier of tierOrder) {
    const tierCandidates = tiers[tier];
    if (tierCandidates.length === 0) continue;

    // Check if ALL candidates in higher tiers agree (or there's only one)
    const tierValues = tierCandidates.map((c) => c.value);
    const tierVariance = calculateVariance(tierValues);

    if (tierVariance < MERGE_CONFIG.SOURCE_DOMINANCE_VARIANCE_THRESHOLD) {
      // This tier has consistent values - check if lower tiers disagree
      const lowerTierIndex = tierOrder.indexOf(tier);
      const lowerTiers = tierOrder.slice(lowerTierIndex + 1);
      const hasLowerTierConflict = lowerTiers.some((t) => {
        const lower = tiers[t];
        if (lower.length === 0) return false;
        // Check if lower tier values differ significantly from this tier
        const lowerValues = lower.map((c) => c.value);
        const crossVariance = calculateVariance([...tierValues, ...lowerValues]);
        return crossVariance > MERGE_CONFIG.SOURCE_DOMINANCE_VARIANCE_THRESHOLD;
      });

      if (hasLowerTierConflict) {
        // Higher-quality source disagrees with lower-quality - prefer higher
        // Return the highest-confidence candidate from this tier
        const best = tierCandidates.reduce((a, b) =>
          a.confidence > b.confidence ? a :
          a.confidence < b.confidence ? b :
          a.chunkIndex < b.chunkIndex ? a : b
        );
        return best;
      }
    }

    // Inconsistent top-tier candidates — no single tier wins.
    // Return null so caller falls through to weighted_average or highest_confidence.
    break;
  }

  return null;
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

      // Check for table-vs-table conflicts (most significant data integrity issue)
      const tableCandidates = candidates.filter((c) => c.sourceType === 'table');
      if (tableCandidates.length >= 2) {
        const tableValues = tableCandidates.map((c) => c.value);
        const tableVariance = calculateVariance(tableValues);
        if (tableVariance >= MERGE_CONFIG.CONFLICT_THRESHOLD_PERCENT) {
          const descriptions = tableCandidates.map((c) => c.sourceDescription || `chunk ${c.chunkIndex}`).join(' vs ');
          console.warn(`⚠️ Table-vs-table conflict: ${year}/${metric} - ${descriptions} — using ${resolution}`);
        }
      }

      // Log conflict for debugging (gated behind DEBUG_FINANCIALS)
      if (DEBUG_FINANCIALS) {
        console.warn(
          `⚠️ Conflict detected: ${year}/${metric} - ` +
            `${candidates.length} values with ${variancePercent.toFixed(1)}% variance. ` +
            `Resolved to ${value} via ${resolution}. ` +
            `Values: [${candidates.map((c) => `${c.value} (chunk ${c.chunkIndex}, ${c.sourceType})`).join(', ')}]`
        );
      }
    }
  }

  // Handle nested objects (use legacy merge for now)
  mergeNestedObjects(extractions, merged);

  if (DEBUG_FINANCIALS) {
    console.log(
      `📊 Merge complete: ${totalMetrics} metrics, ${conflictsDetected} conflicts detected`
    );
  }

  return {
    metrics: merged,
    conflicts,
    totalMetrics,
    conflictsDetected,
    candidatesMap: valueMap,
  };
}

/**
 * Nested metric object type.
 * Includes string to accommodate fields such as senior_debt_interest_rate
 * (e.g. "prime + 2%", "8%") which are intentionally returned as strings by the AI.
 */
type NestedMetrics = Record<string, number | string | null>;

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
// Arithmetic Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate and correct metrics using accounting identities
 * If EBITDA doesn't match calculated value but a candidate does, use that candidate
 *
 * @param merged - Merged metrics by year
 * @param candidatesMap - Map of "year:metric" -> array of candidates
 * @returns Corrected metrics with validation notes
 */
export function validateArithmeticConsistency(
  merged: Record<string, YearMetrics>,
  candidatesMap: Map<string, ValueCandidate[]>
): { metrics: Record<string, YearMetrics>; corrections: string[] } {
  const corrections: string[] = [];
  const corrected = structuredClone(merged);

  for (const [year, metrics] of Object.entries(corrected)) {
    // EBITDA identity check: EBITDA = Net Income + Interest + Taxes + D&A
    const netIncome = metrics.net_income as number | null;
    const interest = metrics.interest as number | null;
    const taxes = metrics.taxes as number | null;
    const da = metrics.depreciation_amortization as number | null;
    const ebitda = metrics.ebitda as number | null;

    // NOTE: With the current extraction prompt, ebitda is always null from AI.
    // EBITDA is calculated deterministically in computeMetrics() from net_income + interest + taxes + D&A.
    // This block would activate if a future prompt change re-enables AI EBITDA extraction.
    // Only validate if we have all components
    if (netIncome != null && interest != null && taxes != null && da != null && ebitda != null) {
      const calculatedEbitda = netIncome + interest + taxes + da;
      const variance = Math.abs(ebitda - calculatedEbitda) / Math.abs(ebitda || 1);

      // If merged EBITDA doesn't match calculated (>5% variance), check candidates
      if (variance > 0.05) {
        const ebitdaCandidates = candidatesMap.get(`${year}:ebitda`);

        if (ebitdaCandidates && ebitdaCandidates.length > 1) {
          // Look for a candidate that matches the calculated value
          const matchingCandidate = ebitdaCandidates.find((c) => {
            const candidateVariance = Math.abs(c.value - calculatedEbitda) / Math.abs(calculatedEbitda || 1);
            return candidateVariance < 0.01; // Within 1%
          });

          if (matchingCandidate) {
            const oldValue = corrected[year].ebitda;
            corrected[year].ebitda = matchingCandidate.value;
            corrections.push(
              `${year}/ebitda: Arithmetic correction ${oldValue} → ${matchingCandidate.value} ` +
              `(matches calculated: ${netIncome} + ${interest} + ${taxes} + ${da} = ${calculatedEbitda})`
            );
            if (DEBUG_FINANCIALS) {
              console.log(`⚠️ Arithmetic correction for ${year}/ebitda: ${oldValue} → ${matchingCandidate.value}`);
            }
          } else {
            // No matching candidate - log warning but don't change
            corrections.push(
              `${year}/ebitda: Warning - EBITDA (${ebitda}) doesn't match calculated ` +
              `(${calculatedEbitda}), but no candidate matches. Variance: ${(variance * 100).toFixed(1)}%`
            );
          }
        }
      }
    }

    // Additional identity checks can be added here:
    // - Total Debt = Senior Debt + Subordinated Debt
    // - Total D&A = Equipment D&A + ROU D&A + Other D&A

    // Total Debt consistency check
    const seniorDebt = metrics.senior_debt as number | null;
    const totalDebt = metrics.total_debt as number | null;

    if (seniorDebt != null && totalDebt != null && seniorDebt > totalDebt) {
      // Senior debt cannot exceed total debt - likely a data error
      corrections.push(
        `${year}: Warning - Senior debt (${seniorDebt}) exceeds total debt (${totalDebt}). Data may be inconsistent.`
      );
    }
  }

  return { metrics: corrected, corrections };
}

// ─────────────────────────────────────────────────────────────────────────────
// Scale Normalization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply the AI-detected document scale to convert all currency values to thousands.
 *
 * The extraction prompt now instructs the AI to output values exactly as printed
 * and report the document's scale in extraction_metadata. This function reads that
 * metadata and applies the appropriate multiplier uniformly — eliminating the
 * inconsistent per-field conversion that caused 1,000x errors in million-denominated
 * documents (e.g., PBHC with $6.47B revenue).
 *
 * Scale mapping:
 * - "thousands"  → no-op (already in target unit)
 * - "millions"   → × 1,000
 * - "billions"   → × 1,000,000
 * - "raw_dollars"→ ÷ 1,000 (× 0.001)
 * - "unknown"    → skip (let heuristic checks handle it)
 *
 * Low-confidence detections are skipped so the downstream heuristic checks
 * (validateCrossMetricScale, normalizeScaleMismatch) act as the safety net.
 *
 * @param metrics  - Merged metrics by year (values still at document's native scale)
 * @param metadata - Extraction metadata from the AI, or null if unavailable
 * @returns Corrected metrics with a human-readable corrections log
 */
export function applyDetectedScale(
  metrics: Record<string, YearMetrics>,
  metadata: ExtractionMetadata | null
): ScaleNormalizationResult {
  const corrections: string[] = [];

  // Nothing to do if metadata is absent or scale is already thousands/unknown
  if (
    !metadata ||
    metadata.detected_scale === 'thousands' ||
    metadata.detected_scale === 'unknown'
  ) {
    return { metrics, corrections };
  }

  // Skip low-confidence detections — let heuristic checks handle ambiguous cases
  if (metadata.scale_confidence === 'low') {
    corrections.push(
      `Scale conversion skipped: detected_scale="${metadata.detected_scale}" but confidence is low — deferring to heuristic checks`
    );
    return { metrics, corrections };
  }

  let multiplier: number;
  switch (metadata.detected_scale) {
    case 'millions':
      multiplier = 1_000;
      break;
    case 'billions':
      multiplier = 1_000_000;
      break;
    case 'raw_dollars':
      multiplier = 1 / 1_000;
      break;
    default:
      // Exhaustive guard: any future detected_scale values fall through unchanged
      return { metrics, corrections };
  }

  const corrected = structuredClone(metrics);

  for (const [year, yearData] of Object.entries(corrected)) {
    let count = 0;

    // Scale all top-level currency metrics
    for (const metric of CURRENCY_METRICS) {
      const val = yearData[metric];
      if (typeof val === 'number' && val !== 0) {
        corrected[year][metric] = parseFloat((val * multiplier).toFixed(2));
        count++;
      }
    }

    // Scale nested objects (debt_components, fixed_charges, adjusted_ebitda_components)
    for (const nestedKey of NESTED_KEYS) {
      const nestedObj = corrected[year][nestedKey];
      if (nestedObj && typeof nestedObj === 'object') {
        for (const [key, val] of Object.entries(nestedObj as Record<string, unknown>)) {
          if (typeof val === 'number' && val !== 0) {
            (nestedObj as Record<string, unknown>)[key] = parseFloat((val * multiplier).toFixed(2));
            count++;
          }
        }
      }
    }

    corrections.push(
      `${year}: Applied ${metadata.detected_scale}→thousands conversion (×${multiplier}) to ${count} values` +
      ` (indicator: "${metadata.scale_indicator_found ?? 'none'}", confidence: ${metadata.scale_confidence})`
    );
  }

  return { metrics: corrected, corrections };
}

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
 * TODO: extraction_metadata.detected_scale (reported by the AI per chunk) is currently
 * not consumed here. Incorporating it could improve accuracy by letting the AI's own
 * scale assessment (e.g. "thousands", "millions") act as a first-pass filter before
 * the heuristic magnitude checks below run.
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
                (nestedObj as Record<string, unknown>)[key] = val / SCALE_VALIDATION.SCALE_FACTOR;
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
    // If EBITDA margin is impossibly low, Revenue may be at wrong scale.
    //
    // NOTE: yearData.ebitda is always null with the current extraction prompt —
    // EBITDA is computed deterministically in computeMetrics() from components.
    // We therefore build a proxy EBITDA from those same components so that this
    // scale check remains active regardless of whether the AI extracts ebitda.
    // ─────────────────────────────────────────────────────────────────────────

    // Build proxy EBITDA from components — matches calculateEBITDA null-handling:
    // net_income and D&A are required; interest and taxes default to 0 when missing.
    const interestRaw = yearData.interest as number | null | undefined;
    const taxesRaw = yearData.taxes as number | null | undefined;
    const daRaw = yearData.depreciation_amortization as number | null | undefined;

    const proxyEbitda =
      typeof netIncome === 'number' && typeof daRaw === 'number'
        ? netIncome + (typeof interestRaw === 'number' ? interestRaw : 0) +
          (typeof taxesRaw === 'number' ? taxesRaw : 0) + daRaw
        : null;

    // Check EBITDA margin if a proxy is available
    if (typeof proxyEbitda === 'number' && proxyEbitda > 0) {
      const ebitdaMargin = proxyEbitda / revenue;

      // If EBITDA margin < threshold, we have a scale mismatch
      if (ebitdaMargin < SCALE_VALIDATION.MIN_EBITDA_MARGIN) {
        const correctedRevenue = revenue / SCALE_VALIDATION.SCALE_FACTOR;
        const correctedMargin = proxyEbitda / correctedRevenue;

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

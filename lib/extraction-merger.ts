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

import { MERGE_CONFIG, SCALE_VALIDATION, CURRENCY_METRICS, CANONICAL_STATEMENT_MAP } from './constants';
import { isTableSource } from './validation';
import type { ExtractionMetadata } from './chunk-processor';
import type { SourceStatementType } from '@/types/extraction';

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
  /** Which financial statement this value was extracted from */
  sourceStatement: SourceStatementType;
}

/**
 * Conflict information for a metric
 */
export interface MetricConflict {
  year: string;
  metric: string;
  candidates: ValueCandidate[];
  resolvedValue: number;
  resolution: 'single' | 'highest_confidence' | 'weighted_average' | 'consensus' | 'near_consensus' | 'source_dominance' | 'canonical_statement';
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
          sourceStatement: sourceMetadata.sourceStatement,
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
  sourceStatement: SourceStatementType;
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
  const sourceStatements = metricsData?.[year]?._source_statements as Record<string, string> | undefined;

  const sourceDescription = sources?.[metric] || '';
  const confidenceLevel = (confidences?.[metric] || '') as 'high' | 'medium' | 'low' | '';

  // Read explicit source statement from AI, or infer from description
  let sourceStatement: SourceStatementType = 'unknown';
  const explicitStatement = sourceStatements?.[metric];
  if (explicitStatement && isValidSourceStatement(explicitStatement)) {
    sourceStatement = explicitStatement;
  } else {
    // Fallback: infer from sourceDescription string
    sourceStatement = inferSourceStatement(sourceDescription);
  }

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
    sourceStatement,
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

// Must stay in sync with SourceStatementType in types/extraction.ts
const VALID_SOURCE_STATEMENTS: Set<string> = new Set([
  'income_statement', 'cash_flow_statement', 'balance_sheet', 'notes', 'unknown',
]);

/**
 * Validate that a string is a valid SourceStatementType
 */
function isValidSourceStatement(value: string): value is SourceStatementType {
  return VALID_SOURCE_STATEMENTS.has(value);
}

/**
 * Infer source statement type from the source description string.
 * Used as fallback when _source_statements is absent.
 */
function inferSourceStatement(sourceDescription: string): SourceStatementType {
  if (!sourceDescription) return 'unknown';
  const desc = sourceDescription.toLowerCase();

  if (
    desc.includes('income statement') ||
    desc.includes('profit and loss') ||
    desc.includes('p&l') ||
    desc.includes('statement of operations') ||
    desc.includes('statement of earnings') ||
    desc.includes('statement of comprehensive income')
  ) {
    return 'income_statement';
  }
  if (
    desc.includes('cash flow') ||
    desc.includes('cashflow') ||
    desc.includes('operating activities') ||
    desc.includes('investing activities') ||
    desc.includes('financing activities')
  ) {
    return 'cash_flow_statement';
  }
  if (desc.includes('balance sheet') || desc.includes('financial position') || desc.includes('changes in equity')) {
    return 'balance_sheet';
  }
  if (
    desc.includes('note ') ||
    desc.includes('notes ') ||
    desc.includes('footnote') ||
    desc.includes('md&a') ||
    desc.includes("management's discussion") ||
    desc.includes('management discussion')
  ) {
    return 'notes';
  }
  return 'unknown';
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
  candidates: ValueCandidate[],
  metricName?: string
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
  // STEP 2.5: Canonical Statement Preference
  // When values disagree and this metric has a canonical statement,
  // prefer candidates from the canonical source.
  // ─────────────────────────────────────────────────────────────────────────
  if (metricName) {
    const canonicalResult = checkCanonicalStatementPreference(candidates, metricName);
    if (canonicalResult !== null) {
      return {
        value: canonicalResult.value,
        resolution: 'canonical_statement',
        variancePercent,
      };
    }
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
 * Check if candidates from the canonical statement should be preferred.
 * Returns the best canonical candidate if:
 * 1. This metric has a canonical statement in CANONICAL_STATEMENT_MAP
 * 2. At least one candidate is from the canonical statement
 * 3. Canonical candidates are internally consistent (variance < 5%)
 * 4. Not all candidates are 'unknown' (backward compat — skip when no tagging)
 */
function checkCanonicalStatementPreference(
  candidates: ValueCandidate[],
  metricName: string
): ValueCandidate | null {
  const canonicalStatement = CANONICAL_STATEMENT_MAP[metricName];
  if (!canonicalStatement) return null;

  // If all candidates are 'unknown', skip — no statement data to act on
  const allUnknown = candidates.every((c) => c.sourceStatement === 'unknown');
  if (allUnknown) return null;

  // Partition into canonical vs non-canonical
  const canonical = candidates.filter((c) => c.sourceStatement === canonicalStatement);
  const nonCanonical = candidates.filter((c) => c.sourceStatement !== canonicalStatement);

  if (canonical.length === 0) return null;

  // Check internal consistency of canonical group
  if (canonical.length > 1) {
    const canonicalValues = canonical.map((c) => c.value);
    const canonicalVariance = calculateVariance(canonicalValues);
    if (canonicalVariance >= MERGE_CONFIG.CONFLICT_THRESHOLD_PERCENT) {
      // Canonical sources disagree with each other — don't use this step
      return null;
    }
  }

  // Canonical group is consistent — pick highest confidence from canonical
  const best = canonical.reduce((a, b) => {
    if (a.confidence !== b.confidence) return a.confidence > b.confidence ? a : b;
    return a.chunkIndex < b.chunkIndex ? a : b;
  });

  // Log when non-canonical values are discarded
  if (nonCanonical.length > 0 && DEBUG_FINANCIALS) {
    const discarded = nonCanonical.map(
      (c) => `${c.value} (${c.sourceStatement}, chunk ${c.chunkIndex})`
    ).join(', ');
    console.log(
      `[canonical] ${metricName}: selected ${best.value} from ${canonicalStatement}, ` +
      `discarded non-canonical: [${discarded}]`
    );
  }

  return best;
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

    // Resolve conflict (pass metric name for canonical statement preference)
    const { value, resolution, variancePercent } = resolveConflict(candidates, metric);
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

  // Handle nested objects with conflict-aware per-field resolution
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
 * A candidate value for a nested sub-field, collected across chunks.
 * Simpler than ValueCandidate — nested fields don't have their own _sources entries.
 */
interface NestedValueCandidate {
  value: number | string;
  chunkIndex: number;
  confidence: number;
}

/**
 * Collect all values for each nested sub-field across all chunks.
 * Key format: "year:nestedKey:subField" (e.g. "2023:adjusted_ebitda_components:stock_based_compensation")
 *
 * Since nested fields don't have their own _sources entries we fall back to
 * the chunk-level source quality via getSourceMetadata on a representative flat
 * metric, defaulting to 'primary' confidence when no metadata is available.
 */
function collectNestedValues(
  extractions: ExtractionInput[]
): Map<string, NestedValueCandidate[]> {
  const valueMap = new Map<string, NestedValueCandidate[]>();

  for (let chunkIndex = 0; chunkIndex < extractions.length; chunkIndex++) {
    const obj = extractions[chunkIndex];
    if (!obj || typeof obj !== 'object' || !obj.metrics_by_year) continue;

    for (const [year, metrics] of Object.entries(obj.metrics_by_year)) {
      if (!metrics || typeof metrics !== 'object') continue;

      // Derive a chunk-level confidence score from the first available flat metric
      // in this year. Nested fields inherit from their parent chunk quality.
      const representativeMetric = Object.keys(metrics).find((k) => !NESTED_KEYS.includes(k));
      const chunkConfidence = representativeMetric
        ? MERGE_CONFIG.SOURCE_WEIGHTS[getSourceMetadata(obj as Record<string, unknown>, year, representativeMetric).sourceType]
        : MERGE_CONFIG.SOURCE_WEIGHTS['primary'];

      for (const nestedKey of NESTED_KEYS) {
        const nestedValue = metrics[nestedKey];
        if (nestedValue == null || typeof nestedValue !== 'object') continue;

        for (const [subField, subValue] of Object.entries(nestedValue as NestedMetrics)) {
          if (subValue == null) continue;

          const key = `${year}:${nestedKey}:${subField}`;
          if (!valueMap.has(key)) {
            valueMap.set(key, []);
          }

          valueMap.get(key)!.push({
            value: subValue,
            chunkIndex,
            confidence: chunkConfidence,
          });
        }
      }
    }
  }

  return valueMap;
}

/**
 * Resolve conflicts for a single nested sub-field across its candidates.
 *
 * Strategy (simplified — nested fields have fewer candidates than flat metrics):
 * 1. Single candidate   → use it directly
 * 2. All agree          → use highest-confidence candidate
 * 3. String values      → prefer lowest chunk index (strings can't be averaged)
 * 4. Numeric conflict   → pick highest confidence, then lowest chunk index as tiebreaker
 *
 * @returns The resolved value and whether a true conflict was detected
 */
function resolveNestedConflict(candidates: NestedValueCandidate[]): {
  value: number | string;
  hasConflict: boolean;
} {
  if (candidates.length === 1) {
    return { value: candidates[0].value, hasConflict: false };
  }

  // Check consensus — all candidates share the same value
  const firstValue = candidates[0].value;
  const allAgree = candidates.every((c) => c.value === firstValue);
  if (allAgree) {
    const best = candidates.reduce((a, b) =>
      a.confidence >= b.confidence ? a : b
    );
    return { value: best.value, hasConflict: false };
  }

  // String values: pick lowest chunk index (no meaningful average possible)
  if (typeof firstValue === 'string' || candidates.some((c) => typeof c.value === 'string')) {
    const best = candidates.reduce((a, b) =>
      a.chunkIndex <= b.chunkIndex ? a : b
    );
    return { value: best.value, hasConflict: true };
  }

  // Numeric conflict: highest confidence wins, lowest chunk index as tiebreaker
  const best = candidates.reduce((a, b) => {
    if (a.confidence !== b.confidence) {
      return a.confidence > b.confidence ? a : b;
    }
    return a.chunkIndex < b.chunkIndex ? a : b;
  });

  return { value: best.value, hasConflict: true };
}

/**
 * Merge nested objects (debt_components, fixed_charges, adjusted_ebitda_components)
 * using conflict-aware per-field resolution instead of first-non-null.
 *
 * Each sub-field is resolved independently so that a high-quality value from
 * chunk 2 can win over a stale value from chunk 1 rather than always deferring
 * to whichever chunk arrived first.
 */
function mergeNestedObjects(
  extractions: ExtractionInput[],
  merged: Record<string, YearMetrics>
): void {
  const nestedValueMap = collectNestedValues(extractions);

  for (const [key, candidates] of nestedValueMap.entries()) {
    // Key format: "year:nestedKey:subField"
    const colonIndex = key.indexOf(':');
    const secondColonIndex = key.indexOf(':', colonIndex + 1);
    const year = key.slice(0, colonIndex);
    const nestedKey = key.slice(colonIndex + 1, secondColonIndex);
    const subField = key.slice(secondColonIndex + 1);

    // Ensure parent objects exist in the merged output
    if (!merged[year]) {
      merged[year] = {};
    }
    if (merged[year][nestedKey] == null) {
      merged[year][nestedKey] = {} as NestedMetrics;
    }

    const { value, hasConflict } = resolveNestedConflict(candidates);
    (merged[year][nestedKey] as NestedMetrics)[subField] = value;

    if (hasConflict) {
      const candidateSummary = candidates
        .map((c) => `${JSON.stringify(c.value)} (chunk ${c.chunkIndex}, conf ${c.confidence.toFixed(2)})`)
        .join(', ');

      // Unconditional warning for high-variance numeric conflicts on debt components.
      // Silent resolution of a $M+ debt figure can corrupt DSCR and Senior Debt/EBITDA.
      // String conflicts (e.g. senior_debt_interest_rate) are excluded — they have no
      // meaningful variance percentage and do not affect ratio calculations.
      const numericCandidates = candidates.filter((c) => typeof c.value === 'number');
      if (numericCandidates.length >= 2 && nestedKey === 'debt_components') {
        const numericValues = numericCandidates.map((c) => c.value as number);
        const conflictVariance = calculateVariance(numericValues);
        if (conflictVariance > MERGE_CONFIG.CONFLICT_THRESHOLD_PERCENT) {
          console.warn(
            `Nested debt conflict: ${year}/${nestedKey}/${subField} — ` +
              `${conflictVariance.toFixed(1)}% variance across ${numericCandidates.length} chunks. ` +
              `Values: [${candidateSummary}] → resolved to ${JSON.stringify(value)}`
          );
        }
      }

      // Full detail gated behind DEBUG_FINANCIALS for all nested keys
      if (DEBUG_FINANCIALS) {
        console.warn(
          `Nested conflict: ${year}/${nestedKey}/${subField} — ` +
            `${candidates.length} values: [${candidateSummary}] → resolved to ${JSON.stringify(value)}`
        );
      }
    }
  }
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

    // Debt component identity check: sum(debt_components) should ≈ total_debt
    // Note: debt-calculator.ts prefers component sum over extracted total_debt.
    // This check validates the fallback case and surfaces extraction inconsistencies.
    const debtComponents = metrics.debt_components as Record<string, number | string | null> | null;
    const totalDebt = metrics.total_debt as number | null;

    if (debtComponents && totalDebt != null && totalDebt > 0) {
      const numericValues = Object.entries(debtComponents)
        .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] !== 0);

      const negativeComponents = numericValues.filter(([, v]) => v < 0);
      if (negativeComponents.length > 0) {
        corrections.push(
          `${year}: Warning - negative debt component values detected: ${negativeComponents.map(([k, v]) => `${k}=${v}`).join(', ')}. Likely extraction error.`
        );
      }

      const componentSum = numericValues
        .filter(([, v]) => v > 0)
        .reduce((sum, [, v]) => sum + v, 0);
      if (componentSum > 0) {
        // 2% tolerance allows for rounding across multiple line items while flagging material discrepancies
        const debtVariance = Math.abs(totalDebt - componentSum) / Math.abs(totalDebt);
        if (debtVariance > 0.02) {
          corrections.push(
            `${year}: Warning - extracted total_debt (${totalDebt}) diverges from ` +
            `debt_component sum (${componentSum.toFixed(0)}) by ${(debtVariance * 100).toFixed(1)}%. ` +
            `Review recommended — extracted total_debt may include non-financial liabilities.`
          );
        }
      }
    }

    // Enforce mutual exclusivity: aggregate bank debt fields vs granular.
    // When both are populated, zero the granular fields (prompt convention).
    if (debtComponents) {
      const aggBank = ((debtComponents.bank_debt_current as number) ?? 0) +
        ((debtComponents.bank_debt_long_term as number) ?? 0);
      const granBank = ((debtComponents.term_loans as number) ?? 0) +
        ((debtComponents.revolving_credit_facilities as number) ?? 0) +
        ((debtComponents.overdraft_facilities as number) ?? 0) +
        ((debtComponents.lines_of_credit as number) ?? 0);

      if (aggBank > 0 && granBank > 0) {
        const granularFields = ['term_loans', 'revolving_credit_facilities',
          'overdraft_facilities', 'lines_of_credit'];
        for (const f of granularFields) {
          (debtComponents as Record<string, number | null>)[f] = null;
        }
        corrections.push(
          `${year}: Dedup — aggregate bank debt (${aggBank}) and granular (${granBank}) ` +
          `both populated. Zeroed granular fields per prompt convention.`
        );
      }

      // Same pattern for lease liabilities: aggregate vs granular
      const aggLease = ((debtComponents.lease_liabilities_current as number) ?? 0) +
        ((debtComponents.lease_liabilities_long_term as number) ?? 0);
      const granLease = ((debtComponents.finance_lease_liabilities as number) ?? 0) +
        ((debtComponents.operating_lease_liabilities as number) ?? 0);

      if (aggLease > 0 && granLease > 0) {
        const granularLeaseFields = ['finance_lease_liabilities', 'operating_lease_liabilities'];
        for (const f of granularLeaseFields) {
          (debtComponents as Record<string, number | null>)[f] = null;
        }
        corrections.push(
          `${year}: Dedup — aggregate lease liabilities (${aggLease}) and granular (${granLease}) ` +
          `both populated. Zeroed granular fields per prompt convention.`
        );
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // D&A Component Identity Check
    // Total D&A aggregate ≥ sum of sub-components (sub-components may be partial
    // when not all categories appear in every document section).
    // A significant shortfall in the aggregate vs sub-component sum indicates
    // the AI may have only found a partial D&A figure (e.g., equipment only,
    // missing ROU / intangibles). Flag this so analysts can review.
    // ─────────────────────────────────────────────────────────────────────────
    const daAggregate = metrics.depreciation_amortization as number | null;
    const daEquipment = metrics.depreciation_equipment as number | null;
    const daRou = metrics.depreciation_rou as number | null;
    const daOther = metrics.depreciation_other as number | null;
    const daIntangibles = metrics.amortization_intangibles as number | null;

    const daSubComponents = [daEquipment, daRou, daOther, daIntangibles].filter(
      (v): v is number => typeof v === 'number'
    );

    if (daAggregate != null && daSubComponents.length > 0) {
      const daComponentSum = daSubComponents.reduce((sum, v) => sum + v, 0);

      // Aggregate should be >= component sum (components may be partial).
      // Flag if the aggregate is more than 5% BELOW the component sum — that
      // means sub-components exceed the total, which is arithmetically impossible
      // and indicates a partial-total extraction error.
      if (daComponentSum > 0 && daAggregate < daComponentSum * 0.95) {
        corrections.push(
          `${year}/depreciation_amortization: Warning — aggregate D&A (${daAggregate}) is less than ` +
          `sub-component sum (${daComponentSum.toFixed(0)}) ` +
          `[equip=${daEquipment ?? 0}, rou=${daRou ?? 0}, other=${daOther ?? 0}, intang=${daIntangibles ?? 0}]. ` +
          `Aggregate may be a partial figure (e.g., equipment-only). Review recommended.`
        );
        if (DEBUG_FINANCIALS) {
          console.warn(
            `⚠️ D&A component check ${year}: aggregate ${daAggregate} < ` +
            `sub-sum ${daComponentSum.toFixed(0)}. Possible partial extraction.`
          );
        }
      }

      // Also flag when the aggregate is more than 50% ABOVE the component sum and
      // multiple sub-components were found — suggests a component is missing.
      // Threshold is intentionally wide to avoid false positives on documents that
      // legitimately show only a subset of categories.
      if (daSubComponents.length >= 2 && daComponentSum > 0 && daAggregate > daComponentSum * 1.50) {
        corrections.push(
          `${year}/depreciation_amortization: Info — aggregate D&A (${daAggregate}) exceeds ` +
          `sub-component sum (${daComponentSum.toFixed(0)}) by more than 50%. ` +
          `A D&A category may be missing from the breakdown (e.g., amortization of intangibles not found separately).`
        );
      }
    }

    // Senior debt cannot exceed total debt
    const seniorDebt = metrics.senior_debt as number | null;

    if (seniorDebt != null && totalDebt != null && seniorDebt > totalDebt) {
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
        ? netIncome + (typeof interestRaw === 'number' && interestRaw > 0 ? interestRaw : 0) +
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

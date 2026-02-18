/**
 * Extraction Reconciler
 * Replaces the "first non-null wins" merge strategy with intelligent
 * conflict detection and AI-powered reconciliation.
 *
 * This ensures deterministic extraction by:
 * 1. Collecting ALL extracted values per metric (not first-wins)
 * 2. Identifying conflicts (same metric, different non-null values)
 * 3. Using AI reasoning to resolve conflicts based on source authority
 */

// Legacy OpenAI import - commented out for Claude migration
// import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { AI_CONFIG } from './constants';
import {
  RECONCILIATION_PROMPT,
  buildReconciliationRequest,
} from './prompts/reconciliation-prompt';
import { cleanJsonFence } from './chunk-processor';
import type {
  ChainOfThoughtValue,
  ExtractionCandidate,
  ReconciliationReport,
  ReconciliationResult,
} from '@/types';

// Legacy OpenAI client - commented out for Claude migration
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Anthropic Claude client for reconciliation
const anthropic = new Anthropic();

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface MetricValue {
  value: number | null;
  confidence: string;
  source: string;
  reasoning: string;
}

interface ChunkExtraction {
  chunk_index: number;
  metrics_by_year: Record<string, Record<string, MetricValue | Record<string, MetricValue> | null>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reconcile extractions from multiple chunks into a single consistent result
 *
 * @param extractions - Array of extraction results from sequential chunk processing
 * @returns Reconciliation report with merged metrics and conflict resolutions
 */
export async function reconcileExtractions(
  extractions: ChunkExtraction[]
): Promise<ReconciliationReport> {
  console.log('\n🔄 RECONCILIATION PHASE');
  console.log(`   Processing ${extractions.length} chunk extractions`);

  // Step 1: Collect all years and all values per metric
  const allYears = collectAllYears(extractions);
  const valuesByMetric = collectAllValues(extractions);

  console.log(`   Found years: ${[...allYears].join(', ')}`);

  // Step 2: Identify conflicts
  const conflicts = identifyConflicts(valuesByMetric);

  console.log(`   Found ${conflicts.length} metric conflicts to resolve`);

  // Step 3: Resolve conflicts via AI (if any)
  let resolutions: ReconciliationResult[] = [];
  if (conflicts.length > 0) {
    resolutions = await resolveConflictsWithAI(conflicts);
  }

  // Step 4: Build final merged result (ensure all years are included)
  const merged = buildMergedResult(valuesByMetric, resolutions, allYears, extractions);

  // Step 5: Log reconciliation summary
  logReconciliationSummary(conflicts, resolutions);

  return {
    total_metrics: countTotalMetrics(valuesByMetric),
    conflicts_detected: conflicts.length,
    conflicts_resolved: resolutions.length,
    resolutions,
    merged_metrics: merged,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: Collect All Years and Values
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Collect all years that appear in any extraction
 */
function collectAllYears(extractions: ChunkExtraction[]): Set<string> {
  const years = new Set<string>();
  for (const extraction of extractions) {
    for (const year of Object.keys(extraction.metrics_by_year)) {
      years.add(year);
    }
  }
  return years;
}

/**
 * Collect all extracted values for each metric from all chunks
 * Key format: "year:metric" or "year:nested.metric" for nested objects
 */
function collectAllValues(
  extractions: ChunkExtraction[]
): Map<string, ChainOfThoughtValue[]> {
  const valuesByMetric = new Map<string, ChainOfThoughtValue[]>();

  for (const extraction of extractions) {
    const chunkIndex = extraction.chunk_index;

    for (const [year, yearMetrics] of Object.entries(extraction.metrics_by_year)) {
      if (!yearMetrics) continue;

      // Process top-level metrics
      for (const [metric, metricData] of Object.entries(yearMetrics)) {
        if (metricData === null) continue;

        // Handle nested objects (debt_components, fixed_charges, adjusted_ebitda_components)
        if (
          metric === 'debt_components' ||
          metric === 'fixed_charges' ||
          metric === 'adjusted_ebitda_components'
        ) {
          const nestedObj = metricData as Record<string, MetricValue | null>;
          for (const [nestedKey, nestedData] of Object.entries(nestedObj)) {
            if (nestedData === null) continue;
            if (typeof nestedData === 'object' && 'value' in nestedData) {
              addValueToCollection(
                valuesByMetric,
                `${year}:${metric}.${nestedKey}`,
                nestedData as MetricValue,
                chunkIndex
              );
            }
          }
        } else {
          // Regular metric with confidence metadata
          if (typeof metricData === 'object' && 'value' in metricData) {
            addValueToCollection(
              valuesByMetric,
              `${year}:${metric}`,
              metricData as MetricValue,
              chunkIndex
            );
          }
        }
      }
    }
  }

  return valuesByMetric;
}

function addValueToCollection(
  collection: Map<string, ChainOfThoughtValue[]>,
  key: string,
  data: MetricValue,
  chunkIndex: number
): void {
  // Skip null values - they don't contribute to conflicts
  if (data.value === null) return;

  const existing = collection.get(key) || [];
  existing.push({
    value: data.value,
    confidence: data.confidence as 'high' | 'medium' | 'low',
    source_description: data.source || '',
    reasoning: data.reasoning || '',
    chunk_index: chunkIndex,
  });
  collection.set(key, existing);
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2: Identify Conflicts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Identify metrics where multiple chunks extracted different non-null values
 */
function identifyConflicts(
  valuesByMetric: Map<string, ChainOfThoughtValue[]>
): ExtractionCandidate[] {
  const conflicts: ExtractionCandidate[] = [];

  for (const [key, candidates] of valuesByMetric.entries()) {
    // Need at least 2 values to have a potential conflict
    if (candidates.length < 2) continue;

    // Check if values are actually different
    const uniqueValues = new Set(candidates.map((c) => c.value));
    if (uniqueValues.size === 1) continue; // All same value, no conflict

    // Parse key to get year and metric
    const [year, metric] = key.split(':');

    conflicts.push({
      metric,
      year,
      candidates,
      has_conflict: true,
    });

    console.log(
      `   ⚠️  Conflict: ${metric} (${year}) has ${candidates.length} different values: [${candidates.map((c) => c.value).join(', ')}]`
    );
  }

  return conflicts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3: Resolve Conflicts with AI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Use AI to resolve conflicts by reasoning about source authority and consistency
 */
async function resolveConflictsWithAI(
  conflicts: ExtractionCandidate[]
): Promise<ReconciliationResult[]> {
  console.log('\n   🤖 Calling AI to resolve conflicts...');

  // Build request for AI
  const requestData = conflicts.map((c) => ({
    metric: c.metric,
    year: c.year,
    candidates: c.candidates.map((cand) => ({
      value: cand.value,
      confidence: cand.confidence,
      source: cand.source_description,
      reasoning: cand.reasoning,
      chunk_index: cand.chunk_index,
    })),
  }));

  const requestJson = buildReconciliationRequest(requestData);

  try {
    // Legacy OpenAI call - commented out for Claude migration
    // const response = await openai.chat.completions.create({
    //   model: AI_CONFIG.MODEL,
    //   temperature: 0,
    //   max_tokens: 2000,
    //   messages: [
    //     { role: 'system', content: RECONCILIATION_PROMPT },
    //     { role: 'user', content: requestJson },
    //   ],
    // });

    // Claude API call for conflict reconciliation
    const response = await anthropic.messages.create({
      model: AI_CONFIG.MODEL,
      max_tokens: 2000,
      temperature: 0, // Deterministic
      system: RECONCILIATION_PROMPT,
      messages: [
        { role: 'user', content: requestJson },
      ],
    });

    // Extract text from Claude response
    const textBlock = response.content.find((block) => block.type === 'text');
    const responseText = textBlock?.type === 'text' ? textBlock.text : '{}';
    console.log(`   📄 Reconciliation AI response received`);

    const cleaned = cleanJsonFence(responseText);
    const parsed = JSON.parse(cleaned);

    if (parsed.resolutions && Array.isArray(parsed.resolutions)) {
      return parsed.resolutions.map((r: {
        metric: string;
        year: string;
        resolved_value: number | null;
        reasoning?: string;
        selected_candidate_index?: number;
      }) => ({
        metric: r.metric,
        year: r.year,
        resolved_value: r.resolved_value,
        reasoning: r.reasoning || '',
        selected_candidate_index: r.selected_candidate_index ?? 0,
        selected_source: conflicts
          .find((c) => c.metric === r.metric && c.year === r.year)
          ?.candidates[r.selected_candidate_index ?? 0]?.source_description || '',
      }));
    }

    return [];
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('   ❌ Reconciliation AI call failed:', errorMessage);
    // Fallback: use highest confidence value for each conflict
    return conflicts.map((c) => fallbackResolution(c));
  }
}

/**
 * Fallback resolution when AI fails: pick highest confidence, then highest value
 */
function fallbackResolution(conflict: ExtractionCandidate): ReconciliationResult {
  const confidenceOrder = { high: 3, medium: 2, low: 1 };

  // Sort by confidence (descending), then by value (descending)
  const sorted = [...conflict.candidates].sort((a, b) => {
    const confDiff =
      (confidenceOrder[b.confidence] || 0) - (confidenceOrder[a.confidence] || 0);
    if (confDiff !== 0) return confDiff;
    return (b.value ?? 0) - (a.value ?? 0);
  });

  const selected = sorted[0];
  const selectedIndex = conflict.candidates.indexOf(selected);

  return {
    metric: conflict.metric,
    year: conflict.year,
    resolved_value: selected.value,
    reasoning: `Fallback resolution: selected highest confidence (${selected.confidence}) value`,
    selected_candidate_index: selectedIndex,
    selected_source: selected.source_description,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4: Build Merged Result
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build final merged metrics using non-conflicting values and AI resolutions
 * Ensures all years from extractions are included in output
 */
function buildMergedResult(
  valuesByMetric: Map<string, ChainOfThoughtValue[]>,
  resolutions: ReconciliationResult[],
  allYears: Set<string>,
  extractions: ChunkExtraction[]
): Record<string, Record<string, number | null | Record<string, number | null>>> {
  const merged: Record<string, Record<string, number | null | Record<string, number | null>>> = {};

  // Initialize all years (ensures years with only null values still appear)
  for (const year of allYears) {
    merged[year] = {};
  }

  // First pass: copy all raw values from extractions (first-wins for base structure)
  for (const extraction of extractions) {
    for (const [year, yearMetrics] of Object.entries(extraction.metrics_by_year)) {
      if (!merged[year]) {
        merged[year] = {};
      }

      for (const [metric, metricData] of Object.entries(yearMetrics)) {
        if (metricData === null) continue;

        // Handle nested objects
        if (
          metric === 'debt_components' ||
          metric === 'fixed_charges' ||
          metric === 'adjusted_ebitda_components'
        ) {
          if (!merged[year][metric]) {
            merged[year][metric] = {} as Record<string, number | null>;
          }
          const nestedObj = metricData as Record<string, MetricValue>;
          for (const [nestedKey, nestedData] of Object.entries(nestedObj)) {
            const existingNested = merged[year][metric] as Record<string, number | null>;
            // Only set if not already set (first-wins)
            if (existingNested[nestedKey] === undefined && nestedData?.value !== undefined) {
              existingNested[nestedKey] = nestedData.value;
            }
          }
        } else {
          // Regular metric - only set if not already set
          if (merged[year][metric] === undefined) {
            const data = metricData as MetricValue;
            merged[year][metric] = data?.value ?? null;
          }
        }
      }
    }
  }

  // Second pass: apply reconciled values (overrides first-wins for conflicts)
  const resolutionLookup = new Map<string, number | null>();
  for (const r of resolutions) {
    resolutionLookup.set(`${r.year}:${r.metric}`, r.resolved_value);
  }

  for (const [key, candidates] of valuesByMetric.entries()) {
    const [year, metricPath] = key.split(':');

    // Determine final value
    let finalValue: number | null;

    if (resolutionLookup.has(key)) {
      // Use AI resolution for conflicts
      finalValue = resolutionLookup.get(key) ?? null;
    } else if (candidates.length > 1) {
      // Multiple same values - use first (they're all the same)
      finalValue = candidates[0].value;
    } else {
      // Single value - already handled in first pass
      continue;
    }

    // Apply the resolved/confirmed value
    if (metricPath.includes('.')) {
      const [parent, child] = metricPath.split('.');
      if (!merged[year][parent]) {
        merged[year][parent] = {} as Record<string, number | null>;
      }
      (merged[year][parent] as Record<string, number | null>)[child] = finalValue;
    } else {
      merged[year][metricPath] = finalValue;
    }
  }

  return merged;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function countTotalMetrics(
  valuesByMetric: Map<string, ChainOfThoughtValue[]>
): number {
  return valuesByMetric.size;
}

function logReconciliationSummary(
  conflicts: ExtractionCandidate[],
  resolutions: ReconciliationResult[]
): void {
  if (conflicts.length === 0) {
    console.log('\n   ✅ No conflicts detected - all chunks agree on values');
    return;
  }

  console.log('\n   📋 RECONCILIATION SUMMARY:');
  for (const resolution of resolutions) {
    console.log(`   ─────────────────────────────────────`);
    console.log(`   Metric: ${resolution.metric} (${resolution.year})`);
    console.log(`   Resolved Value: ${resolution.resolved_value}`);
    console.log(`   Source: ${resolution.selected_source}`);
    console.log(`   Reasoning: ${resolution.reasoning}`);
  }
  console.log(`   ─────────────────────────────────────\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy Compatibility
// ─────────────────────────────────────────────────────────────────────────────

type NestedObject = Record<string, number | null>;

interface YearMetrics {
  debt_components?: NestedObject;
  fixed_charges?: NestedObject;
  adjusted_ebitda_components?: NestedObject;
  extraction_notes?: Record<string, string>;
  [key: string]: NestedObject | number | null | Record<string, string> | undefined;
}

interface Extraction {
  metrics_by_year?: Record<string, YearMetrics>;
  extraction_notes?: Record<string, string>;
}

/**
 * Convert extraction to internal format with confidence metadata
 */
export function convertLegacyExtraction(
  extraction: Extraction | null,
  chunkIndex: number
): ChunkExtraction {
  if (!extraction || !extraction.metrics_by_year) {
    return { chunk_index: chunkIndex, metrics_by_year: {} };
  }

  // Get extraction notes if available (for source info)
  const notes = extraction.extraction_notes || {};

  const converted: Record<string, Record<string, MetricValue | Record<string, MetricValue> | null>> = {};

  for (const [year, yearMetrics] of Object.entries(extraction.metrics_by_year)) {
    converted[year] = {};

    for (const [metric, value] of Object.entries(yearMetrics)) {
      // Skip extraction_notes field
      if (metric === 'extraction_notes') continue;

      // Handle nested objects
      if (
        metric === 'debt_components' ||
        metric === 'fixed_charges' ||
        metric === 'adjusted_ebitda_components'
      ) {
        if (value && typeof value === 'object') {
          converted[year][metric] = {};
          const nestedObj = value as NestedObject;
          for (const [nestedKey, nestedValue] of Object.entries(nestedObj)) {
            const noteKey = `${metric}.${nestedKey}`;
            (converted[year][metric] as Record<string, MetricValue>)[nestedKey] = {
              value: nestedValue,
              confidence: 'medium',
              source: notes[noteKey] || `Chunk ${chunkIndex}`,
              reasoning: notes[noteKey] || '',
            };
          }
        }
      } else {
        // Regular metric
        converted[year][metric] = {
          value: value as number | null,
          confidence: 'medium',
          source: notes[metric] || `Chunk ${chunkIndex}`,
          reasoning: notes[metric] || '',
        };
      }
    }
  }

  return { chunk_index: chunkIndex, metrics_by_year: converted };
}

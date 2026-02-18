/**
 * Accuracy Calculation Utilities for Benchmark Testing
 *
 * Compares extracted values against ground truth to determine
 * accuracy of text vs vision extraction pipelines.
 *
 * Methodology:
 * - Variance = abs((extracted - truth) / truth) * 100
 * - Accurate = variance < ACCURACY_THRESHOLD_PCT
 * - Winner = pipeline with higher accuracy percentage
 */

import { GroundTruthEntry } from "./ground-truth";
import { ComputedMetrics } from "@/types";

/**
 * Accuracy threshold percentage.
 * Values within this percentage of ground truth are considered accurate.
 * Default: 10% (configurable for different use cases)
 */
export const ACCURACY_THRESHOLD_PCT = 10;

/**
 * Result of comparing a single metric across both pipelines
 */
export interface AccuracyResult {
  /** Metric name being compared */
  metric: string;
  /** Ground truth value */
  truth: number;
  /** Value extracted by text pipeline (null if not extracted) */
  text_extracted: number | null;
  /** Value extracted by vision pipeline (null if not extracted) */
  vision_extracted: number | null;
  /** Text variance as percentage (null if extracted is null) */
  text_variance_pct: number | null;
  /** Vision variance as percentage (null if extracted is null) */
  vision_variance_pct: number | null;
  /** Whether text extraction is within accuracy threshold */
  text_accurate: boolean;
  /** Whether vision extraction is within accuracy threshold */
  vision_accurate: boolean;
}

/**
 * Summary of accuracy comparison for a document
 */
export interface AccuracySummary {
  /** Document identifier */
  document: string;
  /** Fiscal year */
  fiscal_year: string;
  /** Per-metric accuracy results */
  results: AccuracyResult[];
  /** Percentage of metrics where text is accurate (0-100) */
  text_accuracy_pct: number;
  /** Percentage of metrics where vision is accurate (0-100) */
  vision_accuracy_pct: number;
  /** Which pipeline performed better overall */
  winner: "text" | "vision" | "tie";
  /** Total metrics compared */
  metrics_compared: number;
  /** Number of metrics where text was accurate */
  text_accurate_count: number;
  /** Number of metrics where vision was accurate */
  vision_accurate_count: number;
}

/**
 * Mapping from ground truth value keys to ComputedMetrics keys
 * Some metrics have different names in ground truth vs extraction
 */
/**
 * Mapping from ground truth value keys to ComputedMetrics keys.
 * Only metrics present here will be compared for accuracy.
 * Add new metrics as they become available in ground truth data.
 */
const METRIC_MAPPING: Record<string, keyof ComputedMetrics> = {
  revenue: "revenue",
  net_income: "net_income",
  ebitda: "ebitda",
  adjusted_ebitda: "adjusted_ebitda",
  shareholders_equity: "shareholders_equity",
  total_debt: "total_debt",
  senior_debt: "senior_debt",
  fccr: "fccr",
};

/**
 * Calculate variance percentage between extracted and truth values.
 *
 * @param extracted - Value extracted by pipeline
 * @param truth - Ground truth value
 * @returns Variance as percentage, or null if extracted is null
 */
export function calculateVariance(
  extracted: number | null | undefined,
  truth: number
): number | null {
  // If extracted is null/undefined, return null
  if (extracted === null || extracted === undefined) {
    return null;
  }

  // Handle edge case where truth is 0
  // Use absolute difference instead of percentage to avoid division by zero
  if (truth === 0) {
    // If both are 0, variance is 0%
    if (extracted === 0) {
      return 0;
    }
    // If truth is 0 but extracted is not, this is infinite variance
    // Return a high value to indicate inaccuracy
    return 100;
  }

  // Standard percentage variance calculation
  return Math.abs((extracted - truth) / truth) * 100;
}

/**
 * Determine if a variance is within the accuracy threshold
 *
 * @param variance - Variance percentage (or null)
 * @param threshold - Accuracy threshold (default: ACCURACY_THRESHOLD_PCT)
 * @returns true if variance is within threshold, false otherwise
 */
export function isAccurate(
  variance: number | null,
  threshold: number = ACCURACY_THRESHOLD_PCT
): boolean {
  // Null variance means extraction failed - not accurate
  if (variance === null) {
    return false;
  }
  return variance < threshold;
}

/**
 * Extract a metric value from ComputedMetrics
 *
 * @param metrics - ComputedMetrics object (or null)
 * @param metricKey - Key to extract
 * @returns Value or null
 */
function extractMetricValue(
  metrics: ComputedMetrics | null,
  metricKey: keyof ComputedMetrics
): number | null {
  if (!metrics) {
    return null;
  }
  const value = metrics[metricKey];
  if (typeof value === "number") {
    return value;
  }
  return null;
}

/**
 * Calculate accuracy comparison between text and vision extraction.
 *
 * Compares each metric in ground truth against extracted values from
 * both pipelines and determines which pipeline is more accurate overall.
 *
 * @param truth - Ground truth entry with verified values
 * @param textMetrics - Metrics extracted by text pipeline (or null)
 * @param visionMetrics - Metrics extracted by vision pipeline (or null)
 * @param threshold - Optional custom accuracy threshold (default: ACCURACY_THRESHOLD_PCT)
 * @returns AccuracySummary with per-metric results and overall winner
 */
export function calculateAccuracy(
  truth: GroundTruthEntry,
  textMetrics: ComputedMetrics | null,
  visionMetrics: ComputedMetrics | null,
  threshold: number = ACCURACY_THRESHOLD_PCT
): AccuracySummary {
  const results: AccuracyResult[] = [];

  // Iterate over each metric in ground truth values
  for (const [truthKey, truthValue] of Object.entries(truth.values)) {
    // Skip null/undefined truth values
    if (truthValue === null || truthValue === undefined) {
      continue;
    }

    // Get the corresponding key in ComputedMetrics
    const metricsKey = METRIC_MAPPING[truthKey] as keyof ComputedMetrics;
    if (!metricsKey) {
      continue;
    }

    // Extract values from both pipelines
    const textValue = extractMetricValue(textMetrics, metricsKey);
    const visionValue = extractMetricValue(visionMetrics, metricsKey);

    // Calculate variances
    const textVariance = calculateVariance(textValue, truthValue);
    const visionVariance = calculateVariance(visionValue, truthValue);

    // Determine accuracy
    const textAccurate = isAccurate(textVariance, threshold);
    const visionAccurate = isAccurate(visionVariance, threshold);

    results.push({
      metric: truthKey,
      truth: truthValue,
      text_extracted: textValue,
      vision_extracted: visionValue,
      text_variance_pct: textVariance,
      vision_variance_pct: visionVariance,
      text_accurate: textAccurate,
      vision_accurate: visionAccurate,
    });
  }

  // Calculate overall accuracy percentages
  const metricsCompared = results.length;
  const textAccurateCount = results.filter((r) => r.text_accurate).length;
  const visionAccurateCount = results.filter((r) => r.vision_accurate).length;

  const textAccuracyPct =
    metricsCompared > 0 ? (textAccurateCount / metricsCompared) * 100 : 0;
  const visionAccuracyPct =
    metricsCompared > 0 ? (visionAccurateCount / metricsCompared) * 100 : 0;

  // Determine winner
  let winner: "text" | "vision" | "tie";
  if (textAccuracyPct > visionAccuracyPct) {
    winner = "text";
  } else if (visionAccuracyPct > textAccuracyPct) {
    winner = "vision";
  } else {
    winner = "tie";
  }

  return {
    document: truth.document,
    fiscal_year: truth.fiscal_year,
    results,
    text_accuracy_pct: textAccuracyPct,
    vision_accuracy_pct: visionAccuracyPct,
    winner,
    metrics_compared: metricsCompared,
    text_accurate_count: textAccurateCount,
    vision_accurate_count: visionAccurateCount,
  };
}

/**
 * Format accuracy result as a human-readable string
 *
 * @param result - AccuracyResult to format
 * @returns Formatted string for display
 */
export function formatAccuracyResult(result: AccuracyResult): string {
  const textStatus = result.text_accurate ? "PASS" : "FAIL";
  const visionStatus = result.vision_accurate ? "PASS" : "FAIL";

  const textVar =
    result.text_variance_pct !== null
      ? `${result.text_variance_pct.toFixed(1)}%`
      : "N/A";
  const visionVar =
    result.vision_variance_pct !== null
      ? `${result.vision_variance_pct.toFixed(1)}%`
      : "N/A";

  return `${result.metric}: Truth=${result.truth} | Text=${result.text_extracted ?? "null"} (${textVar}, ${textStatus}) | Vision=${result.vision_extracted ?? "null"} (${visionVar}, ${visionStatus})`;
}

/**
 * Format accuracy summary as a human-readable report
 *
 * @param summary - AccuracySummary to format
 * @returns Formatted multi-line string for display
 */
export function formatAccuracySummary(summary: AccuracySummary): string {
  const lines: string[] = [
    `=== ${summary.document} (FY${summary.fiscal_year}) ===`,
    `Metrics compared: ${summary.metrics_compared}`,
    `Text accuracy: ${summary.text_accurate_count}/${summary.metrics_compared} (${summary.text_accuracy_pct.toFixed(1)}%)`,
    `Vision accuracy: ${summary.vision_accurate_count}/${summary.metrics_compared} (${summary.vision_accuracy_pct.toFixed(1)}%)`,
    `Winner: ${summary.winner.toUpperCase()}`,
    "",
    "Per-metric results:",
    ...summary.results.map((r) => `  ${formatAccuracyResult(r)}`),
  ];

  return lines.join("\n");
}

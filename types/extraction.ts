/**
 * Chain-of-Thought Extraction Types
 * Types for confidence-scored extractions and conflict reconciliation
 */

// ─────────────────────────────────────────────────────────────────────────────
// Confidence Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The financial statement a metric was extracted from.
 * Used for canonical source preference during conflict resolution.
 */
export type SourceStatementType =
  | 'income_statement'
  | 'cash_flow_statement'
  | 'balance_sheet'
  | 'notes'
  | 'unknown';

/**
 * Confidence levels for extracted values
 * - high: Value found in primary financial statement (Income Statement, Balance Sheet, Cash Flow)
 * - medium: Value found in notes or supporting schedules
 * - low: Value inferred from context or calculated from other values
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * A single extracted value with chain-of-thought metadata
 */
export interface ChainOfThoughtValue {
  /** The extracted numeric value */
  value: number | null;
  /** Confidence level based on source authority */
  confidence: ConfidenceLevel;
  /** Description of where in the document the value was found */
  source_description: string;
  /** AI reasoning for why this value was extracted */
  reasoning: string;
  /** The chunk index this value came from */
  chunk_index: number;
  /** Which financial statement this value was extracted from */
  source_statement?: SourceStatementType;
}

/**
 * Collection of candidate values for a single metric
 * Used when multiple chunks extract different values for the same metric
 */
export interface ExtractionCandidate {
  /** The metric name (e.g., 'depreciation_amortization', 'net_income') */
  metric: string;
  /** The fiscal year this metric belongs to */
  year: string;
  /** All candidate values extracted from different chunks */
  candidates: ChainOfThoughtValue[];
  /** Whether there's a conflict (multiple different non-null values) */
  has_conflict: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraction Result Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Single metric extraction with confidence metadata
 */
export interface MetricWithConfidence {
  value: number | null;
  confidence: ConfidenceLevel;
  source_description: string;
  reasoning: string;
  /** Which financial statement this value was extracted from */
  source_statement?: SourceStatementType;
}

/**
 * Year metrics with confidence metadata for each field
 * This mirrors ExtractedMetrics but wraps each value with confidence info
 */
export interface MetricsWithConfidence {
  revenue: MetricWithConfidence;
  net_income: MetricWithConfidence;
  expenses: MetricWithConfidence;
  profit_margins: MetricWithConfidence;
  interest: MetricWithConfidence;
  taxes: MetricWithConfidence;
  depreciation_amortization: MetricWithConfidence;
  depreciation_equipment: MetricWithConfidence;
  depreciation_rou: MetricWithConfidence;
  depreciation_other: MetricWithConfidence;
  ebitda: MetricWithConfidence;
  reported_adjusted_ebitda: MetricWithConfidence;
  shareholders_equity: MetricWithConfidence;
  total_debt: MetricWithConfidence;
  senior_debt: MetricWithConfidence;
  capital_expenditures: MetricWithConfidence;
  proceeds_from_long_term_debt: MetricWithConfidence;
  cash_taxes_paid: MetricWithConfidence;
  distributions_paid: MetricWithConfidence;
  ttm_principal_payments: MetricWithConfidence;
  ttm_interest_expense: MetricWithConfidence;
  repayment_of_debt: MetricWithConfidence;
  payment_of_lease_liability: MetricWithConfidence;
  cash_interest_paid: MetricWithConfidence;
  non_cash_interest_expense: MetricWithConfidence;
  // Nested components use the original types - conflicts are resolved at the parent level
  debt_components: Record<string, MetricWithConfidence> | null;
  fixed_charges: Record<string, MetricWithConfidence> | null;
  adjusted_ebitda_components: Record<string, MetricWithConfidence> | null;
}

/**
 * Chunk extraction result with metadata
 */
export interface ChunkExtractionResult {
  /** Original chunk index (1-based) */
  chunk_index: number;
  /** Extracted metrics by year with confidence metadata */
  metrics_by_year: Record<string, MetricsWithConfidence>;
  /** Raw extraction without confidence (for backward compatibility) */
  raw_metrics?: Record<string, Record<string, number | null>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reconciliation Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A conflict that needs reconciliation
 */
export interface MetricConflict {
  /** The metric name */
  metric: string;
  /** The fiscal year */
  year: string;
  /** All candidate values with their sources */
  candidates: ChainOfThoughtValue[];
}

/**
 * Result of AI reconciliation for a single conflict
 */
export interface ReconciliationResult {
  /** The metric name */
  metric: string;
  /** The fiscal year */
  year: string;
  /** The resolved value */
  resolved_value: number | null;
  /** AI reasoning for the resolution */
  reasoning: string;
  /** Which candidate was selected (index into candidates array) */
  selected_candidate_index: number;
  /** The source description of the selected candidate */
  selected_source: string;
}

/**
 * Full reconciliation report for a document
 */
export interface ReconciliationReport {
  /** Total number of metrics extracted */
  total_metrics: number;
  /** Number of conflicts detected */
  conflicts_detected: number;
  /** Number of conflicts resolved */
  conflicts_resolved: number;
  /** Individual reconciliation results */
  resolutions: ReconciliationResult[];
  /** Final merged metrics by year */
  merged_metrics: Record<string, Record<string, number | null | Record<string, number | null>>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Processing State Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Accumulated state during sequential chunk processing
 */
export interface ExtractionState {
  /** All extractions indexed by chunk */
  extractions_by_chunk: Map<number, ChunkExtractionResult>;
  /** Conflicts detected (metric:year -> candidates) */
  conflicts: Map<string, ExtractionCandidate>;
  /** Final reconciled values */
  reconciled: Record<string, Record<string, number | null | Record<string, number | null>>>;
}

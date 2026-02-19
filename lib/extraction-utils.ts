import { Extraction, ExtractionResult } from '@/lib/supabase/types';
import { calculateQuantitativeRisk, type QuantitativeRiskAssessment } from '@/lib/quantitative-risk';
import type { ComputedMetrics, RiskData, DebtHealthAssessment } from '@/types';

export interface MergedExtraction {
  metrics_by_year: Record<string, ComputedMetrics>;
  riskAssessment?: RiskData | null;
  debtHealthAssessment?: DebtHealthAssessment | null;
  quantitativeRiskAssessment?: QuantitativeRiskAssessment | null;
  validation_issues?: Record<string, string[]>;
  extraction_warnings?: string[];
  chunk_stats?: { total: number; successful: number; failed: number };
  // Track which document each year's data came from
  year_sources: Record<string, { document_id: string; file_name: string; extracted_at: string; fiscal_year_end_date?: string }>;
  // The most recent fiscal year and its source
  most_recent_year?: string;
  most_recent_year_source?: { document_id: string; file_name: string };
}

export interface ExtractionWithDocument extends Extraction {
  documents?: {
    id: string;
    file_name: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Conflict Detection Types
// ─────────────────────────────────────────────────────────────────────────────

export interface YearConflict {
  year: string;
  existingSource: {
    document_id: string;
    file_name: string;
    fiscal_year_end_date: string | null;
    extracted_at: string;
  };
  newSource: {
    document_id: string;
    file_name: string;
    fiscal_year_end_date: string | null;
    extracted_at: string;
  };
  recommendation: 'keep_existing' | 'use_new';
  reason: string;
  /**
   * True when this conflicting year is the PRIMARY fiscal year reported
   * by the NEW document (i.e., the year that document is primarily about).
   */
  isPrimaryYearInNew: boolean;
  /**
   * True when this conflicting year is the PRIMARY fiscal year reported
   * by the EXISTING document (i.e., the year that document is primarily about).
   */
  isPrimaryYearInExisting: boolean;
}

export interface ConflictDetectionResult {
  hasConflicts: boolean;
  conflicts: YearConflict[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Fiscal Year Date Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a fiscal year end date string into a comparable Date object.
 * Handles formats: YYYY-MM-DD, YYYY-MM, or null/undefined
 */
export function parseFiscalYearEndDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;

  // Handle YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  }

  // Handle YYYY-MM format (assume last day of month)
  if (/^\d{4}-\d{2}$/.test(dateStr)) {
    const [year, month] = dateStr.split('-').map(Number);
    // Create date for first day of next month, then subtract one day
    const date = new Date(year, month, 0); // month is 1-indexed here, so this gives last day
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}

/**
 * Compare two fiscal year end dates.
 * Returns positive if dateA is more recent, negative if dateB is more recent, 0 if equal or both null.
 */
export function compareFiscalYearEndDates(
  dateA: string | null | undefined,
  dateB: string | null | undefined
): number {
  const parsedA = parseFiscalYearEndDate(dateA);
  const parsedB = parseFiscalYearEndDate(dateB);

  if (!parsedA && !parsedB) return 0;
  if (!parsedA) return -1; // B is more recent (A has no date)
  if (!parsedB) return 1;  // A is more recent (B has no date)

  return parsedA.getTime() - parsedB.getTime();
}

/**
 * Determine if new data is more recent than existing data for a given year.
 * Uses fiscal_year_end_date as primary comparison, falls back to extracted_at timestamp.
 */
export function isMoreRecent(
  newMetrics: { fiscal_year_end_date?: string | null; extracted_at: string },
  existingMetrics: { fiscal_year_end_date?: string | null; extracted_at: string }
): boolean {
  const fyComparison = compareFiscalYearEndDates(
    newMetrics.fiscal_year_end_date,
    existingMetrics.fiscal_year_end_date
  );

  // If fiscal year end dates are different, use that for comparison
  if (fyComparison !== 0) {
    return fyComparison > 0;
  }

  // Fall back to upload timestamp comparison
  return new Date(newMetrics.extracted_at) > new Date(existingMetrics.extracted_at);
}

// ─────────────────────────────────────────────────────────────────────────────
// Conflict Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect year conflicts between a new extraction and existing extractions.
 * Returns information about which years overlap and recommendations for resolution.
 */
export function detectYearConflicts(
  newExtraction: ExtractionWithDocument,
  existingExtractions: ExtractionWithDocument[]
): ConflictDetectionResult {
  const conflicts: YearConflict[] = [];

  if (!existingExtractions || existingExtractions.length === 0) {
    return { hasConflicts: false, conflicts: [] };
  }

  const newData = newExtraction.extraction_data as ExtractionResult;
  if (!newData.metrics_by_year) {
    return { hasConflicts: false, conflicts: [] };
  }

  const newYears = Object.keys(newData.metrics_by_year);
  const newFileName = newExtraction.documents?.file_name || 'New Document';

  // Build a map of existing year data (most recent per year based on fiscal year end date).
  // We also carry the primary_fiscal_year of the owning extraction so that when two
  // per-year fiscal_year_end_dates are equal (i.e. same year appears in both docs as
  // either primary or comparative), we can apply the primary-year tiebreaker.
  const existingYearData = new Map<string, {
    document_id: string;
    file_name: string;
    fiscal_year_end_date: string | null;
    extracted_at: string;
    metrics: Record<string, unknown>;
    /** The primary fiscal year of the extraction that contributed this entry. */
    primary_fiscal_year: string | null;
  }>();

  for (const extraction of existingExtractions) {
    const data = extraction.extraction_data as ExtractionResult;
    const fileName = extraction.documents?.file_name || 'Unknown';

    if (data.metrics_by_year) {
      for (const [year, metrics] of Object.entries(data.metrics_by_year)) {
        const existing = existingYearData.get(year);
        const newEntry = {
          document_id: extraction.document_id,
          file_name: fileName,
          fiscal_year_end_date: metrics.fiscal_year_end_date || null,
          extracted_at: extraction.created_at,
          metrics,
          primary_fiscal_year: data.primary_fiscal_year ?? null,
        };

        if (!existing) {
          existingYearData.set(year, newEntry);
        } else {
          // Keep the more recent one based on fiscal year end date
          if (isMoreRecent(
            { fiscal_year_end_date: newEntry.fiscal_year_end_date, extracted_at: newEntry.extracted_at },
            { fiscal_year_end_date: existing.fiscal_year_end_date, extracted_at: existing.extracted_at }
          )) {
            existingYearData.set(year, newEntry);
          }
        }
      }
    }
  }

  const newPrimaryFiscalYear = newData.primary_fiscal_year ?? null;

  // Check for conflicts
  for (const year of newYears) {
    const existing = existingYearData.get(year);
    if (!existing) continue; // No conflict for this year

    const newMetrics = newData.metrics_by_year[year];
    const newFiscalYearEnd = newMetrics.fiscal_year_end_date || null;

    // Determine whether this conflicting year is the primary year for each document.
    // A document is maximally authoritative for the year it was primarily created to report on.
    const isPrimaryYearInNew = newPrimaryFiscalYear === year;
    const isPrimaryYearInExisting = existing.primary_fiscal_year === year;

    const fyDateComparison = compareFiscalYearEndDates(newFiscalYearEnd, existing.fiscal_year_end_date);

    // Determine recommendation and reason
    let recommendation: 'keep_existing' | 'use_new';
    let reason: string;

    if (newFiscalYearEnd && existing.fiscal_year_end_date) {
      if (fyDateComparison > 0) {
        // New document has a strictly later fiscal year end — it is more recent
        recommendation = 'use_new';
        reason = `New document has a later fiscal year end (${newFiscalYearEnd}) than existing (${existing.fiscal_year_end_date})`;
      } else if (fyDateComparison < 0) {
        // Existing document has a strictly later fiscal year end — it is more recent
        recommendation = 'keep_existing';
        reason = `Existing document has a later fiscal year end (${existing.fiscal_year_end_date}) than new (${newFiscalYearEnd})`;
      } else {
        // Dates are equal — same fiscal year appears in both documents.
        // The document for which this is the PRIMARY reporting year is always more
        // authoritative than the document where it appears as a comparative figure.
        if (isPrimaryYearInNew && !isPrimaryYearInExisting) {
          recommendation = 'use_new';
          reason = `Year ${year} is the primary reporting year of the new document, making it the authoritative source`;
        } else if (isPrimaryYearInExisting && !isPrimaryYearInNew) {
          recommendation = 'keep_existing';
          reason = `Year ${year} is the primary reporting year of the existing document, making it the authoritative source`;
        } else {
          // Both or neither are primary — cannot determine authority automatically
          recommendation = 'keep_existing';
          reason = `Both documents cover year ${year} with equal authority; manual review suggested`;
        }
      }
    } else if (newFiscalYearEnd && !existing.fiscal_year_end_date) {
      // Can't reliably compare dates — apply primary-year tiebreaker first
      if (isPrimaryYearInNew && !isPrimaryYearInExisting) {
        recommendation = 'use_new';
        reason = `Year ${year} is the primary reporting year of the new document, making it the authoritative source`;
      } else if (isPrimaryYearInExisting && !isPrimaryYearInNew) {
        recommendation = 'keep_existing';
        reason = `Year ${year} is the primary reporting year of the existing document, making it the authoritative source`;
      } else {
        recommendation = 'keep_existing';
        reason = 'Cannot compare fiscal year end dates - keeping existing data (you can override)';
      }
    } else if (!newFiscalYearEnd && existing.fiscal_year_end_date) {
      // Can't reliably compare dates — apply primary-year tiebreaker first
      if (isPrimaryYearInNew && !isPrimaryYearInExisting) {
        recommendation = 'use_new';
        reason = `Year ${year} is the primary reporting year of the new document, making it the authoritative source`;
      } else if (isPrimaryYearInExisting && !isPrimaryYearInNew) {
        recommendation = 'keep_existing';
        reason = `Year ${year} is the primary reporting year of the existing document, making it the authoritative source`;
      } else {
        recommendation = 'keep_existing';
        reason = 'Cannot compare fiscal year end dates - keeping existing data (you can override)';
      }
    } else {
      // Neither has fiscal year end date — apply primary-year tiebreaker before
      // falling back to upload timestamp, which is the weakest possible signal.
      if (isPrimaryYearInNew && !isPrimaryYearInExisting) {
        recommendation = 'use_new';
        reason = `Year ${year} is the primary reporting year of the new document, making it the authoritative source`;
      } else if (isPrimaryYearInExisting && !isPrimaryYearInNew) {
        recommendation = 'keep_existing';
        reason = `Year ${year} is the primary reporting year of the existing document, making it the authoritative source`;
      } else {
        // Last resort: upload timestamp
        const newIsMoreRecentByTimestamp =
          new Date(newExtraction.created_at) > new Date(existing.extracted_at);
        if (newIsMoreRecentByTimestamp) {
          recommendation = 'use_new';
          reason = 'New document was uploaded more recently';
        } else {
          recommendation = 'keep_existing';
          reason = 'Existing document was uploaded more recently';
        }
      }
    }

    conflicts.push({
      year,
      existingSource: {
        document_id: existing.document_id,
        file_name: existing.file_name,
        fiscal_year_end_date: existing.fiscal_year_end_date,
        extracted_at: existing.extracted_at,
      },
      newSource: {
        document_id: newExtraction.document_id,
        file_name: newFileName,
        fiscal_year_end_date: newFiscalYearEnd,
        extracted_at: newExtraction.created_at,
      },
      recommendation,
      reason,
      isPrimaryYearInNew,
      isPrimaryYearInExisting,
    });
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// User Resolution Types
// ─────────────────────────────────────────────────────────────────────────────

export type ConflictResolution = Record<string, 'keep' | 'overwrite'>;

/**
 * Merge multiple extractions into a unified view.
 * For overlapping years, uses fiscal_year_end_date for recency comparison,
 * falling back to upload timestamp if dates are not available.
 * Risk assessments come from the document that has the most recent fiscal year.
 *
 * @param extractions - Array of extractions sorted by created_at DESC (newest first)
 * @param resolutions - Optional user-provided conflict resolutions (year -> 'keep' | 'overwrite')
 * @returns Merged extraction with year source tracking
 */
export function mergeExtractions(
  extractions: ExtractionWithDocument[],
  resolutions?: ConflictResolution
): MergedExtraction | null {
  if (!extractions || extractions.length === 0) {
    return null;
  }

  // If only one extraction, return it directly
  if (extractions.length === 1) {
    const data = extractions[0].extraction_data as ExtractionResult;
    const fileName = extractions[0].documents?.file_name || 'Unknown';

    const year_sources: Record<string, { document_id: string; file_name: string; extracted_at: string; fiscal_year_end_date?: string }> = {};
    const years = data.metrics_by_year ? Object.keys(data.metrics_by_year).sort() : [];

    for (const year of years) {
      const metrics = data.metrics_by_year[year];
      year_sources[year] = {
        document_id: extractions[0].document_id,
        file_name: fileName,
        extracted_at: extractions[0].created_at,
        fiscal_year_end_date: metrics.fiscal_year_end_date || undefined,
      };
    }

    const mostRecentYear = years[years.length - 1];

    return {
      // Cast is safe: ExtractionYearMetrics is structurally compatible with ComputedMetrics
      // as they share the same fields when stored/retrieved from database
      metrics_by_year: (data.metrics_by_year || {}) as unknown as Record<string, ComputedMetrics>,
      riskAssessment: data.riskAssessment as RiskData | null | undefined,
      debtHealthAssessment: data.debtHealthAssessment as DebtHealthAssessment | null | undefined,
      quantitativeRiskAssessment: data.quantitativeRiskAssessment as QuantitativeRiskAssessment | null | undefined,
      validation_issues: data.validation_issues,
      extraction_warnings: data.extraction_warnings,
      chunk_stats: data.chunk_stats,
      year_sources,
      most_recent_year: mostRecentYear,
      most_recent_year_source: mostRecentYear ? {
        document_id: extractions[0].document_id,
        file_name: fileName,
      } : undefined,
    };
  }

  // Multiple extractions - merge using fiscal year end date for recency comparison
  const merged: MergedExtraction = {
    metrics_by_year: {},
    year_sources: {},
  };

  // Create a map of extraction by document_id for quick lookup
  const extractionByDocId = new Map<string, ExtractionWithDocument>();
  for (const extraction of extractions) {
    extractionByDocId.set(extraction.document_id, extraction);
  }

  // Track year data with metadata for comparison
  interface YearEntry {
    metrics: Record<string, unknown>;
    document_id: string;
    file_name: string;
    extracted_at: string;
    fiscal_year_end_date: string | undefined;
  }

  const yearDataMap = new Map<string, YearEntry>();

  // Process all extractions and keep the most recent data for each year
  for (const extraction of extractions) {
    const data = extraction.extraction_data as ExtractionResult;
    const fileName = extraction.documents?.file_name || 'Unknown';

    if (data.metrics_by_year) {
      for (const [year, metrics] of Object.entries(data.metrics_by_year)) {
        const newEntry: YearEntry = {
          metrics,
          document_id: extraction.document_id,
          file_name: fileName,
          extracted_at: extraction.created_at,
          fiscal_year_end_date: metrics.fiscal_year_end_date || undefined,
        };

        const existing = yearDataMap.get(year);

        if (!existing) {
          yearDataMap.set(year, newEntry);
        } else {
          // Check if user provided a resolution for this year
          if (resolutions && resolutions[year]) {
            // User explicitly chose to keep or overwrite
            if (resolutions[year] === 'overwrite') {
              // Only overwrite if this is from the new document (last in array)
              // The new document is the first in the array (sorted DESC by created_at)
              if (extraction === extractions[0]) {
                yearDataMap.set(year, newEntry);
              }
            }
            // If 'keep', do nothing (keep existing)
          } else {
            // No user resolution - use fiscal year end date comparison
            const newIsMoreRecent = isMoreRecent(
              { fiscal_year_end_date: newEntry.fiscal_year_end_date || null, extracted_at: newEntry.extracted_at },
              { fiscal_year_end_date: existing.fiscal_year_end_date || null, extracted_at: existing.extracted_at }
            );

            if (newIsMoreRecent) {
              yearDataMap.set(year, newEntry);
            }
          }
        }
      }
    }
  }

  // Build merged result from yearDataMap
  for (const [year, entry] of yearDataMap.entries()) {
    merged.metrics_by_year[year] = entry.metrics as unknown as ComputedMetrics;
    merged.year_sources[year] = {
      document_id: entry.document_id,
      file_name: entry.file_name,
      extracted_at: entry.extracted_at,
      fiscal_year_end_date: entry.fiscal_year_end_date,
    };
  }

  // Find the most recent fiscal year in the merged data
  const allYears = Object.keys(merged.metrics_by_year).sort();
  const mostRecentYear = allYears[allYears.length - 1];

  if (mostRecentYear) {
    merged.most_recent_year = mostRecentYear;
    const sourceInfo = merged.year_sources[mostRecentYear];
    merged.most_recent_year_source = {
      document_id: sourceInfo.document_id,
      file_name: sourceInfo.file_name,
    };

    // Get the extraction that contributed the most recent year
    const sourceExtraction = extractionByDocId.get(sourceInfo.document_id);
    if (sourceExtraction) {
      const sourceData = sourceExtraction.extraction_data as ExtractionResult;

      // Use risk assessments from the document with the most recent fiscal year
      merged.riskAssessment = sourceData.riskAssessment as RiskData | null | undefined;
      merged.debtHealthAssessment = sourceData.debtHealthAssessment as DebtHealthAssessment | null | undefined;
      merged.validation_issues = sourceData.validation_issues;
      merged.extraction_warnings = sourceData.extraction_warnings;
      merged.chunk_stats = sourceData.chunk_stats;
    }
  }

  // RECALCULATE quantitative risk with ALL merged years
  // (don't copy from one document - it only has partial year coverage)
  merged.quantitativeRiskAssessment = calculateQuantitativeRisk(merged.metrics_by_year);

  // Fallback: if no risk assessments from the most recent year's document,
  // use the first available from any document (sorted by newest upload)
  if (!merged.riskAssessment) {
    for (const extraction of extractions) {
      const data = extraction.extraction_data as ExtractionResult;

      if (!merged.riskAssessment && data.riskAssessment) {
        merged.riskAssessment = data.riskAssessment as unknown as RiskData;
      }
      if (!merged.debtHealthAssessment && data.debtHealthAssessment) {
        merged.debtHealthAssessment = data.debtHealthAssessment as unknown as DebtHealthAssessment;
      }
      // Note: quantitativeRiskAssessment is always recalculated above, no fallback needed
      if (!merged.validation_issues && data.validation_issues) {
        merged.validation_issues = data.validation_issues;
      }
      if (!merged.extraction_warnings && data.extraction_warnings) {
        merged.extraction_warnings = data.extraction_warnings;
      }
      if (!merged.chunk_stats && data.chunk_stats) {
        merged.chunk_stats = data.chunk_stats;
      }
    }
  }

  return merged;
}

/**
 * Get a summary of documents and their year coverage
 */
export function getDocumentYearCoverage(extractions: ExtractionWithDocument[]): Array<{
  document_id: string;
  file_name: string;
  years: string[];
  uploaded_at: string;
  has_most_recent_year?: boolean;
}> {
  // Find the most recent year across all extractions
  let mostRecentYear: string | null = null;
  for (const extraction of extractions) {
    const data = extraction.extraction_data as ExtractionResult;
    if (data.metrics_by_year) {
      const years = Object.keys(data.metrics_by_year).sort();
      const maxYear = years[years.length - 1];
      if (!mostRecentYear || (maxYear && maxYear > mostRecentYear)) {
        mostRecentYear = maxYear;
      }
    }
  }

  return extractions.map((extraction) => {
    const data = extraction.extraction_data as ExtractionResult;
    const years = data.metrics_by_year ? Object.keys(data.metrics_by_year).sort() : [];

    return {
      document_id: extraction.document_id,
      file_name: extraction.documents?.file_name || 'Unknown',
      years,
      uploaded_at: extraction.created_at,
      has_most_recent_year: mostRecentYear ? years.includes(mostRecentYear) : false,
    };
  });
}

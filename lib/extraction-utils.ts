import { Extraction, ExtractionResult } from '@/lib/supabase/types';

export interface MergedExtraction {
  metrics_by_year: Record<string, any>;
  riskAssessment?: any;
  debtHealthAssessment?: any;
  quantitativeRiskAssessment?: any;
  validation_issues?: Record<string, string[]>;
  // Track which document each year's data came from
  year_sources: Record<string, { document_id: string; file_name: string; extracted_at: string }>;
  // The most recent fiscal year and its source
  most_recent_year?: string;
  most_recent_year_source?: { document_id: string; file_name: string };
}

interface ExtractionWithDocument extends Extraction {
  documents?: {
    id: string;
    file_name: string;
  };
}

/**
 * Merge multiple extractions into a unified view.
 * For overlapping years, the most recently uploaded document wins.
 * Risk assessments come from the document that has the most recent fiscal year.
 *
 * @param extractions - Array of extractions sorted by created_at DESC (newest first)
 * @returns Merged extraction with year source tracking
 */
export function mergeExtractions(extractions: ExtractionWithDocument[]): MergedExtraction | null {
  if (!extractions || extractions.length === 0) {
    return null;
  }

  // If only one extraction, return it directly
  if (extractions.length === 1) {
    const data = extractions[0].extraction_data as ExtractionResult;
    const fileName = extractions[0].documents?.file_name || 'Unknown';

    const year_sources: Record<string, { document_id: string; file_name: string; extracted_at: string }> = {};
    const years = data.metrics_by_year ? Object.keys(data.metrics_by_year).sort() : [];

    for (const year of years) {
      year_sources[year] = {
        document_id: extractions[0].document_id,
        file_name: fileName,
        extracted_at: extractions[0].created_at,
      };
    }

    const mostRecentYear = years[years.length - 1];

    return {
      metrics_by_year: data.metrics_by_year || {},
      riskAssessment: data.riskAssessment,
      debtHealthAssessment: data.debtHealthAssessment,
      quantitativeRiskAssessment: data.quantitativeRiskAssessment,
      validation_issues: data.validation_issues,
      year_sources,
      most_recent_year: mostRecentYear,
      most_recent_year_source: mostRecentYear ? {
        document_id: extractions[0].document_id,
        file_name: fileName,
      } : undefined,
    };
  }

  // Multiple extractions - merge with newest upload wins for overlapping years
  const merged: MergedExtraction = {
    metrics_by_year: {},
    year_sources: {},
  };

  // Create a map of extraction by document_id for quick lookup
  const extractionByDocId = new Map<string, ExtractionWithDocument>();
  for (const extraction of extractions) {
    extractionByDocId.set(extraction.document_id, extraction);
  }

  // Process from oldest to newest upload (reverse order)
  // This way newer uploads overwrite older ones for the same year
  const sortedOldestFirst = [...extractions].reverse();

  for (const extraction of sortedOldestFirst) {
    const data = extraction.extraction_data as ExtractionResult;
    const fileName = extraction.documents?.file_name || 'Unknown';

    if (data.metrics_by_year) {
      for (const [year, metrics] of Object.entries(data.metrics_by_year)) {
        // Overwrite with this document's data (newer upload will overwrite older)
        merged.metrics_by_year[year] = metrics;
        merged.year_sources[year] = {
          document_id: extraction.document_id,
          file_name: fileName,
          extracted_at: extraction.created_at,
        };
      }
    }
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
      merged.riskAssessment = sourceData.riskAssessment;
      merged.debtHealthAssessment = sourceData.debtHealthAssessment;
      merged.quantitativeRiskAssessment = sourceData.quantitativeRiskAssessment;
      merged.validation_issues = sourceData.validation_issues;
    }
  }

  // Fallback: if no risk assessments from the most recent year's document,
  // use the first available from any document (sorted by newest upload)
  if (!merged.riskAssessment || !merged.quantitativeRiskAssessment) {
    for (const extraction of extractions) {
      const data = extraction.extraction_data as ExtractionResult;

      if (!merged.riskAssessment && data.riskAssessment) {
        merged.riskAssessment = data.riskAssessment;
      }
      if (!merged.debtHealthAssessment && data.debtHealthAssessment) {
        merged.debtHealthAssessment = data.debtHealthAssessment;
      }
      if (!merged.quantitativeRiskAssessment && data.quantitativeRiskAssessment) {
        merged.quantitativeRiskAssessment = data.quantitativeRiskAssessment;
      }
      if (!merged.validation_issues && data.validation_issues) {
        merged.validation_issues = data.validation_issues;
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

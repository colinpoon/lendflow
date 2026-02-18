/**
 * Ground Truth Data for Benchmark Testing
 *
 * These values are manually verified from source PDF documents.
 * They serve as the baseline for accuracy comparison between
 * text extraction and vision extraction pipelines.
 *
 * IMPORTANT: Values marked with TODO must be manually verified
 * from the source PDFs before benchmarking is meaningful.
 */

/**
 * Ground truth entry for a single fiscal year of a document
 */
export interface GroundTruthEntry {
  /** Document identifier (e.g., "Zedcor-FY2024") */
  document: string;
  /** Exact filename in public/financialReports/ */
  filename: string;
  /** Fiscal year as string (e.g., "2024") */
  fiscal_year: string;
  /** Verified financial values */
  values: {
    // Core metrics for accuracy benchmarking
    revenue?: number;
    net_income?: number;
    ebitda?: number;
    adjusted_ebitda?: number;
    shareholders_equity?: number;
    total_debt?: number;
    senior_debt?: number;
    // fccr?: number;
  };
  /** Source documentation (e.g., "From consolidated income statement p.3") */
  source_notes?: string;
}

/**
 * Ground truth values for benchmark documents.
 *
 * IMPORTANT: All placeholder values (0) MUST be replaced with
 * manually verified values from the source PDFs before running
 * accuracy benchmarks. AI-extracted values should NOT be used
 * as ground truth.
 */
export const GROUND_TRUTH: GroundTruthEntry[] = [
  {
    document: 'Zedcor-FY2023',
    filename: '2023-12-31-Q4-Zedcor-Inc.-Financial-Stmts-vFINAL.pdf',
    fiscal_year: '2023',
    values: {
      // TODO: Manually verify from source PDF before benchmarking
      revenue: 24889, // Placeholder - read from income statement
      net_income: 2652, // Placeholder - read from income statement
      ebitda: 9136, // Placeholder - calculate or find in notes
      adjusted_ebitda: 7541, // Placeholder - if reported in notes
      shareholders_equity: 12115, // Placeholder - read from balance sheet
      total_debt: 27614, // Placeholder - read from balance sheet
      senior_debt: 24365, // Placeholder - read from balance sheet/notes
      // fccr: 0.57, // Placeholder - read from balance sheet/notes
    },
    source_notes:
      'Placeholder values - requires manual verification from PDF',
  },
  {
    document: 'Zedcor-FY2024',
    filename:
      '2024-12-31-Q4-Zedcor-Inc.-Financial-Stmts-4.9.2025v1.pdf',
    fiscal_year: '2024',
    values: {
      // TODO: Manually verify from source PDF before benchmarking
      revenue: 0, // Placeholder - read from income statement
      net_income: 0, // Placeholder - read from income statement
      ebitda: 0, // Placeholder - calculate or find in notes
      adjusted_ebitda: 0, // Placeholder - if reported in notes
      shareholders_equity: 0, // Placeholder - read from balance sheet
      total_debt: 0, // Placeholder - read from balance sheet
      senior_debt: 0, // Placeholder - read from balance sheet/notes
      // fccr:
    },
    source_notes:
      'Placeholder values - requires manual verification from PDF',
  },
  {
    document: 'Taiga-FY2024',
    filename:
      'Taiga_-_December_31,_2024_audited_financial_statements.pdf',
    fiscal_year: '2024',
    values: {
      // TODO: Manually verify from source PDF before benchmarking
      revenue: 0, // Placeholder - read from income statement
      net_income: 0, // Placeholder - read from income statement
      ebitda: 0, // Placeholder - calculate or find in notes
      adjusted_ebitda: 0, // Placeholder - if reported in notes
      shareholders_equity: 0, // Placeholder - read from balance sheet
      total_debt: 0, // Placeholder - read from balance sheet
      senior_debt: 0, // Placeholder - read from balance sheet/notes
      // fccr:
    },
    source_notes:
      'Placeholder values - requires manual verification from PDF',
  },
];

/**
 * Get ground truth by filename (partial match) and fiscal year.
 *
 * Matching strategy: Case-insensitive partial match on filename or document name.
 * Example: "2023-12-31-Q4-Zedcor-Inc.-Financial-Stmts-vFINAL.pdf" matches Zedcor-FY2023
 *
 * @param filename - Full or partial filename to match
 * @param fiscalYear - Fiscal year to match (e.g., "2024")
 * @returns Matching GroundTruthEntry or undefined if not found
 */
export function getGroundTruth(
  filename: string,
  fiscalYear: string,
): GroundTruthEntry | undefined {
  const normalizedInput = filename.toLowerCase();

  return GROUND_TRUTH.find((entry) => {
    // First check fiscal year
    if (entry.fiscal_year !== fiscalYear) {
      return false;
    }

    const entryFilename = entry.filename.toLowerCase();
    const documentName = entry.document.toLowerCase().split('-')[0]; // "zedcor" from "Zedcor-FY2023"

    // Check various matching strategies
    return (
      // Exact filename match
      normalizedInput === entryFilename ||
      // Input contains ground truth filename
      normalizedInput.includes(entryFilename) ||
      // Ground truth filename contains input
      entryFilename.includes(normalizedInput) ||
      // Input contains document name (e.g., "zedcor")
      normalizedInput.includes(documentName) ||
      // Document name in input
      documentName && normalizedInput.indexOf(documentName) !== -1
    );
  });
}

/**
 * Get all ground truth entries for a specific document (all years)
 *
 * @param documentPrefix - Document name prefix (e.g., "Zedcor", "Taiga")
 * @returns Array of matching GroundTruthEntry objects
 */
export function getGroundTruthByDocument(
  documentPrefix: string,
): GroundTruthEntry[] {
  const normalizedPrefix = documentPrefix.toLowerCase();
  return GROUND_TRUTH.filter((entry) =>
    entry.document.toLowerCase().startsWith(normalizedPrefix),
  );
}

/**
 * Check if ground truth values have been populated (not all zeros)
 *
 * @param entry - GroundTruthEntry to check
 * @returns true if at least one value is non-zero
 */
export function isGroundTruthPopulated(
  entry: GroundTruthEntry,
): boolean {
  const values = entry.values;
  return Object.values(values).some(
    (v) => v !== undefined && v !== null && v !== 0,
  );
}

/**
 * Check if all ground truth entries are populated
 *
 * @returns true if all entries have at least one non-zero value
 */
export function areAllGroundTruthsPopulated(): boolean {
  return GROUND_TRUTH.every(isGroundTruthPopulated);
}

/**
 * Regression Testing Script for Lendflow Extraction Pipeline
 *
 * Runs AI extraction on all financial report PDFs, compares results against
 * ground truth values and saved snapshots, and reports regressions.
 *
 * Usage:
 *   npx tsx scripts/test-extraction.ts
 *   npx tsx scripts/test-extraction.ts --update
 *   npx tsx scripts/test-extraction.ts --file Zedcor
 *   npx tsx scripts/test-extraction.ts --dry-run
 *
 * NOTE: dotenv must be loaded BEFORE any Anthropic SDK imports (they create
 * the client at module level using process.env.ANTHROPIC_API_KEY).
 */

// Step 1: Load env FIRST — before any app imports
import 'dotenv/config';

import * as fs from 'fs';
import * as path from 'path';
import type { ComputedMetrics } from '@/types';
import { getGroundTruth } from '@/lib/benchmarks/ground-truth';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const REPORTS_DIR = path.resolve(__dirname, '../public/financialReports');
const SNAPSHOTS_DIR = path.resolve(__dirname, '../test-results/snapshots');

/** Metrics that matter most for lending decisions */
const KEY_METRICS = [
  'revenue',
  'net_income',
  'adjusted_ebitda',
  'fccr',
  'dscr',
  'total_debt',
  'senior_debt',
  'senior_debt_to_ebitda',
  'total_debt_to_capital',
  'current_ratio',
] as const;

type KeyMetric = (typeof KEY_METRICS)[number];

/**
 * Known edge cases per file — documented for analyst awareness during review.
 * These do not suppress failures but provide context for manual investigation.
 */
const KNOWN_EDGE_CASES: Record<string, string[]> = {
  'Parkland_Q4_2024_FinancialStatements.pdf': [
    'Large-cap company (~$30B revenue) - values in millions',
    'Has MDA companion file - FS only is authoritative source',
    'Complex hedging and risk management disclosures',
  ],
  'Parkland_Q4_2024_MDA.pdf': [
    'Management Discussion & Analysis only - no standalone balance sheet',
    'Contains segment-level EBITDA breakdowns that may conflict with consolidated',
    'Skip for primary extraction - use FinancialStatements file instead',
  ],
  'PetValu_Q4_2024_FinancialStatements.pdf': [
    'Franchise business model - revenue includes franchise fees/royalties',
    'Right-of-use assets and lease liabilities are significant',
  ],
  'PBHC.Consolidated.FS.Q4-2024.FINAL.pdf': [
    'Premium Brands Holdings Corporation - large-cap specialty food company (~$6.5B revenue)',
    'Values in MILLIONS of Canadian dollars (not thousands) - scale normalization critical',
    'Complex capital structure: LT debt (1.9B) + convertible debentures (470.9M) + IFRS 16 leases (756.9M)',
    'Goodwill $1.1B + intangibles $555.9M - acquisition-heavy growth model',
    'Net income includes equity losses from associates and non-recurring restructuring costs',
    'FCCR difficult to compute - revolving credit draws/repayments inflate denominator',
  ],
  'ADENAnRpt24 2.pdf': [
    'ADENTRA Inc. (TSX: ADEN) - wholesale architectural building products distributor (86 locations)',
    'Annual report format with narrative sections interspersed before financial statements',
    'Values in THOUSANDS of US dollars (USD) - currency normalization required',
    'May contain prior-year reclassifications (noted in basis of preparation)',
  ],
  'FY2023_Q4_Financial_Statements.pdf': [
    'Taiga Building Products Ltd. FY2023 (year ended December 31, 2023)',
    'Values in thousands of Canadian dollars',
    'No bank debt - only IFRS 16 lease liabilities ($95.4M total)',
    'Same company as Taiga_-_December_31,_2024_audited_financial_statements.pdf (prior year)',
  ],
  'FY24_KITS_ConsolidatedFS_FINAL.pdf': [
    'KITS Eyecare - e-commerce optometry company',
    'Rapid growth trajectory - YoY comparisons may show large swings',
  ],
  'Taiga_-_December_31,_2024_audited_financial_statements.pdf': [
    'Taiga Building Products - wholesale distribution',
    'Values in thousands of Canadian dollars',
    'Revenue ~$1.6B - verify scale normalization works correctly',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SnapshotYear {
  revenue: number | null;
  net_income: number | null;
  adjusted_ebitda: number | null;
  fccr: number | null;
  dscr: number | null;
  total_debt: number | null;
  senior_debt: number | null;
  senior_debt_to_ebitda: number | null;
  total_debt_to_capital: number | null;
  current_ratio: number | null;
}

interface Snapshot {
  file: string;
  timestamp: string;
  years: Record<string, SnapshotYear>;
}

type ComparisonStatus = 'pass' | 'warn' | 'fail' | 'missing' | 'skip';

interface MetricComparison {
  metric: KeyMetric;
  extracted: number | null;
  reference: number | null;
  variance_pct: number | null;
  status: ComparisonStatus;
}

interface YearResult {
  year: string;
  gtComparisons: MetricComparison[];
  snapshotComparisons: MetricComparison[];
}

interface FileResult {
  filename: string;
  success: boolean;
  error?: string;
  years: YearResult[];
  edgeCases: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI Argument Parsing
// ─────────────────────────────────────────────────────────────────────────────

interface CliArgs {
  update: boolean;
  fileFilter: string | null;
  dryRun: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = { update: false, fileFilter: null, dryRun: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--update' || arg === '-u') {
      result.update = true;
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if ((arg === '--file' || arg === '-f') && i + 1 < args.length) {
      result.fileFilter = args[++i];
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Metric Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve a top-level metric from ComputedMetrics by key.
 * All KEY_METRICS are direct properties (no dot-notation nesting needed).
 */
function resolveMetric(metrics: ComputedMetrics, key: KeyMetric): number | null {
  const value = (metrics as unknown as Record<string, unknown>)[key];
  return typeof value === 'number' ? value : null;
}

/**
 * Extract the subset of key metrics from a ComputedMetrics object for snapshot storage.
 */
function extractSnapshotYear(metrics: ComputedMetrics): SnapshotYear {
  const result: Partial<SnapshotYear> = {};
  for (const key of KEY_METRICS) {
    result[key] = resolveMetric(metrics, key);
  }
  return result as SnapshotYear;
}

/**
 * Calculate percentage variance between extracted and reference values.
 * Returns null if extracted is null/undefined.
 */
function calcVariance(extracted: number | null, reference: number): number | null {
  if (extracted === null || extracted === undefined) return null;
  if (reference === 0) return extracted === 0 ? 0 : 100;
  return Math.abs((extracted - reference) / reference) * 100;
}

/**
 * Determine comparison status based on variance percentage.
 * - pass:    <5% variance
 * - warn:    5–20% variance
 * - fail:    >20% variance
 * - missing: extracted value is null/undefined
 * - skip:    reference value is 0 (unverified placeholder)
 */
function getComparisonStatus(
  variance: number | null,
  referenceValue: number,
): ComparisonStatus {
  if (referenceValue === 0) return 'skip';
  if (variance === null) return 'missing';
  if (variance < 5) return 'pass';
  if (variance <= 20) return 'warn';
  return 'fail';
}

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot I/O
// ─────────────────────────────────────────────────────────────────────────────

function loadSnapshot(filename: string): Snapshot | null {
  const snapshotPath = path.join(SNAPSHOTS_DIR, `${filename}.json`);
  if (!fs.existsSync(snapshotPath)) return null;
  try {
    const raw = fs.readFileSync(snapshotPath, 'utf-8');
    return JSON.parse(raw) as Snapshot;
  } catch {
    return null;
  }
}

function saveSnapshot(filename: string, snapshot: Snapshot): void {
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  const snapshotPath = path.join(SNAPSHOTS_DIR, `${filename}.json`);
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
}

// ─────────────────────────────────────────────────────────────────────────────
// Comparison Logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compare extracted metrics against ground truth for a single year.
 * Ground truth values of 0 are treated as unverified placeholders and skipped.
 */
function compareAgainstGroundTruth(
  filename: string,
  year: string,
  metrics: ComputedMetrics,
): MetricComparison[] {
  const gt = getGroundTruth(filename, year);

  return KEY_METRICS.map((key) => {
    const extracted = resolveMetric(metrics, key);
    const gtValues = gt?.values as Record<string, number | undefined> | undefined;
    const reference = gtValues?.[key] ?? null;

    if (reference === null || reference === undefined) {
      return { metric: key, extracted, reference: null, variance_pct: null, status: 'skip' as ComparisonStatus };
    }

    // 0 means unverified placeholder — skip
    if (reference === 0) {
      return { metric: key, extracted, reference: 0, variance_pct: null, status: 'skip' as ComparisonStatus };
    }

    const variance = calcVariance(extracted, reference);
    const status = getComparisonStatus(variance, reference);
    return { metric: key, extracted, reference, variance_pct: variance, status };
  });
}

/**
 * Compare extracted metrics against a saved snapshot for regression detection.
 * Any metric that changed by >5% is flagged as a regression.
 */
function compareAgainstSnapshot(
  snapshotYear: SnapshotYear,
  metrics: ComputedMetrics,
): MetricComparison[] {
  return KEY_METRICS.map((key) => {
    const extracted = resolveMetric(metrics, key);
    const reference = snapshotYear[key];

    if (reference === null || reference === undefined) {
      // Snapshot had no value — not a regression, just missing
      return { metric: key, extracted, reference: null, variance_pct: null, status: 'skip' as ComparisonStatus };
    }

    const variance = calcVariance(extracted, reference);

    // For snapshot comparison, >5% change is a regression (fail)
    let status: ComparisonStatus;
    if (variance === null) {
      status = extracted === null && reference === null ? 'skip' : 'missing';
    } else if (variance <= 5) {
      status = 'pass';
    } else {
      status = 'fail'; // any >5% deviation from snapshot is a regression
    }

    return { metric: key, extracted, reference, variance_pct: variance, status };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting Utilities
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_ICON: Record<ComparisonStatus, string> = {
  pass: '✓',
  warn: '⚠',
  fail: '✗',
  missing: '?',
  skip: '–',
};

/** Format a numeric value for display — currency for large values, ratio for small */
function formatValue(key: KeyMetric, value: number | null): string {
  if (value === null || value === undefined) return 'null';

  const ratioMetrics: KeyMetric[] = ['fccr', 'dscr', 'senior_debt_to_ebitda', 'total_debt_to_capital', 'current_ratio'];
  if (ratioMetrics.includes(key)) {
    return value.toFixed(2);
  }

  // Currency — format with $ and thousands separator
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

/** Left-pad a string to a minimum width */
function pad(str: string, width: number): string {
  return str.length >= width ? str : str + ' '.repeat(width - str.length);
}

/** Right-pad a string to a minimum width */
function rpad(str: string, width: number): string {
  return str.length >= width ? str : ' '.repeat(width - str.length) + str;
}

// ─────────────────────────────────────────────────────────────────────────────
// Report Printing
// ─────────────────────────────────────────────────────────────────────────────

function printYearComparisons(
  label: string,
  comparisons: MetricComparison[],
  indent: string = '    ',
): void {
  const visible = comparisons.filter((c) => c.status !== 'skip');
  if (visible.length === 0) return;

  console.log(`${indent}[${label}]`);
  for (const c of visible) {
    const icon = STATUS_ICON[c.status];
    const metricLabel = pad(c.metric, 25);
    const extractedStr = rpad(formatValue(c.metric as KeyMetric, c.extracted), 14);
    const refStr = c.reference !== null ? `(ref: ${formatValue(c.metric as KeyMetric, c.reference)}` : '';
    const varStr = c.variance_pct !== null ? `  |  ${c.variance_pct.toFixed(1)}%` : '';
    const refBlock = refStr ? `${refStr}${varStr})` : '';

    console.log(`${indent}  ${icon}  ${metricLabel}  ${extractedStr}  ${refBlock}`);
  }
}

function printFileResult(result: FileResult, index: number, total: number): void {
  console.log(`\n[${index}/${total}] ${result.filename}`);

  if (result.edgeCases.length > 0) {
    console.log(`  Note: ${result.edgeCases[0]}`);
    if (result.edgeCases.length > 1) {
      for (let i = 1; i < result.edgeCases.length; i++) {
        console.log(`        ${result.edgeCases[i]}`);
      }
    }
  }

  if (!result.success) {
    console.log(`  ERROR: ${result.error}`);
    return;
  }

  if (result.years.length === 0) {
    console.log(`  (no metrics extracted)`);
    return;
  }

  for (const yearResult of result.years) {
    console.log(`  Year ${yearResult.year}:`);

    const gtVisible = yearResult.gtComparisons.filter((c) => c.status !== 'skip');
    const snapVisible = yearResult.snapshotComparisons.filter((c) => c.status !== 'skip');

    if (gtVisible.length > 0) {
      printYearComparisons('Ground Truth', yearResult.gtComparisons, '    ');
    }
    if (snapVisible.length > 0) {
      printYearComparisons('Snapshot Delta', yearResult.snapshotComparisons, '    ');
    }
    if (gtVisible.length === 0 && snapVisible.length === 0) {
      console.log(`    (no ground truth or snapshot data for comparison)`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs();

  // Discover PDFs — exclude test.pdf
  const allPdfs = fs
    .readdirSync(REPORTS_DIR)
    .filter((f) => f.endsWith('.pdf') && f !== 'test.pdf')
    .sort();

  // Apply --file filter
  const pdfs = args.fileFilter
    ? allPdfs.filter((f) => f.toLowerCase().includes(args.fileFilter!.toLowerCase()))
    : allPdfs;

  const runTimestamp = new Date().toISOString();

  // Print header
  console.log('\n' + '═'.repeat(54));
  console.log('  Lendflow Extraction Regression Test');
  console.log(`  Run: ${runTimestamp}`);
  console.log('═'.repeat(54));

  if (args.dryRun) {
    console.log('\n--dry-run mode: no API calls will be made\n');
    console.log(`Files that would be processed (${pdfs.length}):`);
    for (const pdf of pdfs) {
      const edgeCases = KNOWN_EDGE_CASES[pdf] ?? [];
      const note = edgeCases.length > 0 ? `  [${edgeCases[0]}]` : '';
      console.log(`  - ${pdf}${note}`);
    }
    console.log('');
    return;
  }

  // Lazy import extractFinancialData AFTER env is loaded
  const { extractFinancialData } = await import('../utils/aiProcessor');

  // Tracking counters
  let gtPass = 0;
  let gtWarn = 0;
  let gtFail = 0;
  let gtSkip = 0;
  let snapRegressions = 0;
  let filesProcessed = 0;
  let hasFailures = false;

  const fileResults: FileResult[] = [];

  // Process each PDF
  for (let i = 0; i < pdfs.length; i++) {
    const filename = pdfs[i];
    const absolutePath = path.resolve(REPORTS_DIR, filename);
    const snapshotBasename = filename; // e.g., "Zedcor-FY2023.pdf" -> stored as "Zedcor-FY2023.pdf.json"
    const edgeCases = KNOWN_EDGE_CASES[filename] ?? [];

    process.stdout.write(`\n[${i + 1}/${pdfs.length}] Processing: ${filename}...\n`);

    const fileResult: FileResult = {
      filename,
      success: false,
      years: [],
      edgeCases,
    };

    try {
      const extractionResult = await extractFinancialData(absolutePath);
      fileResult.success = true;
      filesProcessed++;

      const metricsByYear = extractionResult.metrics_by_year ?? {};
      const existingSnapshot = loadSnapshot(snapshotBasename);

      // Build new snapshot years
      const newSnapshotYears: Record<string, SnapshotYear> = {};

      for (const [year, metrics] of Object.entries(metricsByYear)) {
        const gtComparisons = compareAgainstGroundTruth(filename, year, metrics);
        const snapshotYearData = existingSnapshot?.years[year] ?? null;

        let snapshotComparisons: MetricComparison[] = [];
        if (!args.update && snapshotYearData) {
          snapshotComparisons = compareAgainstSnapshot(snapshotYearData, metrics);
        }

        // Accumulate GT counters
        for (const c of gtComparisons) {
          if (c.status === 'pass') gtPass++;
          else if (c.status === 'warn') gtWarn++;
          else if (c.status === 'fail') { gtFail++; hasFailures = true; }
          else if (c.status === 'skip') gtSkip++;
          else if (c.status === 'missing') { /* missing counted as skip for GT */ gtSkip++; }
        }

        // Accumulate snapshot regression counter
        const regressionCount = snapshotComparisons.filter((c) => c.status === 'fail').length;
        snapRegressions += regressionCount;
        if (regressionCount > 0) hasFailures = true;

        fileResult.years.push({ year, gtComparisons, snapshotComparisons });

        // Collect snapshot data for saving
        newSnapshotYears[year] = extractSnapshotYear(metrics);
      }

      // Save / update snapshot
      const newSnapshot: Snapshot = {
        file: filename,
        timestamp: runTimestamp,
        years: newSnapshotYears,
      };
      saveSnapshot(snapshotBasename, newSnapshot);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      fileResult.success = false;
      fileResult.error = errorMessage;
      console.error(`  ERROR processing ${filename}: ${errorMessage}`);
    }

    fileResults.push(fileResult);

    // Print result inline as we go
    printFileResult(fileResult, i + 1, pdfs.length);
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(54));
  console.log('SUMMARY');
  console.log(`  Files processed: ${filesProcessed}`);
  console.log(`  GT comparisons:  ${gtPass} ✓  ${gtWarn} ⚠  ${gtFail} ✗  ${gtSkip} –`);
  console.log(`  Snapshot diffs:  ${snapRegressions === 0 ? '0 regressions detected' : `${snapRegressions} regression(s) detected`}`);
  console.log(`  Exit code: ${hasFailures ? '1 (failures found)' : '0 (all pass)'}`);
  console.log('─'.repeat(54) + '\n');

  process.exit(hasFailures ? 1 : 0);
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});

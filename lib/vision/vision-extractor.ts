/**
 * Vision-based Financial Document Extractor
 * Combines PDF-to-image conversion with Claude Vision analysis
 */

import { convertPdfToImages, convertPdfPage } from './pdf-converter';
import {
  createVisionClient,
  analyzeFinancialImage,
  type ExtractionResult,
} from './claude-client';
import type { ExtractedMetrics } from '@/types/financial';
import type Anthropic from '@anthropic-ai/sdk';

/**
 * Options for PDF extraction
 */
export interface ExtractionOptions {
  /** Pages to extract (1-based). If not specified, extracts all pages. */
  pages?: number[];
  /** Scale factor for image conversion. Default: 4.17 (300 DPI) */
  scale?: number;
  /** Existing Anthropic client to reuse. If not provided, creates new one. */
  client?: Anthropic;
}

/**
 * Result of multi-page extraction
 */
export interface PdfExtractionResult {
  /** Extracted metrics by fiscal year (merged across pages) */
  metricsByYear: Record<string, ExtractedMetrics>;
  /** Per-page extraction results */
  pageResults: Array<{
    pageNumber: number;
    result: ExtractionResult;
  }>;
  /** Total token usage across all pages */
  totalUsage: {
    inputTokens: number;
    outputTokens: number;
  };
  /** Pages processed */
  pagesProcessed: number;
}

/**
 * Extract financial metrics from a single PDF page
 *
 * @param pdfInput - PDF file path or Buffer
 * @param pageNumber - Page number to extract (1-based)
 * @param options - Extraction options
 * @returns Extraction result with metrics and usage
 */
export async function extractFromPdfPage(
  pdfInput: string | Buffer,
  pageNumber: number,
  options: Omit<ExtractionOptions, 'pages'> = {}
): Promise<ExtractionResult> {
  const client = options.client ?? createVisionClient();
  const scale = options.scale ?? 4.17;

  // Convert single page to image
  const imageBuffer = await convertPdfPage(pdfInput, pageNumber, { scale });

  // Analyze with Claude Vision
  return analyzeFinancialImage(client, imageBuffer);
}

/**
 * Extract financial metrics from all or selected PDF pages
 * Results are merged by fiscal year across pages
 *
 * @param pdfInput - PDF file path or Buffer
 * @param options - Extraction options
 * @returns Combined extraction results
 */
export async function extractFromPdf(
  pdfInput: string | Buffer,
  options: ExtractionOptions = {}
): Promise<PdfExtractionResult> {
  const client = options.client ?? createVisionClient();
  const scale = options.scale ?? 4.17;

  // Convert PDF to images
  const allPages = await convertPdfToImages(pdfInput, { scale });

  // Determine which pages to process
  const pagesToProcess = options.pages
    ? allPages.filter((p) => options.pages!.includes(p.pageNumber))
    : allPages;

  if (pagesToProcess.length === 0) {
    throw new Error('No pages to process');
  }

  const pageResults: PdfExtractionResult['pageResults'] = [];
  const metricsByYear: Record<string, ExtractedMetrics> = {};
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Process pages sequentially to avoid rate limits
  for (const page of pagesToProcess) {
    console.log(`Processing page ${page.pageNumber}/${allPages.length}...`);

    try {
      const result = await analyzeFinancialImage(client, page.image);

      pageResults.push({
        pageNumber: page.pageNumber,
        result,
      });

      // Merge into year-based results
      const year = result.fiscalYear;
      if (metricsByYear[year]) {
        // Merge: prefer non-null values from new extraction
        metricsByYear[year] = mergeMetrics(metricsByYear[year], result.metrics);
      } else {
        metricsByYear[year] = result.metrics;
      }

      totalInputTokens += result.usage.inputTokens;
      totalOutputTokens += result.usage.outputTokens;
    } catch (error) {
      console.error(`Error processing page ${page.pageNumber}:`, error);
      // Continue with other pages
    }
  }

  return {
    metricsByYear,
    pageResults,
    totalUsage: {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    },
    pagesProcessed: pageResults.length,
  };
}

/**
 * Merge two ExtractedMetrics objects
 * Prefers non-null values from the newer extraction
 */
function mergeMetrics(
  existing: ExtractedMetrics,
  incoming: ExtractedMetrics
): ExtractedMetrics {
  const merged = { ...existing };

  for (const key of Object.keys(incoming) as (keyof ExtractedMetrics)[]) {
    const incomingValue = incoming[key];
    const existingValue = existing[key];

    // Skip null/undefined incoming values
    if (incomingValue === null || incomingValue === undefined) {
      continue;
    }

    // If existing is null, use incoming
    if (existingValue === null || existingValue === undefined) {
      (merged as Record<string, unknown>)[key] = incomingValue;
      continue;
    }

    // For nested objects, do a shallow merge
    if (typeof incomingValue === 'object' && typeof existingValue === 'object') {
      (merged as Record<string, unknown>)[key] = {
        ...existingValue,
        ...incomingValue,
      };
      continue;
    }

    // For primitives, prefer incoming (newer page data)
    (merged as Record<string, unknown>)[key] = incomingValue;
  }

  return merged;
}

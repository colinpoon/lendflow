/**
 * PDF to Image Converter
 * Converts PDF pages to PNG images for Claude Vision analysis
 *
 * Financial documents need to be converted to high-quality images
 * before vision analysis. Text extraction destroys table structure;
 * vision preserves it.
 */

import { pdf } from 'pdf-to-img';

// 300 DPI = 72 base DPI * 4.17 scale factor
// High quality required for accurate financial table extraction
const DEFAULT_SCALE = 4.17;

export interface ConversionOptions {
  /** Scale factor for image resolution. 4.17 = 300 DPI (recommended for financial tables) */
  scale?: number;
}

export interface ConversionResult {
  /** Page number (1-based, matches PDF convention) */
  pageNumber: number;
  /** PNG image as Buffer */
  image: Buffer;
}

/**
 * Convert all pages of a PDF to PNG images
 * @param pdfInput - File path or Buffer containing PDF data
 * @param options - Conversion options (scale defaults to 4.17 for 300 DPI)
 * @returns Array of ConversionResult with page numbers and image buffers
 *
 * @example
 * const results = await convertPdfToImages('./financial-report.pdf');
 * console.log(`Converted ${results.length} pages`);
 * // Each result has: { pageNumber: 1, image: Buffer<PNG> }
 */
export async function convertPdfToImages(
  pdfInput: string | Buffer,
  options: ConversionOptions = {}
): Promise<ConversionResult[]> {
  const scale = options.scale ?? DEFAULT_SCALE;

  const document = await pdf(pdfInput, { scale });
  const results: ConversionResult[] = [];

  let pageNumber = 1;
  for await (const page of document) {
    results.push({
      pageNumber,
      image: Buffer.from(page),
    });
    pageNumber++;
  }

  return results;
}

/**
 * Convert a single page of a PDF to PNG image
 * @param pdfInput - File path or Buffer containing PDF data
 * @param pageNumber - Page number to convert (1-based)
 * @param options - Conversion options
 * @returns PNG image as Buffer
 *
 * @example
 * const image = await convertPdfPage('./report.pdf', 3);
 * // Returns PNG buffer for page 3
 */
export async function convertPdfPage(
  pdfInput: string | Buffer,
  pageNumber: number,
  options: ConversionOptions = {}
): Promise<Buffer> {
  const scale = options.scale ?? DEFAULT_SCALE;

  const document = await pdf(pdfInput, { scale });
  const page = await document.getPage(pageNumber);

  return Buffer.from(page);
}

/**
 * Get the number of pages in a PDF
 * @param pdfInput - File path or Buffer containing PDF data
 * @returns Number of pages
 *
 * @example
 * const count = await getPdfPageCount('./report.pdf');
 * console.log(`PDF has ${count} pages`);
 */
export async function getPdfPageCount(pdfInput: string | Buffer): Promise<number> {
  // Use scale 1 for fast counting (no high-res rendering needed)
  const document = await pdf(pdfInput, { scale: 1 });
  let count = 0;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for await (const _page of document) {
    count++;
  }
  return count;
}

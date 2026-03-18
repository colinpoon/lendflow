/**
 * Vision extraction module
 * PDF-to-image conversion and Claude Vision API integration.
 *
 * This module provides the foundation for vision-based financial data extraction.
 * Documents are converted to high-quality images before analysis to preserve
 * table structure that text extraction destroys.
 */

// PDF conversion
export {
  convertPdfToImages,
  convertPdfPage,
  getPdfPageCount,
  type ConversionOptions,
  type ConversionResult,
} from './pdf-converter';

// Claude Vision client
export {
  createVisionClient,
  analyzeFinancialImage,
  testVisionConnection,
  validateApiKey,
  type PageExtractionResult,
  type YearExtraction,
} from './claude-client';

// Tool definitions
export {
  EXTRACTION_TOOL,
  EXTRACTION_PROMPT,
  extractionToolSchema,
} from './extraction-tool';

// Full extraction pipeline
export {
  extractFromPdf,
  extractFromPdfPage,
  type ExtractionOptions,
  type PdfExtractionResult,
  type MergeConflict,
} from './vision-extractor';

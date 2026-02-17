/**
 * Vision extraction module
 * PDF-to-image conversion and Claude Vision API integration
 *
 * This module provides the foundation for vision-based financial data extraction.
 * Documents are converted to high-quality images before analysis to preserve
 * table structure that text extraction destroys.
 */

export {
  convertPdfToImages,
  convertPdfPage,
  getPdfPageCount,
  type ConversionOptions,
  type ConversionResult,
} from './pdf-converter';

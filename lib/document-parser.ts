/**
 * Document parsing utilities
 * Handles PDF, Excel (.xlsx/.xls), Word (.docx), and plain text extraction
 */

import { readFileSync, existsSync } from 'fs';
import path from 'path';

/**
 * Temporarily suppress deprecation warnings around pdf-parse calls.
 * pdf-parse internally uses `new Buffer()` which triggers DEP0005.
 * We scope this to only the PDF parsing path instead of silencing globally.
 */
async function withSuppressedDeprecations<T>(fn: () => Promise<T>): Promise<T> {
  const prev = process.noDeprecation;
  process.noDeprecation = true;
  try {
    return await fn();
  } finally {
    process.noDeprecation = prev;
  }
}

/**
 * Parse a document and extract text content suitable for AI financial analysis.
 * Supports: PDF, Excel (.xlsx/.xls), Word (.docx), and plain text.
 *
 * @param filePath - Absolute path to the document file
 * @returns Extracted text content
 */
export async function parseDocument(filePath: string): Promise<string> {
  console.log('📂 Path received by parseDocument():', filePath);

  if (!filePath) {
    throw new Error('No file path provided to parseDocument().');
  }

  const resolvedPath = path.resolve(filePath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`File not found at resolved path: ${resolvedPath}`);
  }

  const ext = path.extname(resolvedPath).toLowerCase();

  if (ext === '.pdf') {
    const buffer = readFileSync(resolvedPath);
    return await parsePDF(buffer);
  }

  if (ext === '.xlsx' || ext === '.xls') {
    const buffer = readFileSync(resolvedPath);
    return parseExcel(buffer);
  }

  if (ext === '.docx') {
    const buffer = readFileSync(resolvedPath);
    return await parseDocx(buffer);
  }

  if (ext === '.doc') {
    throw new Error(
      'Legacy .doc format is not supported. Please save the file as .docx (Word 2007 or later) and re-upload.'
    );
  }

  // Plain text fallback
  return readFileSync(resolvedPath, 'utf-8').trim();
}

// ── PDF ──────────────────────────────────────────────────────────────────────

/**
 * Extract text from a PDF buffer using pdf-parse with pdf2json as fallback.
 * Detects scanned/image-only PDFs and prepends a warning when text density
 * is too low to be reliable (< 100 characters per page on average).
 */
async function parsePDF(buffer: Buffer): Promise<string> {
  // Use inner parser to avoid built-in test harness
  const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
  const PDFParser = (await import('pdf2json')).default;

  const result = await withSuppressedDeprecations(() => pdfParse(buffer));
  let text = result.text.trim();

  if (!text) {
    console.warn('⚠️ pdf-parse found no text — falling back to pdf2json');

    const pdfParser = new PDFParser();
    const pdf2Text: string = await new Promise((resolve, reject) => {
      pdfParser.on('pdfParser_dataError', (errData: Error | { parserError: Error }) =>
        reject('parserError' in errData ? errData.parserError : errData)
      );
      pdfParser.on('pdfParser_dataReady', (pdfData: unknown) => {
        const data = pdfData as {
          formImage?: { Pages?: Array<{ Texts: Array<{ R?: Array<{ T?: string }> }> }> };
        };
        const allText =
          data?.formImage?.Pages?.flatMap((page) =>
            page.Texts.map((t) => decodeURIComponent(t.R?.[0]?.T || ''))
          ).join(' ') || '';
        resolve(allText.trim());
      });
      pdfParser.parseBuffer(buffer);
    });

    if (!pdf2Text) {
      throw new Error('No extractable text found in PDF. The file may be a scanned image-only PDF.');
    }

    console.log('✅ PDF content extracted via pdf2json.');
    text = pdf2Text;
  } else {
    console.log('✅ PDF content extracted via pdf-parse.');
  }

  // Detect scanned/image-only PDFs by measuring text density per page.
  // pdf-parse exposes the rendered page count via `numpages`.
  const pageCount: number = (result as unknown as { numpages: number }).numpages ?? 1;
  const charsPerPage = text.length / Math.max(pageCount, 1);

  if (charsPerPage < 100) {
    console.warn(
      `⚠️ Low text density detected: ${charsPerPage.toFixed(0)} chars/page across ${pageCount} pages. Likely a scanned PDF.`
    );
    return (
      '[WARNING: This appears to be a scanned/image-based PDF. Text extraction may be incomplete. ' +
      'Consider using the Vision upload (/vision) for better accuracy.]\n\n' +
      text
    );
  }

  return text;
}

// ── Excel ─────────────────────────────────────────────────────────────────────

/**
 * Convert an Excel workbook buffer to pipe-delimited plain text.
 *
 * Each sheet is preceded by a header line ("=== Sheet: <name> ===") so the AI
 * can identify which financial schedule it is reading. Rows are formatted as
 * pipe-delimited values and completely empty rows are skipped to reduce noise.
 *
 * A hard limit of 2000 rows per sheet prevents runaway context consumption for
 * extremely large workbooks while still covering any realistic financial report.
 */
function parseExcel(buffer: Buffer): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx') as typeof import('xlsx');

  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sections: string[] = [];

  const MAX_ROWS_PER_SHEET = 2000;

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rows: string[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      raw: false, // Format numbers as strings for readability
    }) as string[][];

    const nonEmptyRows = rows
      .slice(0, MAX_ROWS_PER_SHEET)
      .filter((row) => row.some((cell) => String(cell).trim() !== ''));

    if (nonEmptyRows.length === 0) {
      continue; // Skip entirely blank sheets
    }

    const rowLines = nonEmptyRows.map((row) =>
      row.map((cell) => String(cell ?? '').trim()).join(' | ')
    );

    sections.push(`=== Sheet: ${sheetName} ===\n${rowLines.join('\n')}`);
  }

  if (sections.length === 0) {
    throw new Error('Excel file contains no readable data.');
  }

  const output = sections.join('\n\n');
  console.log(
    `✅ Excel content extracted: ${workbook.SheetNames.length} sheet(s), ${output.length} characters.`
  );
  return output;
}

// ── Word (.docx) ──────────────────────────────────────────────────────────────

// Shape of the mammoth extraction result we depend on
interface MammothResult {
  value: string;
  messages: Array<{ type: string; message: string }>;
}

interface MammothModule {
  extractRawText(options: { buffer: Buffer }): Promise<MammothResult>;
}

/**
 * Extract plain text from a .docx file using mammoth.
 * Returns the raw text content, which preserves paragraph structure.
 */
async function parseDocx(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require('mammoth') as MammothModule;

  const result = await mammoth.extractRawText({ buffer });

  if (result.messages.length > 0) {
    const warnings = result.messages.filter((m) => m.type === 'warning');
    if (warnings.length > 0) {
      console.warn(
        `⚠️ mammoth reported ${warnings.length} warning(s) during .docx extraction:`,
        warnings.map((m) => m.message).join('; ')
      );
    }
  }

  const text = result.value.trim();

  if (!text) {
    throw new Error('No extractable text found in .docx file. The document may be empty or contain only images.');
  }

  console.log(`✅ Word (.docx) content extracted: ${text.length} characters.`);
  return text;
}

/**
 * Document parsing utilities
 * Handles PDF and text file extraction
 */

import { readFileSync, existsSync } from 'fs';
import path from 'path';

// Suppress Buffer() deprecation warning from pdf-parse dependency
process.noDeprecation = true;

/**
 * Parse a document and extract text content
 * Supports PDF and plain text files
 * @param filePath - Path to the document
 * @returns Extracted text content
 */
export async function parseDocument(filePath: string): Promise<string> {
  console.log('📂 Path received by parseDocument():', filePath);

  if (!filePath) {
    throw new Error('❗ No file path provided to parseDocument().');
  }

  const resolvedPath = path.resolve(filePath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`❗ File not found at resolved path: ${resolvedPath}`);
  }

  const dataBuffer = readFileSync(resolvedPath);

  if (resolvedPath.endsWith('.pdf')) {
    return await parsePDF(dataBuffer);
  }

  // Plain text file
  return readFileSync(resolvedPath, 'utf-8').trim();
}

/**
 * Parse PDF content using pdf-parse with pdf2json fallback
 */
async function parsePDF(buffer: Buffer): Promise<string> {
  // Use inner parser to avoid built-in test harness
  const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
  const PDFParser = (await import('pdf2json')).default;

  let { text } = await pdfParse(buffer);
  text = text.trim();

  if (!text) {
    console.warn('⚠️ pdf-parse found no text — falling back to pdf2json');

    const pdfParser = new PDFParser();
    const pdf2Text: string = await new Promise((resolve, reject) => {
      pdfParser.on('pdfParser_dataError', (errData: any) =>
        reject(errData.parserError)
      );
      pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
        const allText =
          pdfData?.formImage?.Pages?.flatMap((page: any) =>
            page.Texts.map((t: any) => decodeURIComponent(t.R?.[0]?.T || ''))
          ).join(' ') || '';
        resolve(allText.trim());
      });
      pdfParser.parseBuffer(buffer);
    });

    if (!pdf2Text) {
      throw new Error('❗ No extractable text found using pdf2json either.');
    }

    console.log('✅ PDF content extracted via pdf2json.');
    return pdf2Text;
  }

  console.log('✅ PDF content extracted via pdf-parse.');
  return text;
}

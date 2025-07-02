import OpenAI from 'openai';
// use inner parser to avoid built‑in test harness that loads 05‑versions‑space.pdf
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Extracts financial data from an uploaded document.
 * If the file is a PDF we use pdf‑parse (which disables pdf.js workers automatically),
 * otherwise we treat it as plain text.
 * Large extracted text is chunked into ~8 kB pieces and each chunk
 * is sent to OpenAI for metric extraction.  Partial results are returned as an array.
 */
export const extractFinancialData = async (filePath: string) => {
  try {
    console.log(
      '📂 Path received by extractFinancialData():',
      filePath
    );

    if (!filePath) {
      throw new Error(
        '❗ No file path provided to extractFinancialData().'
      );
    }

    const resolvedPath = path.resolve(filePath);
    console.log(
      '📂 Attempting to read file at resolved path:',
      resolvedPath
    );

    if (!existsSync(resolvedPath)) {
      throw new Error(
        `❗ File not found at resolved path: ${resolvedPath}`
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        'OpenAI API key is missing. Please configure it in the environment variables.'
      );
    }

    console.log('📚 Checking file type before reading…');
    let fileContent: string;

    // ───────────────────────────── PDF branch ─────────────────────────────
    if (resolvedPath.endsWith('.pdf')) {
      console.log(
        '📄 Detected PDF file. Extracting text with pdf‑parse…'
      );
      const dataBuffer = readFileSync(resolvedPath); // Buffer

      const { text } = await pdfParse(dataBuffer); // pdf‑parse auto‑disables workers

      if (!text.trim()) {
        throw new Error(
          'No extractable text found in the PDF. Please upload a valid financial document.'
        );
      }
      fileContent = text.trim();
      console.log('✅ PDF content extracted successfully.');
    }
    // ───────────────────────────── non‑PDF branch ─────────────────────────
    else {
      console.log('📚 Reading non‑PDF file as text…');
      fileContent = readFileSync(resolvedPath, 'utf-8').trim();
    }

    console.log(
      '📚 File content read successfully. Preparing to chunk…'
    );

    // ─────────── helper: split large text into manageable chunks ───────────
    function chunkText(text: string, maxChars: number): string[] {
      const chunks: string[] = [];
      for (let i = 0; i < text.length; i += maxChars) {
        chunks.push(text.slice(i, i + maxChars));
      }
      return chunks;
    }

    const CHUNK_SIZE = 8_000; // ≈2,000 tokens
    const textChunks = chunkText(fileContent, CHUNK_SIZE);
    console.log(
      `✅ Split text into ${textChunks.length} chunks for analysis.`
    );

    const allExtractions: any[] = [];

    for (let i = 0; i < textChunks.length; i++) {
      console.log(
        `🤖 Sending chunk ${i + 1}/${textChunks.length} to OpenAI…`
      );

      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-2024-04-09',
        messages: [
          {
            role: 'system',
            content:
              'Extract financial metrics from the provided text chunk, including Net Income, Expenses, Profit Margins, Interest, Taxes, Depreciation, and Amortization. Also, infer and compute EBITDA if possible.',
          },
          {
            role: 'user',
            content: textChunks[i],
          },
        ],
        max_tokens: 2_000,
        temperature: 0.2,
      });

      const extractedText =
        response.choices?.[0]?.message?.content ?? '{}';
      console.log(
        `🤖 Raw AI response for chunk ${i + 1}:`,
        extractedText
      );

      try {
        allExtractions.push(JSON.parse(extractedText));
      } catch (err) {
        console.warn(
          `⚠️  Failed to parse chunk ${i + 1} as JSON:`,
          err
        );
      }
    }

    console.log(
      '✅ All chunks processed. Returning combined extractions.'
    );
    return allExtractions;
  } catch (error: any) {
    console.error(
      '❗ AI processing failed:',
      error?.message || error
    );
    throw new Error(
      'AI processing failed: ' + (error?.message || 'Unknown error')
    );
  }
};

// ───────────────────────── helper: strip ``` fences ─────────────────────────
function cleanJsonFence(input: string): string {
  return (
    input
      .trim()
      // remove ```json or ``` blocks at start/end
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()
  );
}

// ─────────────────────── helper: build deterministic ratios ───────────────────────
function buildMetricRatios(
  byYear: Record<string, any>
): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [yr, m] of Object.entries<any>(byYear)) {
    const icr =
      m.interest && m.interest !== 0 ? m.ebitda / m.interest : null;
    const d2e =
      m.shareholders_equity && m.shareholders_equity !== 0
        ? (m.expenses ?? 0) / m.shareholders_equity
        : null;
    out[yr] = {
      ...m,
      interest_coverage_ratio: icr,
      debt_to_equity_ratio: d2e,
    };
  }
  return out;
}

import OpenAI from 'openai';
// use inner parser to avoid built‑in test harness that loads 05‑versions‑space.pdf
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import fs from 'fs';

const CACHE_DIR = path.join(os.tmpdir(), 'lendflow-cache');
if (!existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function hashBuffer(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function getCachedAnalysisPath(hash: string): string {
  return path.join(CACHE_DIR, `${hash}.json`);
}

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
    const dataBuffer = readFileSync(resolvedPath);
    // const fileHash = hashBuffer(dataBuffer);
    // const cachePath = getCachedAnalysisPath(fileHash);
    // if (existsSync(cachePath)) {
    //   console.log('✅ Returning cached analysis.');
    //   const cached = readFileSync(cachePath, 'utf-8');
    //   return JSON.parse(cached);
    // }

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
      // already read earlier for hashing
      // Updated logic: try pdf-parse, fall back to pdf2json if needed
      // Import PDFParser from pdf2json
      // (placed inside the block to avoid import issues in non-PDF usage)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const PDFParser = (await import('pdf2json')).default;

      let { text } = await pdfParse(dataBuffer);
      text = text.trim();

      if (!text) {
        console.warn(
          '⚠️ pdf-parse found no text — falling back to pdf2json'
        );

        const pdfParser = new PDFParser();

        const pdf2Text: string = await new Promise(
          (resolve, reject) => {
            pdfParser.on('pdfParser_dataError', (errData: any) =>
              reject(errData.parserError)
            );
            pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
              const allText =
                pdfData?.formImage?.Pages?.flatMap((page: any) =>
                  page.Texts.map((t: any) =>
                    decodeURIComponent(t.R?.[0]?.T || '')
                  )
                ).join(' ') || '';
              resolve(allText.trim());
            });
            pdfParser.parseBuffer(dataBuffer);
          }
        );

        if (!pdf2Text) {
          throw new Error(
            '❗ No extractable text found using pdf2json either.'
          );
        }

        fileContent = pdf2Text;
        console.log('✅ PDF content extracted via pdf2json.');
      } else {
        fileContent = text;
        console.log('✅ PDF content extracted via pdf-parse.');
      }
    }
    // ───────────────────────────── non‑PDF branch ─────────────────────────
    else {
      console.log('📚 Reading non‑PDF file as text…');
      fileContent = readFileSync(resolvedPath, 'utf-8').trim();
    }

    // (Global scaleFactor removed; scaling will be handled per-chunk)

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
    let riskSnapshot: any | null = null; // capture first riskAssessment

    const seenChunks = new Set<string>();

    for (let i = 0; i < textChunks.length; i++) {
      const trimmedChunk = textChunks[i].trim();
      const hash = crypto
        .createHash('sha256')
        .update(trimmedChunk)
        .digest('hex');
      if (seenChunks.has(hash)) {
        console.log(`⏩ Skipping duplicate chunk ${i + 1}`);
        continue;
      }
      seenChunks.add(hash);

      console.log(
        `🤖 Sending chunk ${i + 1}/${textChunks.length} to OpenAI…`
      );

      // Detect if this chunk references values "in thousands" or "in 000s"
      const chunkScaleFactor = /in (thousands|000s)/i.test(
        trimmedChunk
      )
        ? 1000
        : 1;

      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-2024-04-09',
        temperature: 0,
        max_tokens: 2_000,
        messages: [
          {
            role: 'system',
            content: `
You are a deterministic **financial‑statement extraction engine**.  
The user text may come from any kind of financial filing (annual report, 10‑K, MD&A, notes, etc.).

OUTPUT REQUIREMENTS  
Return **valid JSON only** in the exact schema below – no markdown or comments:

{
  "metrics_by_year": {
    "<year>": {
      "revenue": number|null,
      "net_income": number|null,
      "expenses": number|null,
      "profit_margins": number|null,
      "interest": number|null,
      "taxes": number|null,
      "depreciation_amortization": number|null,
      "ebitda": number|null,
      "shareholders_equity": number|null
    }
  }
}

• Be flexible in identifying synonyms and alternate phrasing for metrics (e.g. "turnover" = revenue, "retained earnings" may contribute to shareholders_equity).

RULES  
• Detect every fiscal year present (e.g. 2025, 2024, 2023) and use it as the JSON key.  
• Emit numeric values as plain JSON numbers – **no quotes, commas, or currency symbols**.  
• If a value is unavailable for a metric, output null (do NOT omit the key).  
• If net_income, interest, taxes, and depreciation_amortization are all non‑null for a year, compute:  
  "ebitda" = net_income + interest + taxes + depreciation_amortization  
  (otherwise leave ebitda as null).  
• Do not add any keys, explanations, or narrative – JSON object only.

• If the source text indicates that amounts are reported "in thousands" or "$000s", you must multiply extracted numeric values by 1,000 to return full values in absolute dollars.
• If values are already written as millions (e.g. $9,100,000) but the text says “in thousands”, do not apply scaling again.

This schema must work for any financial statement worldwide.
`,
          },
          {
            role: 'user',
            content: textChunks[i],
          },
        ],
      });

      const extractedText =
        response.choices?.[0]?.message?.content ?? '{}';
      console.log(
        `🤖 Raw AI response for chunk ${i + 1}:`,
        extractedText
      );

      try {
        const cleaned = cleanJsonFence(extractedText);
        const maybeObj = JSON.parse(cleaned);
        // scale metrics_by_year values per chunk, if present
        if (maybeObj?.metrics_by_year) {
          for (const [year, metrics] of Object.entries<any>(
            maybeObj.metrics_by_year
          )) {
            for (const [key, value] of Object.entries(metrics)) {
              if (typeof value === 'number') {
                metrics[key] =
                  Math.round(value * chunkScaleFactor * 100) / 100;
              }
            }
          }
        }
        allExtractions.push(maybeObj);
        // capture a riskAssessment if present
        if (
          !riskSnapshot &&
          maybeObj &&
          typeof maybeObj === 'object' &&
          maybeObj.riskAssessment
        ) {
          riskSnapshot = maybeObj.riskAssessment;
        }
      } catch (err) {
        console.warn(
          `⚠️  Failed to parse chunk ${i + 1} as JSON:`,
          err
        );
      }
    }

    /* ────────── 2nd‑pass: request credit‑risk snapshot if not captured ────────── */
    /* ────────────── consolidate all partial JSONs ────────────── */
    const merged: Record<string, any> = {};
    for (const obj of allExtractions) {
      if (obj && typeof obj === 'object' && obj.metrics_by_year) {
        for (const [yr, metrics] of Object.entries<any>(
          obj.metrics_by_year
        )) {
          if (!merged[yr]) merged[yr] = { ...metrics };
          else {
            // fill nulls with any non‑null values found in later chunks
            for (const key of Object.keys(metrics)) {
              if (merged[yr][key] == null && metrics[key] != null) {
                merged[yr][key] = metrics[key];
              }
            }
          }
        }
      }
    }
    // (Scaling already applied per chunk; global scaling block removed)
    // for (const [year, metrics] of Object.entries(merged)) {
    //   for (const [key, value] of Object.entries(metrics)) {
    //     if (typeof value === 'number') {
    //       metrics[key] = Math.round(value * scaleFactor * 100) / 100;
    //     }
    //   }
    // }
    // build deterministic ratios for risk analysis
    const ratiosByYear = buildMetricRatios(merged);

    // ────────────── Validation: Sanity checks on financial metrics ──────────────
    function validateMetrics(metrics: Record<string, any>) {
      const issues: Record<string, string[]> = {};
      for (const [year, data] of Object.entries<any>(metrics)) {
        const problems: string[] = [];

        if (
          data.expenses != null &&
          data.revenue != null &&
          data.expenses > data.revenue
        ) {
          problems.push('Expenses exceed revenue');
        }
        if (
          data.debt_to_equity_ratio != null &&
          !isFinite(data.debt_to_equity_ratio)
        ) {
          problems.push(
            'Debt-to-equity ratio is not a finite number'
          );
        }
        if (
          data.interest_coverage_ratio != null &&
          !isFinite(data.interest_coverage_ratio)
        ) {
          problems.push(
            'Interest coverage ratio is not a finite number'
          );
        }
        if (
          data.net_income != null &&
          typeof data.net_income !== 'number'
        ) {
          problems.push('Net income is not a number');
        }
        if (
          data.shareholders_equity != null &&
          typeof data.shareholders_equity !== 'number'
        ) {
          problems.push('Shareholders equity is not a number');
        }

        if (problems.length > 0) {
          issues[year] = problems;
        }
      }
      return issues;
    }

    const validationIssues = validateMetrics(ratiosByYear);

    if (!riskSnapshot) {
      console.log(
        '🔍 No riskAssessment captured; requesting summary…'
      );
      try {
        const riskResp = await openai.chat.completions.create({
          model: 'gpt-4-turbo-2024-04-09',
          temperature: 0, // deterministic
          max_tokens: 2000,
          messages: [
            {
              role: 'system',
              content: `
You are a credit-risk engine. Use only the numeric metrics provided below.
Return EXACT JSON matching this schema — no markdown, no fences, no extra keys:

{
  "header": string,
  "pillars": {
    "profitability_cashflow": { "observations": string, "impact": string, "weight": 20, "score": number|null },
    "leverage":               { "observations": string, "impact": string, "weight": 20, "score": number|null },
    "liquidity":              { "observations": string, "impact": string, "weight": 20, "score": number|null },
    "debt_service":           { "observations": string, "impact": string, "weight": 15, "score": number|null },
    "interest_rate_sensitivity": { "observations": string, "impact": string, "weight": 10, "score": number|null },
    "concentration_sector":   { "observations": string, "impact": string, "weight": 15, "score": number|null },
    "governance":             { "observations": string, "impact": string, "weight": 10, "score": number|null }
  },
  "weighted_score": number,
  "band": one of {
    "Very Low" if weighted_score <= 2,
    "Moderate-Low" if 2 < weighted_score <= 4,
    "Moderate" if 4 < weighted_score <= 6,
    "Elevated" if 6 < weighted_score <= 8,
    "High" if weighted_score > 8
  },
  // Round weighted_score to 1 decimal place
  "lending_recommendation": string
}

Calculate weighted_score = (Σ weight × score) / 100 internally.
Use any information available from the financial statement — including governance practices, customer concentration, or industry exposure — to generate informed values for all pillars.
`.trim(),
            },
            {
              role: 'user',
              content: JSON.stringify(ratiosByYear),
            },
          ],
        });

        const rawRisk = riskResp.choices[0]?.message?.content ?? '{}';
        riskSnapshot = JSON.parse(cleanJsonFence(rawRisk));
      } catch (e) {
        console.warn('⚠️  Risk snapshot generation failed:', e);
      }
    }

    /* if nothing parsed, fall back to raw array */
    const finalResult =
      Object.keys(merged).length > 0 || riskSnapshot
        ? {
            ...(Object.keys(merged).length > 0 && {
              metrics_by_year: merged,
            }),
            ...(riskSnapshot && { riskAssessment: riskSnapshot }),
            ...(Object.keys(validationIssues).length > 0 && {
              validation_issues: validationIssues,
            }),
          }
        : { raw_chunks: allExtractions };

    // Save to cache
    try {
      // fs.writeFileSync(
      //   cachePath,
      //   JSON.stringify(finalResult, null, 2),
      //   'utf-8'
      // );
    } catch (err) {
      console.warn('⚠️ Failed to write cache:', err);
    }

    console.log(
      '✅ All chunks processed. Returning combined extractions.'
    );
    return finalResult;
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

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
      m.total_debt &&
      m.shareholders_equity &&
      m.shareholders_equity !== 0
        ? m.total_debt / m.shareholders_equity
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

const CACHE_DIR = path.join(os.tmpdir(), 'lendflow-cache');
if (!existsSync(CACHE_DIR)) {
  // Use fs from destructured import
  import('fs').then((fs) =>
    fs.mkdirSync(CACHE_DIR, { recursive: true })
  );
}

function hashBuffer(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// ─────────── helper: split large text into manageable chunks ───────────
function chunkText(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) {
    chunks.push(text.slice(i, i + maxChars));
  }
  return chunks;
}

// ─────────── helper: hash a text chunk ───────────
function hashChunk(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

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
      problems.push('Debt-to-equity ratio is not a finite number');
    }
    if (
      data.interest_coverage_ratio != null &&
      !isFinite(data.interest_coverage_ratio)
    ) {
      problems.push('Interest coverage ratio is not a finite number');
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

// ────────────── Validation: Detect scale inconsistencies ──────────────
function validateScaleInconsistencies(
  metrics: Record<string, any>
): string[] {
  const sampleValues: number[] = [];

  for (const year of Object.keys(metrics)) {
    const yearMetrics = metrics[year];
    const values = Object.values(yearMetrics).filter(
      (v) => typeof v === 'number' && isFinite(v)
    ) as number[];

    sampleValues.push(...values);
  }

  if (sampleValues.length === 0) return [];

  const max = Math.max(...sampleValues);
  const min = Math.min(...sampleValues);

  const ratio = max / Math.max(min, 1); // avoid div-by-zero

  if (ratio > 1000) {
    return [
      'Detected unusually large spread in financial values. Possible inconsistent scaling (e.g. mixed thousands and full values).',
    ];
  }

  return [];
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
    let fileContent: string;
    if (resolvedPath.endsWith('.pdf')) {
      // PDF: Try pdf-parse, then pdf2json as fallback
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
    } else {
      fileContent = readFileSync(resolvedPath, 'utf-8').trim();
    }
    const CHUNK_SIZE = 8_000;
    const textChunks = chunkText(fileContent, CHUNK_SIZE);
    console.log(
      `✅ Prepared ${textChunks.length} text chunk(s) for analysis.`
    );
    const allExtractions: any[] = [];
    let riskSnapshot: any | null = null;
    const seenChunks = new Set<string>();
    for (let i = 0; i < textChunks.length; i++) {
      const trimmedChunk = textChunks[i].trim();
      const hash = hashChunk(trimmedChunk);
      if (seenChunks.has(hash)) {
        console.log(`⏩ Duplicate chunk ${i + 1} skipped`);
        continue;
      }
      seenChunks.add(hash);
      console.log(
        `🤖 Processing chunk ${i + 1}/${textChunks.length}…`
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
        // temperature: 0.1,
        // temperature: 0.2,
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
      "shareholders_equity": number|null,
      "total_debt": number|null
    }
  }
}

• Be flexible in identifying synonyms and alternate phrasing for metrics (e.g. "turnover" = revenue, "retained earnings" may contribute to shareholders_equity, "total liabilities" may indicate total_debt).

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
              if (
                typeof value === 'number' &&
                Number.isFinite(value)
              ) {
                metrics[key] = value;
              }
            }
          }
        }
        allExtractions.push(maybeObj);
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

    // Consolidate all partial JSONs
    const merged: Record<string, any> = {};
    for (const obj of allExtractions) {
      if (obj && typeof obj === 'object' && obj.metrics_by_year) {
        for (const [yr, metrics] of Object.entries<any>(
          obj.metrics_by_year
        )) {
          if (!merged[yr]) merged[yr] = { ...metrics };
          else {
            for (const key of Object.keys(metrics)) {
              if (merged[yr][key] == null && metrics[key] != null) {
                merged[yr][key] = metrics[key];
              }
            }
          }
        }
      }
    }
    //************************* */
    // 📊 DEBUG: Log shareholders_equity and total_debt for each year
    // for (const [year, data] of Object.entries(merged)) {
    //   console.log(`📊 Year: ${year}`);
    //   console.log(
    //     `  • Shareholders' Equity: ${data.shareholders_equity}`
    //   );
    //   console.log(`  • Total Debt: ${data.total_debt ?? 'N/A'}`);
    //   if (
    //     data.total_debt &&
    //     data.shareholders_equity &&
    //     data.shareholders_equity !== 0
    //   ) {
    //     data.debt_to_equity_ratio =
    //       data.total_debt / data.shareholders_equity;
    //   }
    // }

    // Freeze the financial metrics as canonical input for risk assessment caching
    const canonicalMetricsJson = JSON.stringify(
      merged,
      Object.keys(merged).sort()
    );
    console.log('🔎 Canonical Metrics JSON:', canonicalMetricsJson);
    const canonicalMetricsHash = crypto
      .createHash('sha256')
      .update(canonicalMetricsJson)
      .digest('hex');
    console.log('🔑 Metrics Hash for Cache:', canonicalMetricsHash);
    const cachedRiskPath = getCachedAnalysisPath(
      `${canonicalMetricsHash}-risk`
    );

    // let riskSnapshot: any | null = null;
    if (existsSync(cachedRiskPath)) {
      try {
        const riskData = readFileSync(cachedRiskPath, 'utf-8');
        riskSnapshot = JSON.parse(riskData);
        console.log('♻️ Reusing cached risk assessment');
      } catch (e) {
        console.warn('⚠️ Failed to load cached risk snapshot:', e);
      }
    }

    const ratiosByYear = buildMetricRatios(merged);
    const validationIssues = validateMetrics(ratiosByYear);
    const scaleIssues = validateScaleInconsistencies(ratiosByYear);
    if (!riskSnapshot) {
      console.log(
        '🔍 No riskAssessment captured; requesting summary…'
      );
      try {
        const riskResp = await openai.chat.completions.create({
          model: 'gpt-4-turbo-2024-04-09',
          temperature: 0,
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
      // After riskSnapshot is generated, cache the result
      if (riskSnapshot) {
        try {
          import('fs').then((fs) =>
            fs.writeFileSync(
              cachedRiskPath,
              JSON.stringify(riskSnapshot, null, 2),
              'utf-8'
            )
          );
        } catch (e) {
          console.warn('⚠️ Failed to write risk cache file:', e);
        }
      }
    }

    let finalResult: any;
    if (Object.keys(merged).length > 0 || riskSnapshot) {
      finalResult = {
        ...(Object.keys(merged).length > 0 && {
          metrics_by_year: merged,
        }),
        ...(riskSnapshot && { riskAssessment: riskSnapshot }),
        ...(Object.keys(validationIssues).length > 0 && {
          validation_issues: validationIssues,
        }),
        ...(scaleIssues.length > 0 && {
          validation_issues: {
            ...validationIssues,
            scale: scaleIssues,
          },
        }),
      };
    } else {
      finalResult = { raw_chunks: allExtractions };
    }
    // (Cache writing logic omitted)
    console.log(
      '✅ Chunk processing complete. Returning combined extraction.'
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

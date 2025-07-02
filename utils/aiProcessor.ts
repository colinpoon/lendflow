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
    let riskSnapshot: any | null = null; // capture first riskAssessment

    for (let i = 0; i < textChunks.length; i++) {
      console.log(
        `🤖 Sending chunk ${i + 1}/${textChunks.length} to OpenAI…`
      );

      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-2024-04-09',
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

RULES  
• Detect every fiscal year present (e.g. 2025, 2024, 2023) and use it as the JSON key.  
• Emit numeric values as plain JSON numbers – **no quotes, commas, or currency symbols**.  
• If a value is unavailable for a metric, output null (do NOT omit the key).  
• If net_income, interest, taxes, and depreciation_amortization are all non‑null for a year, compute:  
  "ebitda" = net_income + interest + taxes + depreciation_amortization  
  (otherwise leave ebitda as null).  
• Do not add any keys, explanations, or narrative – JSON object only.

This schema must work for any financial statement worldwide.
`,
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
        const cleaned = cleanJsonFence(extractedText);
        allExtractions.push(JSON.parse(cleaned));
        // capture a riskAssessment if present
        const maybeObj = allExtractions.at(-1);
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
    if (!riskSnapshot) {
      console.log(
        '🔍 No riskAssessment captured; requesting summary…'
      );
      try {
        const riskResp = await openai.chat.completions.create({
          model: 'gpt-4-turbo-2024-04-09',
          temperature: 0.1,
          max_tokens: 1200,
          messages: [
            {
              role: 'system',
              content: `
You are a credit‑risk analyst for SME lending.

Return **valid JSON** in the schema:
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
  "weighted_score": number|null,
  "band": string,
  "lending_recommendation": string
}

Compute weighted_score = Σ(weight × score)/100 and select band:
0–2 “Very Low”, 2–4 “Moderate‑Low”, 4–6 “Moderate”, 6–8 “Elevated”, 8–10 “High”.
JSON only.`,
            },
            { role: 'user', content: fileContent.slice(0, 100_000) },
          ],
        });

        const rawRisk = riskResp.choices[0]?.message?.content ?? '{}';
        riskSnapshot = JSON.parse(cleanJsonFence(rawRisk));
      } catch (e) {
        console.warn('⚠️  Risk snapshot generation failed:', e);
      }
    }

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
    /* if nothing parsed, fall back to raw array */
    const finalResult =
      Object.keys(merged).length > 0 || riskSnapshot
        ? {
            ...(Object.keys(merged).length > 0 && {
              metrics_by_year: merged,
            }),
            ...(riskSnapshot && { riskAssessment: riskSnapshot }),
          }
        : { raw_chunks: allExtractions };

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

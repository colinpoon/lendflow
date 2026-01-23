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

function getCachedAnalysisPath(hash: string): string {
  return path.join(CACHE_DIR, `${hash}.json`);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Extracts financial data from an uploaded document.
 * If the file is a PDF we use pdf‑parse (which disables pdf.js workers automatically),
 * otherwise we treat it as plain text.
 * Large extracted text is chunked into ~8 kB pieces and each chunk
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
      "reported_adjusted_ebitda": number|null,
      "shareholders_equity": number|null,
      "total_debt": number|null,
      "senior_debt": number|null,
      "debt_service_payments": number|null,
      "adjusted_ebitda_components": {
        "stock_based_compensation": number|null,
        "impairment_charges": number|null,
        "goodwill_impairment": number|null,
        "bad_debt_provision": number|null,
        "unrealized_gains_losses": number|null,
        "deferred_compensation": number|null,
        "loss_on_disposal": number|null,
        "other_non_cash": number|null,
        "restructuring_costs": number|null,
        "severance_costs": number|null,
        "transaction_costs": number|null,
        "legal_settlements": number|null,
        "professional_fees_one_time": number|null,
        "casualty_losses": number|null,
        "other_one_time_expenses": number|null,
        "gain_on_disposal": number|null,
        "gain_on_asset_sale": number|null,
        "other_income_non_operating": number|null,
        "insurance_proceeds": number|null,
        "other_one_time_gains": number|null,
        "owner_compensation_adjustment": number|null,
        "related_party_adjustments": number|null,
        "management_fees_adjustment": number|null,
        "accounting_policy_adjustments": number|null,
        "foreign_exchange_adjustments": number|null,
        "pro_forma_cost_savings": number|null,
        "pro_forma_synergies": number|null
      }
    }
  }
}

• Be flexible in identifying synonyms and alternate phrasing for metrics (e.g. "turnover" = revenue, "retained earnings" may contribute to shareholders_equity, "total liabilities" may indicate total_debt).

REPORTED ADJUSTED EBITDA
• IMPORTANT: If the document explicitly reports an "Adjusted EBITDA" figure (common in MD&A, press releases, or capital management sections), extract it directly into "reported_adjusted_ebitda". This takes priority over calculated values.
• Look for phrases like "Adjusted EBITDA was", "Adjusted EBITDA of", or reconciliation tables showing Adjusted EBITDA.

ADJUSTED EBITDA COMPONENTS EXTRACTION
Look for these terms to populate adjusted_ebitda_components. Note: Gains/income items will be SUBTRACTED from EBITDA; Losses/expense items will be ADDED back.

CRITICAL - EXTRACT THESE ADJUSTMENT ITEMS FOR ACCURATE ADJUSTED EBITDA:

Non-Cash Adjustments (ADD BACK to EBITDA):
• stock_based_compensation: IMPORTANT - Use the value from the CASH FLOW STATEMENT under "Operating activities" adjustments. Look for "Stock based compensation" or "Share-based compensation" or "Stock-based payments". This is the TOTAL non-cash stock compensation. Do NOT use the smaller figure from notes which may only show options.
• impairment_charges: "impairment", "asset write-down"
• goodwill_impairment: "goodwill impairment"
• bad_debt_provision: "bad debt provision", "allowance for doubtful accounts"
• unrealized_gains_losses: "unrealized loss", "unrealized gain", "mark-to-market"
• deferred_compensation: "deferred compensation"
• loss_on_disposal: Sum ALL disposal losses from income statement: "Loss on sale of equipment", "Loss on disposal of right-of-use assets". When shown as "Loss (gain) on sale" with a POSITIVE number, that's a loss - extract it. For 2023 example: 27 + 81 = 108.
• other_non_cash: "non-cash expense", "noncash", "straight-line rent", "non-cash interest expense"

One-Time/Non-Recurring Expenses (ADD BACK to EBITDA):
• restructuring_costs: "restructuring", "reorganization costs"
• severance_costs: "severance"
• transaction_costs: "transaction costs", "deal costs", "integration costs"
• legal_settlements: "legal settlement", "litigation expense"
• professional_fees_one_time: one-time "professional fees", "consulting fees"
• casualty_losses: "casualty loss", "disaster-related costs"
• other_one_time_expenses: "one-time expense", "non-recurring expense"

SUBTRACT from EBITDA (these inflate net income):
• gain_on_disposal: Sum ALL disposal gains. When "Loss (gain) on sale" shows a number in PARENTHESES like (139), that's a GAIN of 139 - extract as positive 139. Sum all such gains.
• gain_on_asset_sale: "gain on sale", "asset sale gain"
• other_income_non_operating: Look for "Other income" or "Other (income)" on income statement. Values in parentheses like (2,159) mean income of 2,159. Extract as positive number.
• insurance_proceeds: "insurance proceeds"
• other_one_time_gains: "settlement income", "extraordinary gain"

FOREIGN EXCHANGE (CRITICAL FOR ACCURACY):
• foreign_exchange_adjustments: Look for "Foreign exchange (gain) loss" or "FX gain/loss" on income statement.
  - If shown as POSITIVE number (e.g., 70), it's a LOSS - extract as POSITIVE (add back)
  - If shown in PARENTHESES like (2), it's a GAIN - extract as NEGATIVE (subtract)
  Example: "Foreign exchange (gain) loss (2)" means $2 gain, extract as -2
  Example: "Foreign exchange (gain) loss 70" means $70 loss, extract as 70

PARENTHESES CONVENTION IN FINANCIAL STATEMENTS:
- Numbers in parentheses = opposite of the label
- "Loss (gain) on sale (139)" = GAIN of 139 (parentheses reverse "loss" to "gain")
- "Foreign exchange (gain) loss (2)" = GAIN of 2
- "Other income (2,159)" = INCOME of 2,159

Owner/Management Adjustments (add back):
• owner_compensation_adjustment: "owner compensation", "excess compensation", "family payroll", "personal expenses", "owner bonus"
• related_party_adjustments: "related-party expense", "related-party transactions"
• management_fees_adjustment: "management fees"

Other Adjustments:
• accounting_policy_adjustments: "change in accounting policy", "change in estimate"
• foreign_exchange_adjustments: "foreign exchange", "fx gain", "fx loss", "currency translation"
• pro_forma_cost_savings: "pro forma", "run-rate", "cost savings", "headcount reduction", "facility closure"
• pro_forma_synergies: "synergies", "operational efficiencies"

RULES
• Detect every fiscal year present (e.g. 2025, 2024, 2023) and use it as the JSON key.
• Emit numeric values as plain JSON numbers – **no quotes, commas, or currency symbols**.
• If a value is unavailable for a metric, output null (do NOT omit the key).
• For EBITDA calculation: ebitda = net_income + interest + taxes + depreciation_amortization
• "total_debt" = sum of all short‑term and long‑term debt/borrowings.
• "senior_debt" = senior/secured debt. If the document does not explicitly mention subordinated, mezzanine, or junior debt, assume ALL debt is senior debt (i.e., senior_debt = total_debt).
• "debt_service_payments" = annual principal repayments + interest expense. If principal repayments are not stated, use interest expense alone as an estimate.

CRITICAL - ADJUSTED EBITDA COMPONENTS:
• You MUST extract adjusted_ebitda_components from the income statement and notes.
• Look for "Share-based payments expense" line item - extract as stock_based_compensation
• Look for "Other income" or "Other (income) expense" line items - extract the income amount as other_income_non_operating
• Look for "Loss (gain) on sale/disposal" line items - extract losses as loss_on_disposal, gains as gain_on_disposal
• These adjustments are ESSENTIAL for calculating Adjusted EBITDA accurately.

• Do not add any keys, explanations, or narrative – JSON object only.
• IMPORTANT: Extract numeric values EXACTLY as they appear in the document. Do NOT multiply or scale values. If the document reports values "in thousands" or "$000s", keep them in thousands.

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
          if (!merged[yr]) {
            merged[yr] = { ...metrics };
            // Deep copy adjusted_ebitda_components if present
            if (metrics.adjusted_ebitda_components) {
              merged[yr].adjusted_ebitda_components = { ...metrics.adjusted_ebitda_components };
            }
          } else {
            for (const key of Object.keys(metrics)) {
              // Special handling for nested adjusted_ebitda_components
              if (key === 'adjusted_ebitda_components' && metrics[key] != null) {
                if (!merged[yr].adjusted_ebitda_components) {
                  merged[yr].adjusted_ebitda_components = {};
                }
                // Merge each component, keeping non-null values
                for (const [compKey, compValue] of Object.entries(metrics[key])) {
                  if (merged[yr].adjusted_ebitda_components[compKey] == null && compValue != null) {
                    merged[yr].adjusted_ebitda_components[compKey] = compValue;
                  }
                }
              } else if (merged[yr][key] == null && metrics[key] != null) {
                merged[yr][key] = metrics[key];
              }
            }
          }
        }
      }
    }

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

    /* ────────────── compute debt ratios ────────────── */
    for (const yr of Object.keys(merged)) {
      const m = merged[yr];

      // Fallback: if senior_debt is null but total_debt exists, assume all debt is senior
      if (m.senior_debt == null && m.total_debt != null) {
        m.senior_debt = m.total_debt;
      }

      // Fallback: if debt_service_payments is null but interest exists, use interest as estimate
      if (m.debt_service_payments == null && m.interest != null) {
        m.debt_service_payments = m.interest;
      }

      // Debt Service Coverage Ratio = EBITDA / Annual Debt Service Payments
      if (m.ebitda != null && m.debt_service_payments != null && m.debt_service_payments !== 0) {
        m.dscr = parseFloat((m.ebitda / m.debt_service_payments).toFixed(2));
      } else {
        m.dscr = null;
      }

      // Senior Debt / EBITDA
      if (m.senior_debt != null && m.ebitda != null && m.ebitda !== 0) {
        m.senior_debt_to_ebitda = parseFloat((m.senior_debt / m.ebitda).toFixed(2));
      } else {
        m.senior_debt_to_ebitda = null;
      }

      // Total Debt / Total Capital (Total Capital = Total Debt + Shareholders Equity)
      if (m.total_debt != null && m.shareholders_equity != null) {
        const totalCapital = m.total_debt + m.shareholders_equity;
        if (totalCapital !== 0) {
          m.total_debt_to_capital = parseFloat((m.total_debt / totalCapital).toFixed(2));
        } else {
          m.total_debt_to_capital = null;
        }
      } else {
        m.total_debt_to_capital = null;
      }

      // Calculate Adjusted EBITDA
      if (m.ebitda != null) {
        const adj = m.adjusted_ebitda_components || {};

        // Sum non-cash adjustments (add back)
        const nonCashAdjustments = [
          adj.stock_based_compensation,
          adj.impairment_charges,
          adj.goodwill_impairment,
          adj.bad_debt_provision,
          adj.unrealized_gains_losses,
          adj.deferred_compensation,
          adj.loss_on_disposal, // Loss on disposal of assets - add back
          adj.other_non_cash,
        ].filter((v): v is number => v != null).reduce((sum, v) => sum + v, 0);

        // Sum one-time expenses (add back)
        const oneTimeExpenses = [
          adj.restructuring_costs,
          adj.severance_costs,
          adj.transaction_costs,
          adj.legal_settlements,
          adj.professional_fees_one_time,
          adj.casualty_losses,
          adj.other_one_time_expenses,
        ].filter((v): v is number => v != null).reduce((sum, v) => sum + v, 0);

        // Sum one-time gains (subtract) - these inflated net income and should be removed
        const oneTimeGains = [
          adj.gain_on_disposal, // Gain on disposal of assets
          adj.gain_on_asset_sale,
          adj.other_income_non_operating, // Other income (non-operating) like bonuses, vendor rebates
          adj.insurance_proceeds,
          adj.other_one_time_gains,
        ].filter((v): v is number => v != null).reduce((sum, v) => sum + v, 0);

        // Sum owner/management adjustments (add back)
        const ownerManagementAdjustments = [
          adj.owner_compensation_adjustment,
          adj.related_party_adjustments,
          adj.management_fees_adjustment,
        ].filter((v): v is number => v != null).reduce((sum, v) => sum + v, 0);

        // Sum other adjustments
        const accountingAdjustments = adj.accounting_policy_adjustments ?? 0;
        const fxAdjustments = adj.foreign_exchange_adjustments ?? 0;
        const proFormaAdjustments = [
          adj.pro_forma_cost_savings,
          adj.pro_forma_synergies,
        ].filter((v): v is number => v != null).reduce((sum, v) => sum + v, 0);

        // Calculate Adjusted EBITDA = Base EBITDA + Add-backs - Gains
        const calculatedAdjustedEbitda = parseFloat((
          m.ebitda +
          nonCashAdjustments +
          oneTimeExpenses +
          ownerManagementAdjustments +
          accountingAdjustments +
          fxAdjustments +
          proFormaAdjustments -
          oneTimeGains
        ).toFixed(2));

        // Use company-reported Adjusted EBITDA if available, otherwise use calculated
        m.adjusted_ebitda = m.reported_adjusted_ebitda ?? calculatedAdjustedEbitda;
        m.calculated_adjusted_ebitda = calculatedAdjustedEbitda;

        // Store breakdown totals for display
        m.adjusted_ebitda_breakdown = {
          base_ebitda: m.ebitda,
          non_cash_adjustments: nonCashAdjustments,
          one_time_expenses: oneTimeExpenses,
          one_time_gains: oneTimeGains,
          owner_management_adjustments: ownerManagementAdjustments,
          accounting_adjustments: accountingAdjustments,
          fx_adjustments: fxAdjustments,
          pro_forma_adjustments: proFormaAdjustments,
          uses_reported_value: m.reported_adjusted_ebitda != null,
        };
      } else {
        m.adjusted_ebitda = m.reported_adjusted_ebitda ?? null;
        m.calculated_adjusted_ebitda = null;
        m.adjusted_ebitda_breakdown = null;
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
      };
    } else {
      finalResult = { raw_chunks: allExtractions };
    }

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

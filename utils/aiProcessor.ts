// Suppress Buffer() deprecation warning from pdf-parse dependency
// This is a known issue in the pdf-parse library
process.noDeprecation = true;

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
      "capital_expenditures": number|null,
      "debt_components": {
        "bank_debt_current": number|null,
        "bank_debt_long_term": number|null,
        "term_loans": number|null,
        "revolving_credit_facilities": number|null,
        "overdraft_facilities": number|null,
        "lease_liabilities_current": number|null,
        "lease_liabilities_long_term": number|null,
        "finance_lease_liabilities": number|null,
        "operating_lease_liabilities": number|null,
        "notes_payable": number|null,
        "subordinated_debt": number|null,
        "convertible_debt": number|null,
        "bonds_debentures": number|null,
        "lines_of_credit": number|null,
        "other_borrowings": number|null
      },
      "total_debt": number|null,
      "senior_debt": number|null,
      "fixed_charges": {
        "interest_expense": number|null,
        "lease_payments": number|null,
        "principal_payments": number|null,
        "rent_expense": number|null,
        "preferred_dividends": number|null,
        "other_fixed_charges": number|null
      },
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
• NOTE: bad_debt_provision is a CORE OPERATING EXPENSE - do NOT add it back to EBITDA. It reflects the normal cost of extending credit.
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

DEBT EXTRACTION - CRITICAL FOR ACCURACY:
Extract all debt components from the Balance Sheet liabilities section:

IMPORTANT - DEBT ORDERING INDICATES SENIORITY:
Financial statements list debt in descending order of seniority (most senior first). Use this ordering as a classification signal:
• Items listed FIRST (top of debt section) = Most senior (secured bank debt, credit facilities)
• Items listed in MIDDLE = Typically senior secured (leases, term loans)
• Items listed LAST (bottom of debt section) = Usually subordinated (notes payable, mezzanine, convertible)

debt_components extraction (in typical seniority order):
SENIOR DEBT (highest priority - listed first in reports):
• bank_debt_current: Current portion of bank debt, credit facilities, term loans due within 1 year
• bank_debt_long_term: Long-term bank debt, term loans due after 1 year
• term_loans: Named term loans (e.g., "Term Loan" at specific interest rate)
• revolving_credit_facilities: Revolving equipment financing, revolving credit lines
• overdraft_facilities: Authorized overdraft, bank overdraft facilities
• lines_of_credit: General lines of credit, credit lines
• lease_liabilities_current: Current portion of lease liabilities (operating + finance)
• lease_liabilities_long_term: Non-current lease liabilities
• finance_lease_liabilities: Finance/capital lease obligations
• operating_lease_liabilities: Operating lease liabilities under IFRS 16/ASC 842

SUBORDINATED/JUNIOR DEBT (lower priority - listed last in reports):
• notes_payable: Notes payable, promissory notes, vendor take-back notes (often subordinated)
• subordinated_debt: Explicitly subordinated debt, mezzanine debt, junior debt
• convertible_debt: Convertible notes, convertible bonds
• bonds_debentures: Corporate bonds, debentures (unless explicitly senior secured)
• other_borrowings: Any other debt not categorized above

CRITICAL DEBT CALCULATION RULES:
• LEVERAGE DOCUMENT ORDER: When unsure of seniority, use position in the document. Debt items appearing earlier in the liabilities section or debt schedules are typically more senior.
• Look for debt breakdowns in the notes to financial statements (e.g., "Note 8: Credit Facilities", "Note 9: Lease Liabilities", "Note 10: Note Payable")
• "senior_debt" = bank_debt (current + long-term) + ALL lease_liabilities (current + long-term). Senior debt is secured debt that has priority in bankruptcy.
• Notes payable, especially vendor take-back notes or those described as "subordinated", are NOT senior debt.
• "total_debt" = senior_debt + notes_payable + subordinated_debt + any other non-senior debt
• If the document shows "Current debt" and "Long term debt" line items, these typically refer to bank debt only, NOT lease liabilities.
• Lease liabilities are often shown separately from bank debt on the balance sheet.
• When a note or schedule lists multiple debt facilities, the ORDER they appear indicates relative seniority.

FIXED CHARGES EXTRACTION (CRITICAL FOR FCCR CALCULATION):
Extract from CASH FLOW STATEMENT and INCOME STATEMENT:
• interest_expense: From income statement "Finance costs" or "Interest expense". Include interest on debt, leases, and notes payable.
• lease_payments: From cash flow statement "Payment of lease liability" or "Lease payments". This is the TOTAL cash paid for leases during the year.
• principal_payments: From cash flow statement "Repayment of debt" or "Principal repayments". Cash paid to reduce debt principal.
• rent_expense: Operating lease rent NOT capitalized under IFRS 16 (short-term or low-value leases). Often in notes or G&A breakdown.
• preferred_dividends: Cash dividends paid on preferred shares (if any).
• other_fixed_charges: Any other recurring fixed obligations that must be paid regardless of business performance.

IMPORTANT: For IFRS 16 companies, lease_payments from cash flow statement captures the full lease obligation. Do NOT double-count with rent_expense.

CAPITAL EXPENDITURES (CRITICAL FOR FCCR CALCULATION):
• capital_expenditures: From CASH FLOW STATEMENT under "Investing activities". Look for:
  - "Purchase of property, plant and equipment" or "PP&E additions"
  - "Acquisition of fixed assets" or "Capital additions"
  - "Purchase of intangible assets" (if significant)
  - Sum ALL capital asset purchases to get total CapEx
  - This represents cash spent on maintaining/growing the business
  - Extract as POSITIVE number (even though shown as negative cash outflow on statement)

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
            // Deep copy debt_components if present
            if (metrics.debt_components) {
              merged[yr].debt_components = { ...metrics.debt_components };
            }
            // Deep copy fixed_charges if present
            if (metrics.fixed_charges) {
              merged[yr].fixed_charges = { ...metrics.fixed_charges };
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
              // Special handling for nested debt_components
              } else if (key === 'debt_components' && metrics[key] != null) {
                if (!merged[yr].debt_components) {
                  merged[yr].debt_components = {};
                }
                // Merge each component, keeping non-null values
                for (const [compKey, compValue] of Object.entries(metrics[key])) {
                  if (merged[yr].debt_components[compKey] == null && compValue != null) {
                    merged[yr].debt_components[compKey] = compValue;
                  }
                }
              // Special handling for nested fixed_charges
              } else if (key === 'fixed_charges' && metrics[key] != null) {
                if (!merged[yr].fixed_charges) {
                  merged[yr].fixed_charges = {};
                }
                // Merge each component, keeping non-null values
                for (const [compKey, compValue] of Object.entries(metrics[key])) {
                  if (merged[yr].fixed_charges[compKey] == null && compValue != null) {
                    merged[yr].fixed_charges[compKey] = compValue;
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
      const dc = m.debt_components || {};

      // Calculate bank debt from components
      const bankDebtCurrent = dc.bank_debt_current ?? 0;
      const bankDebtLongTerm = dc.bank_debt_long_term ?? 0;
      const termLoans = dc.term_loans ?? 0;
      const revolvingCredit = dc.revolving_credit_facilities ?? 0;
      const overdraft = dc.overdraft_facilities ?? 0;
      const linesOfCredit = dc.lines_of_credit ?? 0;

      // Total bank debt = explicit bank debt OR sum of loan components
      let totalBankDebt = bankDebtCurrent + bankDebtLongTerm;
      if (totalBankDebt === 0) {
        totalBankDebt = termLoans + revolvingCredit + overdraft + linesOfCredit;
      }

      // Calculate lease liabilities from components
      const leaseCurrentDirect = dc.lease_liabilities_current ?? 0;
      const leaseLongTermDirect = dc.lease_liabilities_long_term ?? 0;
      const financeLease = dc.finance_lease_liabilities ?? 0;
      const operatingLease = dc.operating_lease_liabilities ?? 0;

      // Total lease liabilities = explicit lease liabilities OR sum of lease types
      let totalLeaseDebt = leaseCurrentDirect + leaseLongTermDirect;
      if (totalLeaseDebt === 0) {
        totalLeaseDebt = financeLease + operatingLease;
      }

      // Calculate non-senior debt (subordinated)
      const notesPayable = dc.notes_payable ?? 0;
      const subordinatedDebt = dc.subordinated_debt ?? 0;
      const convertibleDebt = dc.convertible_debt ?? 0;
      const bondsDebentures = dc.bonds_debentures ?? 0;
      const otherBorrowings = dc.other_borrowings ?? 0;

      const totalNonSeniorDebt = notesPayable + subordinatedDebt + convertibleDebt + bondsDebentures + otherBorrowings;

      // Store computed debt breakdown for display
      m.debt_breakdown = {
        bank_debt: totalBankDebt,
        lease_liabilities: totalLeaseDebt,
        notes_payable: notesPayable,
        subordinated_debt: subordinatedDebt,
        other_non_senior_debt: convertibleDebt + bondsDebentures + otherBorrowings,
      };

      // Compute senior_debt = bank debt + lease liabilities (secured/priority debt)
      const computedSeniorDebt = totalBankDebt + totalLeaseDebt;
      if (computedSeniorDebt > 0) {
        m.senior_debt = computedSeniorDebt;
      } else if (m.senior_debt == null && m.total_debt != null) {
        // Fallback: if no components extracted but total_debt exists, assume all debt is senior
        m.senior_debt = m.total_debt;
      }

      // Compute total_debt = senior_debt + non-senior debt
      const computedTotalDebt = computedSeniorDebt + totalNonSeniorDebt;
      if (computedTotalDebt > 0) {
        m.total_debt = computedTotalDebt;
      }

      // ────────────── Calculate EBITDA from components if not provided ──────────────
      // EBITDA = Net Income + Interest + Taxes + Depreciation & Amortization
      if (m.ebitda == null) {
        const netIncome = m.net_income;
        const interest = m.interest ?? (m.fixed_charges?.interest_expense ?? null);
        const taxes = m.taxes;
        const depAmort = m.depreciation_amortization;

        // We need at minimum net_income and depreciation to calculate a meaningful EBITDA
        if (netIncome != null && depAmort != null) {
          const calculatedEbitda =
            netIncome +
            (interest ?? 0) +
            (taxes ?? 0) +
            depAmort;

          m.ebitda = parseFloat(calculatedEbitda.toFixed(2));
          m.ebitda_calculated = true; // Flag to indicate this was computed, not extracted
          console.log(`📊 Computed EBITDA for ${yr}: ${m.ebitda} (from components)`);
        }
      }

      // ────────────── Calculate Adjusted EBITDA ──────────────
      // This must happen before FCCR and Senior Debt/EBITDA calculations
      if (m.ebitda != null) {
        const adj = m.adjusted_ebitda_components || {};

        // Sum non-cash adjustments (add back)
        // Note: bad_debt_provision is NOT included - it's a core operating expense
        const nonCashAdjustments = [
          adj.stock_based_compensation,
          adj.impairment_charges,
          adj.goodwill_impairment,
          adj.unrealized_gains_losses,
          adj.deferred_compensation,
          adj.loss_on_disposal,
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

        // Sum one-time gains (subtract)
        const oneTimeGains = [
          adj.gain_on_disposal,
          adj.gain_on_asset_sale,
          adj.other_income_non_operating,
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

        // Calculate Adjusted EBITDA
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
          reported_ebitda: m.ebitda,
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

      // Calculate Fixed Charge Coverage Ratio (FCCR)
      // Base formula: (EBITDA + Lease Payments) / (Interest + Lease Payments + Principal)
      // Enhanced formula (when data available): Deduct Taxes and/or CapEx from numerator
      //
      const fc = m.fixed_charges || {};

      // Get available data components
      const ebitdaValue = m.adjusted_ebitda ?? m.ebitda;
      const interestExpense = fc.interest_expense ?? m.interest;
      const leasePayments = fc.lease_payments ?? fc.rent_expense ?? 0;
      const principalPayments = fc.principal_payments ?? 0;
      const taxesPaid = m.taxes ?? 0;
      const capitalExpenditures = m.capital_expenditures ?? 0;

      // MINIMUM REQUIRED: EBITDA and Interest
      const hasMinimumData = ebitdaValue != null && ebitdaValue > 0 && interestExpense != null && interestExpense > 0;

      if (hasMinimumData) {
        // Build numerator: EBITDA + Lease Payments
        let fccrNumerator = ebitdaValue + leasePayments;

        // Conditionally subtract taxes if provided
        const hasTaxes = taxesPaid > 0;
        if (hasTaxes) {
          fccrNumerator -= taxesPaid;
        }

        // Conditionally subtract CapEx if provided
        const hasCapEx = capitalExpenditures > 0;
        if (hasCapEx) {
          fccrNumerator -= capitalExpenditures;
        }

        // Denominator: Interest + Lease Payments + Principal
        let fccrDenominator = interestExpense + leasePayments;
        const hasPrincipal = principalPayments > 0;
        if (hasPrincipal) {
          fccrDenominator += principalPayments;
        }

        // Calculate FCCR
        if (fccrDenominator > 0) {
          m.fccr = parseFloat((fccrNumerator / fccrDenominator).toFixed(2));
          m.fccr_numerator = parseFloat(fccrNumerator.toFixed(2));
          m.total_fixed_charges = parseFloat(fccrDenominator.toFixed(2));

          // Determine calculation type
          const calculationType = (hasTaxes || hasCapEx) ? 'enhanced' : 'standard';

          m.fccr_breakdown = {
            calculation_type: calculationType,
            // Numerator components
            ebitda: ebitdaValue,
            lease_rent_add_back: leasePayments || null,
            taxes_deducted: hasTaxes ? taxesPaid : null,
            capex_deducted: hasCapEx ? capitalExpenditures : null,
            numerator: fccrNumerator,
            // Denominator components
            interest_expense: interestExpense,
            lease_payments: leasePayments || null,
            principal_payments: hasPrincipal ? principalPayments : null,
            denominator: fccrDenominator,
            // Data availability flags
            has_taxes: hasTaxes,
            has_capex: hasCapEx,
            has_principal: hasPrincipal,
            has_lease_payments: leasePayments > 0
          };
        } else {
          m.fccr = null;
          m.fccr_numerator = null;
          m.total_fixed_charges = null;
          m.fccr_breakdown = null;
        }
      } else {
        // Not enough data to calculate FCCR
        m.fccr = null;
        m.fccr_numerator = null;
        m.total_fixed_charges = null;
        m.fccr_breakdown = null;
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

      // Senior Debt / Adjusted EBITDA (uses Adjusted EBITDA for more accurate leverage assessment)
      const ebitdaForLeverage = m.adjusted_ebitda ?? m.ebitda;
      if (m.senior_debt != null && ebitdaForLeverage != null && ebitdaForLeverage !== 0) {
        m.senior_debt_to_ebitda = parseFloat((m.senior_debt / ebitdaForLeverage).toFixed(2));
      } else {
        m.senior_debt_to_ebitda = null;
      }
    }

    /* ────────────── Generate Debt Health Assessment with AI ────────────── */
    let debtHealthAssessment: any = null;

    // Check if we have the required metrics for debt health assessment
    const latestYear = Object.keys(merged).sort().reverse()[0];
    const latestMetrics = merged[latestYear];

    if (
      latestMetrics &&
      (latestMetrics.fccr != null ||
        latestMetrics.senior_debt_to_ebitda != null ||
        latestMetrics.total_debt_to_capital != null)
    ) {
      // Calculate weighted risk score for context
      const getFCCRScore = (v: number | null) => {
        if (v == null) return 5;
        if (v >= 2.0) return 1;
        if (v >= 1.5) return 3;
        if (v >= 1.2) return 5;
        if (v >= 1.0) return 7;
        if (v >= 0) return 9;
        return 10;
      };

      const getDebtEBITDAScore = (v: number | null) => {
        if (v == null) return 5;
        if (v <= 1.5) return 1;
        if (v <= 2.5) return 3;
        if (v <= 3.0) return 5;
        if (v <= 4.0) return 7;
        return 9;
      };

      const getDebtCapitalScore = (v: number | null) => {
        if (v == null) return 5;
        if (v < 0.3) return 1;
        if (v <= 0.5) return 3;
        if (v <= 0.6) return 5;
        if (v <= 0.7) return 7;
        return 9;
      };

      const fccrScore = getFCCRScore(latestMetrics.fccr);
      const debtEbitdaScore = getDebtEBITDAScore(latestMetrics.senior_debt_to_ebitda);
      const debtCapitalScore = getDebtCapitalScore(latestMetrics.total_debt_to_capital);
      const calculatedWeightedScore =
        fccrScore * 0.5 + debtEbitdaScore * 0.35 + debtCapitalScore * 0.15;

      const getRiskBand = (score: number) => {
        if (score <= 2) return 'Very Low Risk';
        if (score <= 4) return 'Low Risk';
        if (score <= 6) return 'Moderate Risk';
        if (score <= 8) return 'Elevated Risk';
        return 'High Risk';
      };

      try {
        console.log('🎯 Generating AI debt health assessment...');
        const debtHealthResp = await openai.chat.completions.create({
          model: 'gpt-4-turbo-2024-04-09',
          temperature: 0,
          max_tokens: 1500,
          messages: [
            {
              role: 'system',
              content: `
You are a senior credit analyst. Based on the financial metrics provided, generate a debt health assessment.

Return EXACT JSON matching this schema — no markdown, no fences, no extra keys:

{
  "weighted_score": number (0-10 scale, higher = worse risk),
  "risk_band": "Very Low Risk" | "Low Risk" | "Moderate Risk" | "Elevated Risk" | "High Risk",
  "lending_decision": string (one of: "Strong Approve", "Approve", "Conditional Approval", "Further Review Required", "Decline"),
  "key_risk_factors": string[] (3-5 specific concerns based on the numbers),
  "positive_factors": string[] (2-4 strengths if any exist),
  "recommendations": string[] (3-5 actionable suggestions for loan structuring or risk mitigation),
  "suggested_loan_structure": string (specific loan terms recommendation based on risk profile)
}

SCORING WEIGHTS:
- FCCR (Fixed Charge Coverage Ratio): 50% weight
- Senior Debt / Adjusted EBITDA: 35% weight
- Total Debt / Total Capital: 15% weight

SCORING THRESHOLDS (each metric scored 0-10, higher = worse):
- FCCR: >=2.0x=1 (excellent), 1.5-2.0=3 (good), 1.2-1.5=5 (adequate), 1.0-1.2=7 (weak), <1.0=9 (poor), negative=10 (critical)
- Debt/EBITDA: <=1.5x=1, 1.5-2.5x=3, 2.5-3.0x=5, 3.0-4.0x=7, >4.0x=9
- Debt/Capital: <30%=1, 30-50%=3, 50-60%=5, 60-70%=7, >70%=9

LENDING DECISION GUIDANCE:
- Score 0-2: Strong Approve
- Score 2-4: Approve
- Score 4-6: Conditional Approval
- Score 6-8: Further Review Required
- Score 8-10: Decline

Be specific and reference actual values from the metrics. Consider year-over-year trends if multiple years provided.
`.trim(),
            },
            {
              role: 'user',
              content: JSON.stringify({
                latest_year: latestYear,
                metrics_by_year: merged,
                calculated_scores: {
                  fccr_score: fccrScore,
                  debt_ebitda_score: debtEbitdaScore,
                  debt_capital_score: debtCapitalScore,
                  weighted_score: calculatedWeightedScore,
                  risk_band: getRiskBand(calculatedWeightedScore),
                },
              }),
            },
          ],
        });

        const rawDebtHealth =
          debtHealthResp.choices[0]?.message?.content ?? '{}';
        debtHealthAssessment = JSON.parse(cleanJsonFence(rawDebtHealth));
        console.log('✅ AI debt health assessment generated');
      } catch (e) {
        console.warn('⚠️ Debt health assessment generation failed:', e);
        // Fallback to calculated values
        debtHealthAssessment = {
          weighted_score: calculatedWeightedScore,
          risk_band: getRiskBand(calculatedWeightedScore),
          lending_decision:
            calculatedWeightedScore <= 2
              ? 'Strong Approve'
              : calculatedWeightedScore <= 4
              ? 'Approve'
              : calculatedWeightedScore <= 6
              ? 'Conditional Approval'
              : calculatedWeightedScore <= 8
              ? 'Further Review Required'
              : 'Decline',
          key_risk_factors: [],
          positive_factors: [],
          recommendations: [],
          suggested_loan_structure: '',
        };
      }
    }

    let finalResult: any;
    if (Object.keys(merged).length > 0 || riskSnapshot || debtHealthAssessment) {
      finalResult = {
        ...(Object.keys(merged).length > 0 && {
          metrics_by_year: merged,
        }),
        ...(riskSnapshot && { riskAssessment: riskSnapshot }),
        ...(debtHealthAssessment && { debtHealthAssessment }),
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

/**
 * Test Vision Extraction Pipeline
 *
 * Usage: node scripts/test-vision-extraction.mjs [pdf-path] [page-number]
 *
 * Examples:
 *   node scripts/test-vision-extraction.mjs
 *   node scripts/test-vision-extraction.mjs ./public/financialReports/custom.pdf
 *   node scripts/test-vision-extraction.mjs ./public/financialReports/custom.pdf 3
 *
 * Environment:
 *   ANTHROPIC_API_KEY - Required for Claude Vision API
 */

import Anthropic from '@anthropic-ai/sdk';
import { pdf } from 'pdf-to-img';
import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables (check both .env and .env.local)
config({ path: join(__dirname, '../.env') });
config({ path: join(__dirname, '../.env.local') });

// Constants
const DEFAULT_SCALE = 4.17; // 300 DPI
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_PDF = './public/financialReports/2024-12-31-Q4-Zedcor-Inc.-Financial-Stmts-4.9.2025v1.pdf';

// Extraction tool definition (matches lib/vision/extraction-tool.ts)
const EXTRACTION_TOOL = {
  name: 'extract_financial_metrics',
  description: `Extract financial metrics from a financial document image.

IMPORTANT GUIDELINES:
- All monetary values should be in thousands USD (e.g., $1.5M = 1500)
- Only extract values explicitly stated in the document
- Do NOT calculate derived values (e.g., don't calculate EBITDA from components)
- Interest expense must be POSITIVE (if shown as negative, convert to positive)
- If a value is not found, use null
- Fiscal year should match document labeling (e.g., "2023", "FY23", "Q3 2023")

Call this tool with all extracted financial metrics.`,
  input_schema: {
    type: 'object',
    properties: {
      fiscal_year: {
        type: 'string',
        description: 'The fiscal year (e.g., "2023", "FY2023", "2023Q3")',
      },
      revenue: {
        type: ['number', 'null'],
        description: 'Total revenue/sales in thousands USD',
      },
      net_income: {
        type: ['number', 'null'],
        description: 'Net income/profit in thousands USD',
      },
      expenses: {
        type: ['number', 'null'],
        description: 'Total operating expenses in thousands USD',
      },
      interest: {
        type: ['number', 'null'],
        description: 'Interest expense in thousands USD (must be positive)',
      },
      taxes: {
        type: ['number', 'null'],
        description: 'Income tax expense in thousands USD',
      },
      depreciation_amortization: {
        type: ['number', 'null'],
        description: 'Total depreciation and amortization in thousands USD',
      },
      ebitda: {
        type: ['number', 'null'],
        description: 'EBITDA if explicitly stated in document (do not calculate)',
      },
      shareholders_equity: {
        type: ['number', 'null'],
        description: 'Total shareholders equity in thousands USD',
      },
      total_debt: {
        type: ['number', 'null'],
        description: 'Total debt (all borrowings) in thousands USD',
      },
      senior_debt: {
        type: ['number', 'null'],
        description: 'Senior/bank debt only in thousands USD',
      },
      capital_expenditures: {
        type: ['number', 'null'],
        description: 'Capital expenditures (CapEx) in thousands USD',
      },
    },
    required: ['fiscal_year'],
  },
};

const EXTRACTION_PROMPT = `You are a financial analyst extracting data from a financial document image.

Analyze this financial document page and extract ALL financial metrics you can find.

Focus on:
1. Income Statement: revenue, net income, expenses, interest, taxes, depreciation/amortization
2. Balance Sheet: total debt, senior debt, shareholders equity
3. Cash Flow: CapEx
4. EBITDA: Only if explicitly stated (do not calculate)

CRITICAL RULES:
- Report all values in THOUSANDS USD (divide millions by 1000)
- Interest expense must be POSITIVE
- Only report values explicitly visible in the document
- Use null for values not found

Call the extract_financial_metrics tool with your findings.`;

/**
 * Validate API key is present
 */
function validateApiKey() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY environment variable is required.\n' +
      'Get your API key from https://console.anthropic.com/settings/keys\n' +
      'Add it to .env.local: ANTHROPIC_API_KEY=sk-ant-...'
    );
  }
}

/**
 * Test Claude Vision API connection
 */
async function testVisionConnection(client) {
  // Minimal 1x1 white PNG for testing
  const testImage = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
    'base64'
  );

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 100,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: testImage.toString('base64'),
            },
          },
          {
            type: 'text',
            text: 'Describe this image in one word.',
          },
        ],
      },
    ],
  });

  console.log('Vision API connection test: SUCCESS');
  console.log('Model:', CLAUDE_MODEL);
  console.log(
    'Tokens used:',
    response.usage.input_tokens,
    'in /',
    response.usage.output_tokens,
    'out'
  );

  return true;
}

/**
 * Convert PDF page to image
 */
async function convertPdfPage(pdfPath, pageNumber, scale = DEFAULT_SCALE) {
  const document = await pdf(pdfPath, { scale });
  const page = await document.getPage(pageNumber);
  return Buffer.from(page);
}

/**
 * Convert all PDF pages to images
 */
async function convertPdfToImages(pdfPath, scale = DEFAULT_SCALE) {
  const document = await pdf(pdfPath, { scale });
  const results = [];
  let pageNumber = 1;
  for await (const page of document) {
    results.push({
      pageNumber,
      image: Buffer.from(page),
    });
    pageNumber++;
  }
  return results;
}

/**
 * Analyze a financial document image with Claude Vision
 */
async function analyzeFinancialImage(client, imageBuffer) {
  const base64Data = imageBuffer.toString('base64');

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    tools: [EXTRACTION_TOOL],
    tool_choice: { type: 'tool', name: 'extract_financial_metrics' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: base64Data,
            },
          },
          {
            type: 'text',
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ],
  });

  // Extract tool call result
  const toolUse = response.content.find((block) => block.type === 'tool_use');

  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Claude did not return extraction results');
  }

  const extracted = toolUse.input;
  const { fiscal_year, ...metrics } = extracted;

  return {
    fiscalYear: fiscal_year,
    metrics,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}

/**
 * Merge two metrics objects (prefer non-null values from newer extraction)
 */
function mergeMetrics(existing, incoming) {
  const merged = { ...existing };

  for (const key of Object.keys(incoming)) {
    const incomingValue = incoming[key];
    const existingValue = existing[key];

    if (incomingValue === null || incomingValue === undefined) {
      continue;
    }

    if (existingValue === null || existingValue === undefined) {
      merged[key] = incomingValue;
      continue;
    }

    if (typeof incomingValue === 'object' && typeof existingValue === 'object') {
      merged[key] = { ...existingValue, ...incomingValue };
      continue;
    }

    merged[key] = incomingValue;
  }

  return merged;
}

/**
 * Extract from single page
 */
async function extractFromPdfPage(client, pdfPath, pageNumber) {
  const imageBuffer = await convertPdfPage(pdfPath, pageNumber);
  return analyzeFinancialImage(client, imageBuffer);
}

/**
 * Extract from full PDF
 */
async function extractFromPdf(client, pdfPath) {
  const allPages = await convertPdfToImages(pdfPath);

  const pageResults = [];
  const metricsByYear = {};
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const page of allPages) {
    console.log(`Processing page ${page.pageNumber}/${allPages.length}...`);

    try {
      const result = await analyzeFinancialImage(client, page.image);

      pageResults.push({
        pageNumber: page.pageNumber,
        result,
      });

      const year = result.fiscalYear;
      if (metricsByYear[year]) {
        metricsByYear[year] = mergeMetrics(metricsByYear[year], result.metrics);
      } else {
        metricsByYear[year] = result.metrics;
      }

      totalInputTokens += result.usage.inputTokens;
      totalOutputTokens += result.usage.outputTokens;
    } catch (error) {
      console.error(`Error processing page ${page.pageNumber}:`, error.message);
    }
  }

  return {
    metricsByYear,
    pageResults,
    totalUsage: {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    },
    pagesProcessed: pageResults.length,
  };
}

/**
 * Main test function
 */
async function main() {
  const args = process.argv.slice(2);
  const pdfPath = args[0] ? resolve(args[0]) : resolve(__dirname, '..', DEFAULT_PDF);
  const pageNumber = args[1] ? parseInt(args[1], 10) : undefined;

  console.log('='.repeat(60));
  console.log('Vision Extraction Test');
  console.log('='.repeat(60));
  console.log(`PDF: ${pdfPath}`);
  console.log(`Page: ${pageNumber ?? 'all'}`);
  console.log('');

  // Validate API key
  validateApiKey();

  // Create client
  const client = new Anthropic();

  // Step 1: Test API connection
  console.log('[1/3] Testing Claude Vision API connection...');
  try {
    await testVisionConnection(client);
    console.log('API connection: OK\n');
  } catch (error) {
    console.error('API connection FAILED:', error.message);
    console.error('\nMake sure ANTHROPIC_API_KEY is set in .env.local');
    process.exit(1);
  }

  // Step 2: Run extraction
  console.log('[2/3] Running extraction...');
  const startTime = Date.now();

  try {
    if (pageNumber) {
      // Single page extraction
      const result = await extractFromPdfPage(client, pdfPath, pageNumber);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log(`\nExtraction completed in ${elapsed}s`);
      console.log(`Fiscal Year: ${result.fiscalYear}`);
      console.log(
        `Tokens: ${result.usage.inputTokens} in / ${result.usage.outputTokens} out`
      );
      console.log('\nExtracted Metrics:');
      console.log(JSON.stringify(result.metrics, null, 2));

      // Save result
      const outputPath = `/tmp/vision-extraction-page-${pageNumber}.json`;
      writeFileSync(outputPath, JSON.stringify(result, null, 2));
      console.log(`\nSaved to: ${outputPath}`);
    } else {
      // Full PDF extraction
      const result = await extractFromPdf(client, pdfPath);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log(`\nExtraction completed in ${elapsed}s`);
      console.log(`Pages processed: ${result.pagesProcessed}`);
      console.log(
        `Fiscal years found: ${Object.keys(result.metricsByYear).join(', ')}`
      );
      console.log(
        `Total tokens: ${result.totalUsage.inputTokens} in / ${result.totalUsage.outputTokens} out`
      );

      // Show key metrics for each year
      console.log('\n[3/3] Key Metrics by Year:');
      for (const [year, metrics] of Object.entries(result.metricsByYear)) {
        console.log(`\n--- ${year} ---`);
        console.log(`  Revenue: ${metrics.revenue ?? 'N/A'}`);
        console.log(`  Net Income: ${metrics.net_income ?? 'N/A'}`);
        console.log(`  EBITDA: ${metrics.ebitda ?? 'N/A'}`);
        console.log(`  Total Debt: ${metrics.total_debt ?? 'N/A'}`);
        console.log(`  Senior Debt: ${metrics.senior_debt ?? 'N/A'}`);
        console.log(`  D&A: ${metrics.depreciation_amortization ?? 'N/A'}`);
        console.log(`  Interest: ${metrics.interest ?? 'N/A'}`);
        console.log(`  Taxes: ${metrics.taxes ?? 'N/A'}`);
      }

      // Save full result
      const outputPath = `/tmp/vision-extraction-full.json`;
      writeFileSync(outputPath, JSON.stringify(result, null, 2));
      console.log(`\nFull results saved to: ${outputPath}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('Test PASSED - Vision extraction pipeline working');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\nExtraction FAILED:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

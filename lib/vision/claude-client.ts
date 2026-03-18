/**
 * Claude Vision API Client
 * Sends financial document images to Claude and returns structured extractions.
 *
 * CHANGE from v1: The extraction tool now returns a `years` array (multi-year
 * support) rather than a single top-level fiscal_year field. This client
 * unpacks that array and returns PageExtractionResult, which contains one
 * YearExtraction per fiscal-year column found on the page.
 */

import Anthropic from '@anthropic-ai/sdk';
import { EXTRACTION_TOOL, EXTRACTION_PROMPT } from './extraction-tool';
import type { ExtractedMetrics } from '@/types/financial';
import { AI_CONFIG } from '@/lib/constants';

// Model identifier — falls back to default if ANTHROPIC_MODEL env var is not set
const CLAUDE_MODEL = AI_CONFIG.MODEL;

// ─────────────────────────────────────────────────────────────────────────────
// Public Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Metrics extracted for a single fiscal year from a single page.
 */
export interface YearExtraction {
  /** Fiscal year label exactly as returned by Claude (e.g., "2023", "FY2023") */
  fiscalYear: string;
  /** Extracted metrics for this year */
  metrics: ExtractedMetrics;
}

/**
 * Result of analyzing a single page image.
 * A page may contain multiple fiscal year columns so we return an array.
 */
export interface PageExtractionResult {
  /** All fiscal years extracted from this page (1–N entries) */
  yearExtractions: YearExtraction[];
  /** Scale note from the model describing unit inference */
  scaleNote: string | null;
  /** Token usage for this API call */
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Raw tool output types (mirrors extractionToolSchema in extraction-tool.ts)
// ─────────────────────────────────────────────────────────────────────────────

interface RawYearEntry {
  fiscal_year: string;
  fiscal_year_end_date?: string | null;
  fiscal_period_type?: 'annual' | 'interim' | 'quarterly' | null;
  [key: string]: unknown;
}

interface RawToolOutput {
  scale_note?: string;
  years: RawYearEntry[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Client Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate that ANTHROPIC_API_KEY is configured.
 * @throws Error if the variable is missing
 */
export function validateApiKey(): void {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY environment variable is required. ' +
        'Get your API key from https://console.anthropic.com/settings/keys'
    );
  }
}

/**
 * Create a configured Anthropic client instance.
 * The SDK automatically reads ANTHROPIC_API_KEY from environment.
 * maxRetries: 3 enables the SDK's built-in exponential backoff with jitter,
 * handling transient 429/5xx errors before surfacing them to the caller.
 */
export function createVisionClient(): Anthropic {
  validateApiKey();
  return new Anthropic({ maxRetries: 3 });
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Extraction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyze a financial document image with Claude Vision.
 * Returns all fiscal year columns found on the page.
 *
 * @param client - Anthropic client instance
 * @param imageBuffer - PNG image as Buffer
 * @returns PageExtractionResult with one YearExtraction per fiscal-year column
 * @throws Error if Claude does not return a valid tool call
 */
export async function analyzeFinancialImage(
  client: Anthropic,
  imageBuffer: Buffer
): Promise<PageExtractionResult> {
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

  // Locate the tool_use block
  const toolUse = response.content.find((block) => block.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Claude did not return extraction results — no tool_use block found');
  }

  const raw = toolUse.input as RawToolOutput;

  // Guard against malformed responses
  if (!Array.isArray(raw.years) || raw.years.length === 0) {
    throw new Error(
      'Claude returned an empty years array. The page may not contain financial tables.'
    );
  }

  // Convert each raw year entry into a typed YearExtraction
  const yearExtractions: YearExtraction[] = raw.years.map((entry) => {
    const { fiscal_year, ...rest } = entry;
    return {
      fiscalYear: fiscal_year,
      metrics: rest as unknown as ExtractedMetrics,
    };
  });

  return {
    yearExtractions,
    scaleNote: raw.scale_note ?? null,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Connection Test
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Test the Claude Vision API connection using a minimal 1×1 PNG.
 * @returns true if the API call succeeds
 * @throws Error with details if the connection fails
 */
export async function testVisionConnection(): Promise<boolean> {
  const client = createVisionClient();

  // Minimal 1×1 white PNG — keeps test cost near zero
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
    `Tokens used: ${response.usage.input_tokens} in / ${response.usage.output_tokens} out`
  );

  return true;
}

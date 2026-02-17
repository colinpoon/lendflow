/**
 * Claude Vision API Client
 * Sends images to Claude and returns structured financial extractions
 */

import Anthropic from '@anthropic-ai/sdk';
import { EXTRACTION_TOOL, EXTRACTION_PROMPT } from './extraction-tool';
import type { ExtractedMetrics } from '@/types/financial';

// Model ID for Claude 3.7 Sonnet (current as of 2026-02)
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

/**
 * Validate that ANTHROPIC_API_KEY is configured
 * @throws Error if API key is missing
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
 * Create an Anthropic client instance
 * SDK automatically reads ANTHROPIC_API_KEY from environment
 */
export function createVisionClient(): Anthropic {
  validateApiKey();
  return new Anthropic();
}

/**
 * Result of a single page extraction
 */
export interface ExtractionResult {
  /** Fiscal year identifier from the document */
  fiscalYear: string;
  /** Extracted metrics for this year */
  metrics: ExtractedMetrics;
  /** Token usage for this request */
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Analyze a financial document image with Claude Vision
 * Uses tool calling to ensure structured JSON output
 *
 * @param client - Anthropic client instance
 * @param imageBuffer - PNG image as Buffer
 * @returns Extracted financial metrics with fiscal year
 */
export async function analyzeFinancialImage(
  client: Anthropic,
  imageBuffer: Buffer
): Promise<ExtractionResult> {
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
              data: base64Data, // Raw base64, NOT data URL
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

  const extracted = toolUse.input as ExtractedMetrics & { fiscal_year: string };
  const { fiscal_year, ...metrics } = extracted;

  return {
    fiscalYear: fiscal_year,
    metrics: metrics as ExtractedMetrics,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}

/**
 * Test the Claude Vision API connection
 * Uses a minimal 1x1 white PNG to verify API key works
 *
 * @returns true if connection successful
 * @throws Error with details if connection fails
 */
export async function testVisionConnection(): Promise<boolean> {
  const client = createVisionClient();

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

  // If we get here without throwing, connection works
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

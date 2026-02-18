/**
 * Cost Calculation Utilities
 *
 * Provides pricing constants and cost calculation functions for both
 * vision (Claude) and text (OpenAI) extraction pipelines.
 *
 * Used by:
 * - COST-01: Token usage logging
 * - COST-02: Cost comparison between pipelines
 */

// ─────────────────────────────────────────────────────────────────────────────
// Pricing Constants (as of 2026-02)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Claude Sonnet 4 (claude-sonnet-4-20250514) - Vision Pipeline
 * https://www.anthropic.com/pricing
 */
export const VISION_COST_PER_M_INPUT = 3.0; // USD per million input tokens
export const VISION_COST_PER_M_OUTPUT = 15.0; // USD per million output tokens

/**
 * GPT-4 Turbo (gpt-4-turbo-2024-04-09) - Text Pipeline
 * https://openai.com/pricing
 */
export const TEXT_COST_PER_M_INPUT = 10.0; // USD per million input tokens
export const TEXT_COST_PER_M_OUTPUT = 30.0; // USD per million output tokens

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Token usage from an extraction operation
 */
export interface TokenUsage {
  /** Number of input (prompt) tokens */
  input_tokens: number;
  /** Number of output (completion) tokens */
  output_tokens: number;
  /** Model identifier used for extraction */
  model: string;
}

/**
 * Detailed cost breakdown for an extraction
 */
export interface CostBreakdown {
  /** Cost of input tokens in USD */
  input_cost: number;
  /** Cost of output tokens in USD */
  output_cost: number;
  /** Total cost in USD */
  total_cost: number;
  /** Model identifier */
  model: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cost Calculation Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate cost for vision pipeline (Claude Sonnet 4)
 *
 * @param usage - Token usage from vision extraction
 * @returns Detailed cost breakdown in USD
 */
export function calculateVisionCost(usage: TokenUsage): CostBreakdown {
  const inputCost = (usage.input_tokens / 1_000_000) * VISION_COST_PER_M_INPUT;
  const outputCost =
    (usage.output_tokens / 1_000_000) * VISION_COST_PER_M_OUTPUT;

  return {
    input_cost: inputCost,
    output_cost: outputCost,
    total_cost: inputCost + outputCost,
    model: usage.model,
  };
}

/**
 * Calculate cost for text pipeline (GPT-4 Turbo)
 *
 * @param usage - Token usage from text extraction
 * @returns Detailed cost breakdown in USD
 */
export function calculateTextCost(usage: TokenUsage): CostBreakdown {
  const inputCost = (usage.input_tokens / 1_000_000) * TEXT_COST_PER_M_INPUT;
  const outputCost = (usage.output_tokens / 1_000_000) * TEXT_COST_PER_M_OUTPUT;

  return {
    input_cost: inputCost,
    output_cost: outputCost,
    total_cost: inputCost + outputCost,
    model: usage.model,
  };
}

/**
 * Unified cost calculator for either pipeline
 *
 * @param usage - Token usage from extraction
 * @param pipeline - Which pipeline was used ('vision' or 'text')
 * @returns Detailed cost breakdown in USD
 */
export function calculateCost(
  usage: TokenUsage,
  pipeline: 'vision' | 'text'
): CostBreakdown {
  return pipeline === 'vision'
    ? calculateVisionCost(usage)
    : calculateTextCost(usage);
}

/**
 * Format cost for display (e.g., "$0.0234" or "<$0.01")
 *
 * @param costUsd - Cost in USD
 * @returns Formatted string with dollar sign
 */
export function formatCost(costUsd: number): string {
  if (costUsd < 0.01) {
    return '<$0.01';
  }
  return `$${costUsd.toFixed(4)}`;
}

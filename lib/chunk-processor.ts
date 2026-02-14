/**
 * Text chunking and AI processing utilities
 * Handles document chunking, deduplication, and OpenAI API calls
 *
 * DETERMINISTIC PROCESSING:
 * Chunks are processed sequentially to ensure consistent ordering.
 * Results are always returned sorted by chunk index, guaranteeing
 * the same output order regardless of API response timing.
 */

import OpenAI from 'openai';
import crypto from 'crypto';
import { AI_CONFIG } from './constants';
import { FINANCIAL_EXTRACTION_PROMPT } from './prompts/extraction-prompt';
import type { ExtractedMetrics } from '@/types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─────────────────────────────────────────────────────────────────────────────
// Text Chunking
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Split text into manageable chunks
 * @param text - The text to chunk
 * @param maxChars - Maximum characters per chunk
 */
export function chunkText(
  text: string,
  maxChars: number = AI_CONFIG.CHUNK_SIZE
): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) {
    chunks.push(text.slice(i, i + maxChars));
  }
  return chunks;
}

/**
 * Hash a text chunk for deduplication
 */
export function hashChunk(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export interface UniqueChunk {
  index: number;
  content: string;
}

/**
 * Deduplicate chunks based on content hash
 * @param chunks - Array of text chunks
 * @returns Array of unique chunks with their original indices
 */
export function deduplicateChunks(chunks: string[]): UniqueChunk[] {
  const seen = new Set<string>();
  const unique: UniqueChunk[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const trimmed = chunks[i].trim();
    const hash = hashChunk(trimmed);

    if (!seen.has(hash)) {
      seen.add(hash);
      unique.push({ index: i + 1, content: trimmed });
    } else {
      console.log(`⏩ Duplicate chunk ${i + 1} skipped`);
    }
  }

  return unique;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Processing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Raw extraction result from AI
 * Contains metrics organized by fiscal year
 */
export interface AIExtractionResponse {
  metrics_by_year?: Record<string, Partial<ExtractedMetrics>>;
  [key: string]: unknown; // Allow additional fields from AI response
}

/**
 * Result of processing a single chunk
 */
export interface ChunkResult {
  /** Original chunk index (1-based) */
  index: number;
  /** Parsed extraction result, or null if processing failed */
  result: AIExtractionResponse | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress Callback
// ─────────────────────────────────────────────────────────────────────────────

export type ProgressCallback = (progress: {
  stage: string;
  progress: number;
  message: string;
  chunk?: number;
  totalChunks?: number;
}) => void;

/**
 * Process a single chunk with the AI model
 * Only retries on rate limit errors (429)
 */
export async function processChunk(chunk: UniqueChunk): Promise<ChunkResult> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= AI_CONFIG.MAX_RETRIES; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: AI_CONFIG.MODEL,
        temperature: AI_CONFIG.TEMPERATURE,
        max_tokens: AI_CONFIG.MAX_TOKENS,
        messages: [
          { role: 'system', content: FINANCIAL_EXTRACTION_PROMPT },
          { role: 'user', content: chunk.content },
        ],
      });

      const extractedText = response.choices?.[0]?.message?.content ?? '{}';
      console.log(`🤖 Chunk ${chunk.index} response received`);
      console.log(
        `📄 Raw AI response for chunk ${chunk.index}:\n${extractedText}\n${'─'.repeat(80)}`
      );

      const cleaned = cleanJsonFence(extractedText);
      const parsed = JSON.parse(cleaned);
      return { index: chunk.index, result: parsed };
    } catch (err: unknown) {
      lastError = err;
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorStatus = (err as { status?: number })?.status;

      // Only retry on rate limit errors (429)
      const isRateLimit =
        errorStatus === 429 ||
        errorMessage.includes('429') ||
        errorMessage.includes('Rate limit');

      if (isRateLimit && attempt < AI_CONFIG.MAX_RETRIES) {
        const waitMatch = errorMessage.match(/try again in (\d+\.?\d*)/i);
        const waitTime = waitMatch
          ? Math.ceil(parseFloat(waitMatch[1]) * 1000) + 1000
          : attempt * AI_CONFIG.RATE_LIMIT_BACKOFF_MS;
        console.log(
          `⏳ Rate limited on chunk ${chunk.index}, waiting ${waitTime / 1000}s before retry ${attempt + 1}/${AI_CONFIG.MAX_RETRIES}...`
        );
        await delay(waitTime);
        continue;
      }

      // For non-rate-limit errors, don't retry - fail immediately
      break;
    }
  }

  const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
  console.warn(`⚠️ Failed to process chunk ${chunk.index}: ${errorMessage}`);
  return { index: chunk.index, result: null };
}

/**
 * Process chunks SEQUENTIALLY for deterministic results
 * This replaces parallel batch processing to ensure consistent extraction order.
 *
 * @param chunks - Unique chunks to process in order
 * @param onProgress - Optional callback for progress updates
 * @returns Array of ChunkResult sorted by chunk index
 */
export async function processChunksSequentially(
  chunks: UniqueChunk[],
  onProgress?: ProgressCallback
): Promise<ChunkResult[]> {
  const results: ChunkResult[] = [];

  console.log(
    `📊 Processing ${chunks.length} unique chunks SEQUENTIALLY for deterministic extraction`
  );

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`\n⚡ Processing chunk ${i + 1}/${chunks.length} (index: ${chunk.index})`);

    // Report progress before processing each chunk
    onProgress?.({
      stage: 'extracting',
      progress: Math.round(20 + (i / chunks.length) * 50), // 20-70% range
      message: `Analyzing chunk ${i + 1} of ${chunks.length}`,
      chunk: i + 1,
      totalChunks: chunks.length,
    });

    const result = await processChunk(chunk);
    results.push(result);

    console.log(`✅ Chunk ${chunk.index} complete`);

    // Add delay between chunks to respect rate limits (skip delay after last chunk)
    if (i < chunks.length - 1) {
      // Shorter delay for sequential processing since we're not batching
      const delayMs = Math.min(AI_CONFIG.BATCH_DELAY_MS / 2, 3000);
      console.log(`⏳ Waiting ${delayMs / 1000}s before next chunk...`);
      await delay(delayMs);
    }
  }

  // Sort by chunk index to guarantee deterministic order
  results.sort((a, b) => a.index - b.index);

  console.log(`\n🎯 All ${chunks.length} chunks processed in deterministic order`);
  return results;
}

/**
 * @deprecated Use processChunksSequentially for deterministic extraction
 * Process chunks in parallel batches - kept for backward compatibility
 * WARNING: Parallel processing can cause non-deterministic merge order
 * @param chunks - Unique chunks to process
 * @returns Array of extraction results (order may vary between runs)
 */
export async function processChunksInBatches(
  chunks: UniqueChunk[]
): Promise<AIExtractionResponse[]> {
  console.warn(
    '⚠️ processChunksInBatches is deprecated. Use processChunksSequentially for deterministic results.'
  );

  const results: ChunkResult[] = [];
  const totalBatches = Math.ceil(chunks.length / AI_CONFIG.BATCH_SIZE);

  console.log(
    `📊 Processing ${chunks.length} unique chunks in ${totalBatches} batches`
  );

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const batchStart = batchIndex * AI_CONFIG.BATCH_SIZE;
    const batchEnd = Math.min(batchStart + AI_CONFIG.BATCH_SIZE, chunks.length);
    const batchChunks = chunks.slice(batchStart, batchEnd);

    console.log(
      `⚡ Processing batch ${batchIndex + 1}/${totalBatches} (chunks ${batchStart + 1}-${batchEnd})`
    );

    const batchPromises = batchChunks.map((chunk) => processChunk(chunk));
    const batchResults = await Promise.allSettled(batchPromises);

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      }
    }

    console.log(`✅ Batch ${batchIndex + 1} complete`);

    // Add delay between batches to respect rate limits (skip delay after last batch)
    if (batchIndex < totalBatches - 1) {
      console.log(
        `⏳ Waiting ${AI_CONFIG.BATCH_DELAY_MS / 1000}s before next batch to respect rate limits...`
      );
      await delay(AI_CONFIG.BATCH_DELAY_MS);
    }
  }

  // Sort by chunk index for consistent ordering
  results.sort((a, b) => a.index - b.index);

  console.log(`🎯 All ${chunks.length} chunks processed`);

  // Return only the result objects (for backward compatibility)
  // Type assertion needed because TypeScript doesn't narrow through filter
  return results
    .filter((r): r is ChunkResult & { result: AIExtractionResponse } => r.result !== null)
    .map((r) => r.result);
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strip markdown code fence syntax from LLM responses
 */
export function cleanJsonFence(input: string): string {
  return input
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

/**
 * Delay execution for specified milliseconds
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

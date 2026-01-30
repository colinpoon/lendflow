/**
 * Text chunking and AI processing utilities
 * Handles document chunking, deduplication, and OpenAI API calls
 */

import OpenAI from 'openai';
import crypto from 'crypto';
import { AI_CONFIG } from './constants';
import { FINANCIAL_EXTRACTION_PROMPT } from './prompts/extraction-prompt';

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

export interface ChunkResult {
  index: number;
  result: any | null;
}

/**
 * Process a single chunk with the AI model
 * Includes retry logic for rate limit handling
 */
export async function processChunk(chunk: UniqueChunk): Promise<ChunkResult> {
  let lastError: any;

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
    } catch (err: any) {
      lastError = err;

      // Check if it's a rate limit error (429)
      const isRateLimit =
        err?.status === 429 ||
        err?.message?.includes('429') ||
        err?.message?.includes('Rate limit');

      if (isRateLimit && attempt < AI_CONFIG.MAX_RETRIES) {
        // Extract wait time from error message or use exponential backoff
        const waitMatch = err?.message?.match(/try again in (\d+\.?\d*)/i);
        const waitTime = waitMatch
          ? Math.ceil(parseFloat(waitMatch[1]) * 1000) + 1000
          : attempt * AI_CONFIG.RATE_LIMIT_BACKOFF_MS;
        console.log(
          `⏳ Rate limited on chunk ${chunk.index}, waiting ${waitTime / 1000}s before retry ${attempt + 1}/${AI_CONFIG.MAX_RETRIES}...`
        );
        await delay(waitTime);
        continue;
      }

      // For non-rate-limit errors or final attempt, break out
      break;
    }
  }

  console.warn(
    `⚠️ Failed to process chunk ${chunk.index} after ${AI_CONFIG.MAX_RETRIES} attempts:`,
    lastError?.message || lastError
  );
  return { index: chunk.index, result: null };
}

/**
 * Process chunks in parallel batches
 * @param chunks - Unique chunks to process
 * @returns Array of extraction results
 */
export async function processChunksInBatches(
  chunks: UniqueChunk[]
): Promise<any[]> {
  const results: any[] = [];
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
      if (result.status === 'fulfilled' && result.value.result) {
        results.push(result.value.result);
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

  console.log(`🎯 All ${chunks.length} chunks processed`);
  return results;
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

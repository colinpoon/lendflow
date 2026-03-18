/**
 * Risk assessment generation utilities
 * Generates AI-powered risk assessments and debt health evaluations
 */

import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';
import { AI_CONFIG } from './constants';
import { RISK_ASSESSMENT_PROMPT, DEBT_HEALTH_PROMPT } from './prompts/extraction-prompt';
import { cleanJsonFence } from './chunk-processor';
import {
  getFCCRRiskScore,
  getDebtEBITDARiskScore,
  getDebtCapitalRiskScore,
  getRiskBand,
} from './risk-scoring';
import { riskDataSchema, debtHealthAssessmentSchema } from './validation';
import type { RiskData, DebtHealthAssessment, ComputedMetrics } from '@/types';

// Gate financial data logs behind DEBUG_FINANCIALS to prevent sensitive data in production logs
const DEBUG_FINANCIALS = process.env.DEBUG_FINANCIALS === 'true';

// Anthropic Claude client for risk assessment.
// maxRetries: 3 enables the SDK's built-in exponential backoff with jitter,
// handling transient 429/5xx errors before surfacing them to the caller.
const anthropic = new Anthropic({ maxRetries: AI_CONFIG.MAX_RETRIES });

// In-memory LRU-style cache (max 100 entries; oldest entry evicted when full)
const RISK_CACHE_MAX = 100;
const riskCache = new Map<string, unknown>();

// ─────────────────────────────────────────────────────────────────────────────
// Risk Assessment Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate risk assessment using AI
 * @param metricsByYear - Financial metrics organized by year
 * @returns Risk assessment data or null if generation fails
 */
export async function generateRiskAssessment(
  metricsByYear: Record<string, ComputedMetrics>,
  userId?: string
): Promise<RiskData | null> {
  // Check cache first — scope to userId to prevent cross-user cache sharing
  const canonicalJson = JSON.stringify(
    metricsByYear,
    Object.keys(metricsByYear).sort()
  );
  const metricsHash = crypto.createHash('sha256').update(canonicalJson).digest('hex');
  const cacheKey = userId ? `${userId}:${metricsHash}-risk` : `${metricsHash}-risk`;

  if (riskCache.has(cacheKey)) {
    console.log('♻️ Reusing cached risk assessment');
    return riskCache.get(cacheKey) as RiskData;
  }

  // Build ratios for assessment
  const ratiosByYear: Record<string, ComputedMetrics & { interest_coverage_ratio: number | null; debt_to_equity_ratio: number | null }> = {};
  for (const [yr, m] of Object.entries(metricsByYear)) {
    // Prefer Adjusted EBITDA for ICR to stay consistent with FCCR/EBITDA Coverage numerators.
    // Fall back to raw EBITDA only when adjusted_ebitda is unavailable.
    // Return null (not 0) when both are absent — 0x ICR would mislead the AI assessor.
    const ebitdaForICR = m.adjusted_ebitda ?? m.ebitda;
    const icr =
      m.interest != null && m.interest > 0 && ebitdaForICR != null
        ? ebitdaForICR / m.interest
        : null;
    const d2e =
      m.total_debt && m.shareholders_equity && m.shareholders_equity !== 0
        ? m.total_debt / m.shareholders_equity
        : null;
    ratiosByYear[yr] = {
      ...m,
      interest_coverage_ratio: icr,
      debt_to_equity_ratio: d2e,
    };
  }

  console.log('🔍 Generating AI risk assessment...');

  try {
    const response = await anthropic.messages.create({
      model: AI_CONFIG.MODEL,
      max_tokens: AI_CONFIG.MAX_TOKENS,
      temperature: AI_CONFIG.TEMPERATURE,
      system: RISK_ASSESSMENT_PROMPT,
      messages: [
        { role: 'user', content: JSON.stringify(ratiosByYear) },
      ],
    });

    // Extract text from Claude response
    const textBlock = response.content.find((block) => block.type === 'text');
    const rawRisk = textBlock?.type === 'text' ? textBlock.text : '{}';
    const parsed = JSON.parse(cleanJsonFence(rawRisk));

    // Validate structure at the AI response boundary
    const validation = riskDataSchema.safeParse(parsed);
    if (!validation.success) {
      console.warn('⚠️ Risk assessment response failed schema validation:', validation.error.flatten().fieldErrors);
    }
    if (!validation.success) {
      return null;
    }
    const riskSnapshot = validation.data;

    // Cache the result — evict the oldest entry if at capacity
    if (riskCache.size >= RISK_CACHE_MAX) {
      const oldestKey = riskCache.keys().next().value;
      if (oldestKey !== undefined) {
        riskCache.delete(oldestKey);
      }
    }
    riskCache.set(cacheKey, riskSnapshot);

    console.log('✅ Risk assessment generated');
    return riskSnapshot;
  } catch (e) {
    console.warn('⚠️ Risk assessment generation failed:', e);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Debt Health Assessment Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate debt health assessment using AI
 * @param metricsByYear - Financial metrics organized by year
 * @returns Debt health assessment or null if generation fails
 */
export async function generateDebtHealthAssessment(
  metricsByYear: Record<string, ComputedMetrics>
): Promise<DebtHealthAssessment | null> {
  // Get latest year metrics
  const latestYear = Object.keys(metricsByYear).sort().reverse()[0];
  const latestMetrics = metricsByYear[latestYear];

  if (
    !latestMetrics ||
    (latestMetrics.fccr == null &&
      latestMetrics.senior_debt_to_ebitda == null &&
      latestMetrics.total_debt_to_capital == null)
  ) {
    return null;
  }

  // Calculate risk scores
  const fccrScore = getFCCRRiskScore(latestMetrics.fccr);
  const debtEbitdaScore = getDebtEBITDARiskScore(latestMetrics.senior_debt_to_ebitda);
  const debtCapitalScore = getDebtCapitalRiskScore(latestMetrics.total_debt_to_capital);
  const calculatedWeightedScore =
    fccrScore * 0.5 + debtEbitdaScore * 0.35 + debtCapitalScore * 0.15;

  console.log('🎯 Generating AI debt health assessment...');
  if (DEBUG_FINANCIALS) {
    console.log(
      `   FCCR: ${latestMetrics.fccr}, Debt/EBITDA: ${latestMetrics.senior_debt_to_ebitda}, Debt/Capital: ${latestMetrics.total_debt_to_capital}`
    );
  }

  try {
    const response = await anthropic.messages.create({
      model: AI_CONFIG.MODEL,
      max_tokens: 1500,
      temperature: AI_CONFIG.TEMPERATURE,
      system: DEBT_HEALTH_PROMPT,
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            latest_year: latestYear,
            metrics_by_year: metricsByYear,
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

    // Extract text from Claude response
    const textBlock = response.content.find((block) => block.type === 'text');
    const rawDebtHealth = textBlock?.type === 'text' ? textBlock.text : '{}';
    const parsed = JSON.parse(cleanJsonFence(rawDebtHealth));

    // Validate structure at the AI response boundary
    const validation = debtHealthAssessmentSchema.safeParse(parsed);
    if (!validation.success) {
      console.warn('⚠️ Debt health assessment response failed schema validation:', validation.error.flatten().fieldErrors);
    }
    if (!validation.success) {
      return null;
    }
    const assessment = validation.data;

    console.log('✅ AI debt health assessment generated');
    console.log(`   Recommendations: ${assessment.recommendations?.length || 0} items`);

    return assessment;
  } catch (e) {
    console.warn('⚠️ Debt health assessment generation failed:', e);

    // Fallback to calculated values
    return {
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

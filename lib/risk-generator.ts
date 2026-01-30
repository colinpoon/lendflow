/**
 * Risk assessment generation utilities
 * Generates AI-powered risk assessments and debt health evaluations
 */

import OpenAI from 'openai';
import crypto from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import os from 'os';
import { AI_CONFIG, CACHE_CONFIG } from './constants';
import { RISK_ASSESSMENT_PROMPT, DEBT_HEALTH_PROMPT } from './prompts/extraction-prompt';
import { cleanJsonFence } from './chunk-processor';
import {
  getFCCRRiskScore,
  getDebtEBITDARiskScore,
  getDebtCapitalRiskScore,
  getRiskBand,
} from './risk-scoring';
import type { RiskData, DebtHealthAssessment, ComputedMetrics } from '@/types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Cache directory setup
const CACHE_DIR = path.join(os.tmpdir(), CACHE_CONFIG.DIR_NAME);
if (!existsSync(CACHE_DIR)) {
  import('fs').then((fs) => fs.mkdirSync(CACHE_DIR, { recursive: true }));
}

function getCachedAnalysisPath(hash: string): string {
  return path.join(CACHE_DIR, `${hash}.json`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk Assessment Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate risk assessment using AI
 * @param metricsByYear - Financial metrics organized by year
 * @returns Risk assessment data or null if generation fails
 */
export async function generateRiskAssessment(
  metricsByYear: Record<string, ComputedMetrics>
): Promise<RiskData | null> {
  // Check cache first
  const canonicalJson = JSON.stringify(
    metricsByYear,
    Object.keys(metricsByYear).sort()
  );
  const metricsHash = crypto.createHash('sha256').update(canonicalJson).digest('hex');
  const cachedPath = getCachedAnalysisPath(`${metricsHash}-risk`);

  if (existsSync(cachedPath)) {
    try {
      const cached = readFileSync(cachedPath, 'utf-8');
      console.log('♻️ Reusing cached risk assessment');
      return JSON.parse(cached);
    } catch (e) {
      console.warn('⚠️ Failed to load cached risk snapshot:', e);
    }
  }

  // Build ratios for assessment
  const ratiosByYear: Record<string, any> = {};
  for (const [yr, m] of Object.entries(metricsByYear)) {
    const icr = m.interest && m.interest !== 0 ? (m.ebitda ?? 0) / m.interest : null;
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
    const response = await openai.chat.completions.create({
      model: AI_CONFIG.MODEL,
      temperature: AI_CONFIG.TEMPERATURE,
      max_tokens: AI_CONFIG.MAX_TOKENS,
      messages: [
        { role: 'system', content: RISK_ASSESSMENT_PROMPT },
        { role: 'user', content: JSON.stringify(ratiosByYear) },
      ],
    });

    const rawRisk = response.choices[0]?.message?.content ?? '{}';
    const riskSnapshot = JSON.parse(cleanJsonFence(rawRisk));

    // Cache the result
    try {
      writeFileSync(cachedPath, JSON.stringify(riskSnapshot, null, 2), 'utf-8');
    } catch (e) {
      console.warn('⚠️ Failed to write risk cache file:', e);
    }

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
  console.log(
    `   FCCR: ${latestMetrics.fccr}, Debt/EBITDA: ${latestMetrics.senior_debt_to_ebitda}, Debt/Capital: ${latestMetrics.total_debt_to_capital}`
  );

  try {
    const response = await openai.chat.completions.create({
      model: AI_CONFIG.MODEL,
      temperature: AI_CONFIG.TEMPERATURE,
      max_tokens: 1500,
      messages: [
        { role: 'system', content: DEBT_HEALTH_PROMPT },
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

    const rawDebtHealth = response.choices[0]?.message?.content ?? '{}';
    const assessment = JSON.parse(cleanJsonFence(rawDebtHealth));

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

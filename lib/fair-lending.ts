import 'server-only';
import { createAdminClient } from '@/utils/supabase/server';
import type { ExtractionResult } from '@/utils/aiProcessor';
import type { FairLendingMonitorInsert } from '@/lib/supabase/types';
import { logger } from '@/lib/logger';

/**
 * Revenue bucket thresholds (in thousands).
 *
 * SBA size standard tiers aligned with common commercial lending segmentation:
 *   micro:      < $1M   (< 1,000K)
 *   small:      < $10M  (< 10,000K)
 *   medium:     < $100M (< 100,000K)
 *   large:      < $1B   (< 1,000,000K)
 *   enterprise: >= $1B  (>= 1,000,000K)
 */
const REVENUE_BUCKET_THRESHOLDS = [
  { ceiling: 1_000, label: 'micro' },
  { ceiling: 10_000, label: 'small' },
  { ceiling: 100_000, label: 'medium' },
  { ceiling: 1_000_000, label: 'large' },
] as const;

export type RevenueBucket = 'micro' | 'small' | 'medium' | 'large' | 'enterprise' | 'unknown';

/**
 * Classify a borrower into a revenue size bucket based on annual revenue.
 *
 * @param revenueInThousands - Annual revenue in thousands (as stored in extracted metrics).
 *                             Null/undefined returns 'unknown'.
 */
export function classifyRevenueBucket(revenueInThousands: number | null | undefined): RevenueBucket {
  if (revenueInThousands == null || isNaN(revenueInThousands)) return 'unknown';

  // Negative revenue is unusual but possible (e.g., net revenue after large reversals).
  // Classify based on absolute magnitude to avoid mis-bucketing.
  const absRevenue = Math.abs(revenueInThousands);

  for (const { ceiling, label } of REVENUE_BUCKET_THRESHOLDS) {
    if (absRevenue < ceiling) return label;
  }
  return 'enterprise';
}

interface FairLendingParams {
  userId: string;
  projectId: string;
  extractionId: string | null;
  pipelineType: 'text' | 'vision';
  extractedData: ExtractionResult;
}

/**
 * Record a fair lending monitoring entry for disparity analysis.
 *
 * Captures the lending recommendation alongside borrower classification
 * metadata (revenue size bucket) and the key financial metrics that drove
 * the decision. Enables post-hoc ECOA/Reg B compliance reporting.
 *
 * Non-throwing: failures are logged but never fail the extraction request.
 * Uses admin client to bypass RLS — monitoring records must always be written.
 */
export async function logFairLendingRecord(params: FairLendingParams): Promise<void> {
  try {
    const { userId, projectId, extractionId, pipelineType, extractedData } = params;

    // Find latest fiscal year metrics for classification
    const years = Object.keys(extractedData.metrics_by_year || {}).sort();
    const latestYear = years[years.length - 1];
    const latestMetrics = latestYear
      ? extractedData.metrics_by_year?.[latestYear]
      : null;

    const revenue = latestMetrics?.revenue ?? null;
    const revenueBucket = classifyRevenueBucket(revenue);

    const record: FairLendingMonitorInsert = {
      extraction_id: extractionId,
      project_id: projectId,
      user_id: userId,
      lending_decision: extractedData.debtHealthAssessment?.lending_decision ?? null,
      quantitative_risk_score: extractedData.quantitativeRiskAssessment?.normalized_score ?? null,
      quantitative_risk_band: extractedData.quantitativeRiskAssessment?.risk_band ?? null,
      debt_health_score: extractedData.debtHealthAssessment?.weighted_score ?? null,
      debt_health_band: extractedData.debtHealthAssessment?.risk_band ?? null,
      revenue_bucket: revenueBucket,
      revenue_thousands: revenue,
      primary_fccr: latestMetrics?.fccr ?? null,
      primary_leverage: latestMetrics?.senior_debt_to_ebitda ?? null,
      primary_debt_capital: latestMetrics?.total_debt_to_capital ?? null,
      primary_current_ratio: latestMetrics?.current_ratio ?? null,
      pipeline_type: pipelineType,
    };

    const adminSupabase = createAdminClient();
    const { error } = await adminSupabase.from('fair_lending_monitor').insert(record);

    if (error) {
      logger.error('Failed to write fair lending monitor record', { error: error.message, projectId, extractionId });
    }
  } catch (err) {
    // Never fail the extraction request due to monitoring
    logger.error('Fair lending monitoring error', { error: err instanceof Error ? err.message : String(err), projectId: params.projectId });
  }
}

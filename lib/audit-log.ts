import 'server-only';
import { createAdminClient } from '@/utils/supabase/server';
import { AI_CONFIG } from '@/lib/constants';
import type { ExtractionResult } from '@/utils/aiProcessor';
import type { AuditTrailInsert, Json } from '@/lib/supabase/types';
import { logger } from '@/lib/logger';

interface AuditLogParams {
  userId: string;
  projectId: string;
  documentId: string;
  extractionId: string | null;
  pipelineType: 'text' | 'vision';
  documentHash: string | null;
  documentName: string;
  documentSize: number;
  processingTimeMs: number | null;
  extractedData: ExtractionResult;
}

/**
 * Record an immutable audit trail entry for a completed extraction analysis.
 *
 * Captures the model version, document hash, computed metrics snapshot,
 * risk assessments, and lending decision at the moment of analysis completion.
 * Required for OCC/FDIC regulatory exams and litigation support.
 *
 * Non-throwing: audit failures are logged but never fail the extraction request.
 * Uses admin client to bypass RLS — audit records must always be written.
 */
export async function logAuditEvent(params: AuditLogParams): Promise<void> {
  try {
    const {
      userId,
      projectId,
      documentId,
      extractionId,
      pipelineType,
      documentHash,
      documentName,
      documentSize,
      processingTimeMs,
      extractedData,
    } = params;

    const years = Object.keys(extractedData.metrics_by_year || {}).sort();
    const latestYear = years[years.length - 1];
    const latestMetrics = latestYear
      ? extractedData.metrics_by_year?.[latestYear] ?? {}
      : {};

    // Serialize complex objects to JSON-safe values for Supabase JSONB columns
    const toJson = (val: unknown): Json => JSON.parse(JSON.stringify(val ?? null));

    const record: AuditTrailInsert = {
      user_id: userId,
      project_id: projectId,
      document_id: documentId,
      extraction_id: extractionId,
      pipeline_type: pipelineType,
      model_version: AI_CONFIG.MODEL,
      document_hash: documentHash,
      document_name: documentName,
      document_size: documentSize,
      processing_time_ms: processingTimeMs,
      fiscal_years: years.length > 0 ? years : null,
      metrics_snapshot: toJson(latestMetrics),
      full_metrics_snapshot: extractedData.metrics_by_year ? toJson(extractedData.metrics_by_year) : null,
      extraction_warnings: extractedData.extraction_warnings ?? null,
      validation_issues: extractedData.validation_issues ? toJson(extractedData.validation_issues) : null,
      qualitative_risk_snapshot: extractedData.riskAssessment ? toJson(extractedData.riskAssessment) : null,
      debt_health_snapshot: extractedData.debtHealthAssessment ? toJson(extractedData.debtHealthAssessment) : null,
      quantitative_risk_snapshot: extractedData.quantitativeRiskAssessment ? toJson(extractedData.quantitativeRiskAssessment) : null,
      lending_decision: extractedData.debtHealthAssessment?.lending_decision ?? null,
      quantitative_risk_score: extractedData.quantitativeRiskAssessment?.normalized_score ?? null,
      quantitative_risk_band: extractedData.quantitativeRiskAssessment?.risk_band ?? null,
    };

    const adminSupabase = createAdminClient();
    const { error } = await adminSupabase.from('audit_trail').insert(record);

    if (error) {
      logger.error('Failed to write audit trail record', { error: error.message, documentId, extractionId });
    } else {
      logger.info('Audit trail recorded', { documentId, extractionId });
    }
  } catch (err) {
    // Never fail the extraction request due to audit logging
    logger.error('Audit trail logging error', { error: err instanceof Error ? err.message : String(err), documentId: params.documentId });
  }
}

import type { RiskData, DebtHealthAssessment } from '@/types/risk';
import type { ComputedMetrics } from '@/types/financial';

// ExtractionResult type - matches the structure from aiProcessor
export interface ExtractionResult {
  metrics_by_year: Record<string, ComputedMetrics>;
  /**
   * The fiscal year for which this document is the PRIMARY report.
   * For example, a 2024 annual report has primary_fiscal_year = "2024",
   * even though it may also contain 2023 comparative figures.
   * Used for conflict resolution: a document is always more authoritative
   * for the year it primarily reports on than for comparative years.
   */
  primary_fiscal_year?: string | null;
  riskAssessment?: RiskData | null;
  debtHealthAssessment?: DebtHealthAssessment | null;
  quantitativeRiskAssessment?: {
    normalized_score: number;
    risk_band: string;
    [key: string]: unknown;
  } | null;
  validation_issues?: Record<string, string[]>;
  extraction_warnings?: string[];
  chunk_stats?: { total: number; successful: number; failed: number; skipped?: number };
  token_usage?: {
    input_tokens: number;
    output_tokens: number;
    model: string;
    cost_usd?: number;
  };
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          company_name: string | null;
          status: 'draft' | 'in_progress' | 'completed' | 'archived';
          risk_score: number | null;
          risk_band: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          company_name?: string | null;
          status?: 'draft' | 'in_progress' | 'completed' | 'archived';
          risk_score?: number | null;
          risk_band?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          company_name?: string | null;
          status?: 'draft' | 'in_progress' | 'completed' | 'archived';
          risk_score?: number | null;
          risk_band?: string | null;
          updated_at?: string;
        };
      };
      documents: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          file_name: string;
          original_file_name: string;
          file_type: string;
          file_size: number;
          storage_path: string;
          processing_status: 'pending' | 'processing' | 'completed' | 'failed' | 'pending_conflict';
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          file_name: string;
          original_file_name: string;
          file_type: string;
          file_size: number;
          storage_path: string;
          processing_status?: 'pending' | 'processing' | 'completed' | 'failed' | 'pending_conflict';
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          file_name?: string;
          original_file_name?: string;
          file_type?: string;
          file_size?: number;
          storage_path?: string;
          processing_status?: 'pending' | 'processing' | 'completed' | 'failed' | 'pending_conflict';
          error_message?: string | null;
          updated_at?: string;
        };
      };
      extractions: {
        Row: {
          id: string;
          document_id: string;
          project_id: string;
          user_id: string;
          extraction_data: ExtractionResult;
          fiscal_years: string[];
          latest_fccr: number | null;
          latest_dscr: number | null;
          latest_senior_debt_to_ebitda: number | null;
          latest_debt_to_capital: number | null;
          latest_adjusted_ebitda: number | null;
          quantitative_risk_score: number | null;
          quantitative_risk_band: string | null;
          validation_issues: Record<string, string[]> | null;
          processing_time_ms: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          project_id: string;
          user_id: string;
          extraction_data: ExtractionResult;
          fiscal_years?: string[];
          latest_fccr?: number | null;
          latest_dscr?: number | null;
          latest_senior_debt_to_ebitda?: number | null;
          latest_debt_to_capital?: number | null;
          latest_adjusted_ebitda?: number | null;
          quantitative_risk_score?: number | null;
          quantitative_risk_band?: string | null;
          validation_issues?: Record<string, string[]> | null;
          processing_time_ms?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          project_id?: string;
          user_id?: string;
          extraction_data?: ExtractionResult;
          fiscal_years?: string[];
          latest_fccr?: number | null;
          latest_dscr?: number | null;
          latest_senior_debt_to_ebitda?: number | null;
          latest_debt_to_capital?: number | null;
          latest_adjusted_ebitda?: number | null;
          quantitative_risk_score?: number | null;
          quantitative_risk_band?: string | null;
          validation_issues?: Record<string, string[]> | null;
          processing_time_ms?: number | null;
          updated_at?: string;
        };
      };
    };
  };
}

// Helper types for use in components
export type Project = Database['public']['Tables']['projects']['Row'];
export type Document = Database['public']['Tables']['documents']['Row'];
export type Extraction = Database['public']['Tables']['extractions']['Row'];

export type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
export type DocumentInsert = Database['public']['Tables']['documents']['Insert'];
export type ExtractionInsert = Database['public']['Tables']['extractions']['Insert'];

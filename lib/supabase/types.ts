// Canonical ExtractionResult lives in utils/aiProcessor.ts — single source of truth.
// Imported for local use in Database interface, re-exported for downstream consumers.
import type { ExtractionResult } from '@/utils/aiProcessor';
export type { ExtractionResult };

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
          content_hash: string | null;
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
          content_hash?: string | null;
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
          content_hash?: string | null;
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
      audit_trail: {
        Row: {
          id: string;
          event_type: string;
          user_id: string;
          project_id: string;
          document_id: string;
          extraction_id: string | null;
          pipeline_type: 'text' | 'vision';
          model_version: string;
          document_hash: string | null;
          document_name: string;
          document_size: number;
          processing_time_ms: number | null;
          fiscal_years: string[] | null;
          metrics_snapshot: Json;
          full_metrics_snapshot: Json | null;
          extraction_warnings: string[] | null;
          validation_issues: Json | null;
          qualitative_risk_snapshot: Json | null;
          debt_health_snapshot: Json | null;
          quantitative_risk_snapshot: Json | null;
          lending_decision: string | null;
          quantitative_risk_score: number | null;
          quantitative_risk_band: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type?: string;
          user_id: string;
          project_id: string;
          document_id: string;
          extraction_id?: string | null;
          pipeline_type: 'text' | 'vision';
          model_version: string;
          document_hash?: string | null;
          document_name: string;
          document_size: number;
          processing_time_ms?: number | null;
          fiscal_years?: string[] | null;
          metrics_snapshot: Json;
          full_metrics_snapshot?: Json | null;
          extraction_warnings?: string[] | null;
          validation_issues?: Json | null;
          qualitative_risk_snapshot?: Json | null;
          debt_health_snapshot?: Json | null;
          quantitative_risk_snapshot?: Json | null;
          lending_decision?: string | null;
          quantitative_risk_score?: number | null;
          quantitative_risk_band?: string | null;
          created_at?: string;
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
export type AuditTrailInsert = Database['public']['Tables']['audit_trail']['Insert'];

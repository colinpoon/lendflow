// ExtractionResult type - matches the structure from aiProcessor
export interface ExtractionResult {
  metrics_by_year: Record<string, any>;
  riskAssessment?: any;
  debtHealthAssessment?: any;
  quantitativeRiskAssessment?: any;
  validation_issues?: Record<string, string[]>;
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
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          company_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          company_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          company_name?: string | null;
          updated_at?: string;
        };
      };
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
          processing_status: 'pending' | 'processing' | 'completed' | 'failed';
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
          processing_status?: 'pending' | 'processing' | 'completed' | 'failed';
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
          processing_status?: 'pending' | 'processing' | 'completed' | 'failed';
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
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Project = Database['public']['Tables']['projects']['Row'];
export type Document = Database['public']['Tables']['documents']['Row'];
export type Extraction = Database['public']['Tables']['extractions']['Row'];

export type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
export type DocumentInsert = Database['public']['Tables']['documents']['Insert'];
export type ExtractionInsert = Database['public']['Tables']['extractions']['Insert'];

/**
 * Risk assessment type definitions
 * Types for health ratings, risk scoring, and credit analysis
 */

// ─────────────────────────────────────────────────────────────────────────────
// Health Level Types
// ─────────────────────────────────────────────────────────────────────────────

export type HealthLevel = 'excellent' | 'good' | 'adequate' | 'weak' | 'poor';

export interface HealthConfig {
  level: HealthLevel;
  color: string;
  percentage: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk Level Types
// ─────────────────────────────────────────────────────────────────────────────

export type RiskLevel = 'very-low' | 'low' | 'moderate' | 'elevated' | 'high';

export interface RiskConfig {
  level: RiskLevel;
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pillar Assessment Types
// ─────────────────────────────────────────────────────────────────────────────

export type PillarKey =
  | 'debt_service_capacity'
  | 'leverage'
  | 'profitability'
  | 'cash_flow'
  | 'financial_trajectory';

export interface PillarScore {
  observations: string;
  impact: string;
  weight?: number;
  score?: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk Assessment Data
// ─────────────────────────────────────────────────────────────────────────────

export interface RiskData {
  header: string;
  pillars: Partial<Record<PillarKey, PillarScore>>;
  weighted_score: number | null;
  band: string;
  lending_recommendation: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Debt Health Assessment
// ─────────────────────────────────────────────────────────────────────────────

export interface DebtHealthAssessment {
  weighted_score: number;
  risk_band: string;
  lending_decision: string;
  key_risk_factors: string[];
  positive_factors: string[];
  recommendations: string[];
  suggested_loan_structure: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Props Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RiskAssessmentProps {
  data: RiskData | null;
}

export interface DebtHealthProps {
  debtHealthAssessment: DebtHealthAssessment | null;
}

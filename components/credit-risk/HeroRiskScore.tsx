'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, XCircle, AlertCircle } from 'lucide-react';
import type { QuantitativeRiskAssessment, DebtHealthAssessment, RiskBand, LendingDecision } from './types';
import { RISK_BAND_STYLES, LENDING_DECISION_STYLES, getLendingDecisionFromRiskBand } from './utils';

interface HeroRiskScoreProps {
  quantitativeRisk: QuantitativeRiskAssessment | null;
  debtHealth: DebtHealthAssessment | null;
  latestYear: string;
}

// Score gauge SVG component
const ScoreGauge: React.FC<{ score: number; maxScore?: number }> = ({
  score,
  maxScore = 100,
}) => {
  const percentage = Math.min(100, Math.max(0, (score / maxScore) * 100));
  const gradientId = 'hero-risk-gauge-gradient';

  return (
    <div className="relative w-48 h-24 overflow-hidden">
      <svg viewBox="0 0 200 100" className="w-full h-full">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="25%" stopColor="#84cc16" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="75%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>

        {/* Background arc */}
        <path
          d="M 20 90 A 80 80 0 0 1 180 90"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="16"
          strokeLinecap="round"
        />

        {/* Filled arc */}
        <path
          d="M 20 90 A 80 80 0 0 1 180 90"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${(percentage / 100) * 251.3} 251.3`}
        />

        {/* Needle */}
        <g transform={`rotate(${-90 + (percentage / 100) * 180}, 100, 90)`}>
          <line
            x1="100"
            y1="90"
            x2="100"
            y2="30"
            stroke="#374151"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="100" cy="90" r="6" fill="#374151" />
        </g>
      </svg>
    </div>
  );
};

// Lending decision icon
const LendingIcon: React.FC<{ decision: LendingDecision }> = ({ decision }) => {
  switch (decision) {
    case 'Approve':
      return <CheckCircle2 className="h-8 w-8 text-green-600" />;
    case 'Approve with Conditions':
      return <AlertCircle className="h-8 w-8 text-amber-600" />;
    case 'Review Required':
      return <AlertTriangle className="h-8 w-8 text-amber-600" />;
    case 'Decline':
      return <XCircle className="h-8 w-8 text-red-600" />;
  }
};

// Generate decision summary based on risk band
const getDecisionSummary = (riskBand: RiskBand): string => {
  switch (riskBand) {
    case 'Low Risk':
      return 'Strong financial profile with excellent debt coverage metrics. Favorable lending conditions.';
    case 'Moderate Risk':
      return 'Solid fundamentals with manageable debt levels. Standard underwriting applies.';
    case 'Elevated Risk':
      return 'Some concerns identified. Enhanced due diligence and tighter covenants may be required.';
    case 'High Risk':
      return 'Significant financial stress indicators. Requires senior credit committee review.';
    case 'Distressed':
      return 'Severe financial distress. Loan not recommended under current conditions.';
  }
};

const HeroRiskScore: React.FC<HeroRiskScoreProps> = ({
  quantitativeRisk,
  debtHealth,
  latestYear,
}) => {
  // Derive risk band and decision
  const riskBand: RiskBand = quantitativeRisk?.risk_band ??
    (debtHealth?.risk_band as RiskBand) ??
    'Moderate Risk';

  const normalizedScore = quantitativeRisk?.normalized_score ??
    debtHealth?.weighted_score ??
    50;

  // Normalize lending decision - the API may return variations like "Approve with conditions"
  const normalizeLendingDecision = (decision: string | undefined): LendingDecision => {
    if (!decision) return getLendingDecisionFromRiskBand(riskBand);
    const lower = decision.toLowerCase();
    if (lower === 'approve' || lower === 'approved') return 'Approve';
    if (lower.includes('condition')) return 'Approve with Conditions';
    if (lower.includes('review') || lower.includes('required')) return 'Review Required';
    if (lower.includes('decline') || lower.includes('reject')) return 'Decline';
    return getLendingDecisionFromRiskBand(riskBand);
  };

  const lendingDecision: LendingDecision = normalizeLendingDecision(debtHealth?.lending_decision);

  const positiveFactors = debtHealth?.positive_factors ?? [];
  const riskFactors = debtHealth?.key_risk_factors ?? [];
  const trendSummary = quantitativeRisk?.trend_summary ?? '';

  const bandStyle = RISK_BAND_STYLES[riskBand] ?? RISK_BAND_STYLES['Moderate Risk'];
  const decisionStyle = LENDING_DECISION_STYLES[lendingDecision] ?? LENDING_DECISION_STYLES['Review Required'];

  // Fallback if no data
  if (!quantitativeRisk && !debtHealth) {
    return (
      <Card className="shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <AlertCircle className="h-5 w-5" />
            <span>Risk assessment data not available</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Risk Score Card */}
      <Card className="shadow-lg">
        <CardContent className="p-6">
          <div className="flex flex-col items-center">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
              Risk Score
            </h3>

            {/* Gauge */}
            <ScoreGauge score={normalizedScore} />

            {/* Score value */}
            <div className="text-center -mt-2">
              <span className="text-4xl font-bold text-gray-800">{normalizedScore}</span>
              <span className="text-lg text-gray-500">/100</span>
            </div>

            {/* Risk band badge */}
            <Badge
              className={`mt-3 px-4 py-1 text-sm font-semibold ${bandStyle.bg} ${bandStyle.text} border ${bandStyle.border}`}
            >
              {riskBand}
            </Badge>

            {/* Trend summary */}
            {trendSummary && (
              <p className="mt-3 text-xs text-gray-500 text-center">{trendSummary}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lending Decision Card */}
      <Card className="shadow-lg">
        <CardContent className="p-6">
          <div className="flex flex-col h-full">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
              Lending Decision
            </h3>

            {/* Decision badge with icon */}
            <div className="flex items-center gap-3 mb-4">
              <LendingIcon decision={lendingDecision} />
              <Badge
                className={`px-4 py-1.5 text-sm font-bold ${decisionStyle.bg} ${decisionStyle.text}`}
              >
                {lendingDecision}
              </Badge>
            </div>

            {/* Summary */}
            <p className="text-sm text-gray-600 mb-4">
              {getDecisionSummary(riskBand)}
            </p>

            {/* Factor counts */}
            <div className="flex items-center gap-4 mt-auto">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs text-gray-600">
                  {positiveFactors.length} positive factor{positiveFactors.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-xs text-gray-600">
                  {riskFactors.length} risk factor{riskFactors.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Year indicator */}
            <div className="mt-4 pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">
                Based on FY {latestYear} financials
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HeroRiskScore;

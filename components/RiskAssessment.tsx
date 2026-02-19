'use client';

import React from 'react';
import { sanitizeObservationText } from '@/utils/format';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const PILLAR_KEYS = [
  'debt_service_capacity',
  'leverage',
  'profitability',
  'cash_flow',
  'financial_trajectory',
] as const;

const LABEL_MAP: Record<string, string> = {
  debt_service_capacity: 'Debt Service Capacity',
  leverage: 'Leverage & Capital Structure',
  profitability: 'Profitability',
  cash_flow: 'Cash Flow Adequacy',
  financial_trajectory: 'Financial Trajectory',
};

export interface PillarScore {
  observations: string;
  impact: string; // "Positive" | "Negative" | "Manageable" | …
  weight?: number; // optional weighting %
  score?: number | null; // 1‑10 or null
}

export interface RiskData {
  /** human readable header e.g. "Credit‑risk snapshot – Zedcor Inc. (fiscal year‑end 2023)" */
  header: string;
  pillars: Partial<
    Record<
      | 'debt_service_capacity'
      | 'leverage'
      | 'profitability'
      | 'cash_flow'
      | 'financial_trajectory',
      PillarScore
    >
  >;
  weighted_score: number | null; // 0‑10 overall
  band: string; // e.g. "Moderate‑Low"
  lending_recommendation: string; // free text summary
}

interface Props {
  data: RiskData | null;
}

const getScoreBadgeClass = (score: number): string => {
  if (score >= 8) return 'bg-green-100 text-green-800 border border-green-200';
  if (score >= 6) return 'bg-lime-100 text-lime-800 border border-lime-200';
  if (score >= 4) return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
  if (score >= 2) return 'bg-orange-100 text-orange-800 border border-orange-200';
  return 'bg-red-100 text-red-800 border border-red-200';
};

const getImpactBadgeClass = (impact: string): string => {
  const lower = impact.toLowerCase();
  if (lower.includes('positive')) return 'text-green-700 bg-green-50 border border-green-200';
  if (lower.includes('negative')) return 'text-red-700 bg-red-50 border border-red-200';
  if (lower.includes('manageable') || lower.includes('neutral')) return 'text-amber-700 bg-amber-50 border border-amber-200';
  return 'text-gray-600 bg-gray-50 border border-gray-200';
};

const ImpactIcon: React.FC<{ impact: string }> = ({ impact }) => {
  const lower = impact.toLowerCase();
  if (lower.includes('positive')) return <TrendingUp className="h-3.5 w-3.5" />;
  if (lower.includes('negative')) return <TrendingDown className="h-3.5 w-3.5" />;
  return <Minus className="h-3.5 w-3.5" />;
};

const RiskAssessment: React.FC<Props> = ({ data }) => {
  if (!data) return null;

  const activePillars = PILLAR_KEYS.filter((key) => data.pillars[key]);
  if (activePillars.length === 0) return null;

  return (
    <div className="space-y-3">
      {activePillars.map((key) => {
        // activePillars filtered for truthiness above, so this cast is safe
        const p = data.pillars[key]!;
        const label = LABEL_MAP[key] ?? key.replace(/_/g, ' ');

        const obs =
          typeof p.observations === 'string'
            ? sanitizeObservationText(p.observations) || '—'
            : '—';

        const impact = typeof p?.impact === 'string' ? p.impact : '—';

        const rawScore =
          typeof p?.score === 'number'
            ? p.score > 100
              ? p.score / 100
              : p.score > 10
              ? p.score / 10
              : p.score
            : null;

        return (
          <div
            key={key}
            className="flex flex-col sm:flex-row sm:items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100"
          >
            {/* Left: pillar name + badges */}
            <div className="flex flex-col gap-2 sm:w-48 shrink-0">
              <span className="text-sm font-semibold text-gray-800 leading-snug">
                {label}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {rawScore != null && (
                  <span
                    className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold tabular-nums font-mono ${getScoreBadgeClass(rawScore)}`}
                  >
                    {rawScore.toFixed(1)}
                  </span>
                )}
                {impact !== '—' && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getImpactBadgeClass(impact)}`}
                  >
                    <ImpactIcon impact={impact} />
                    {impact}
                  </span>
                )}
              </div>
            </div>

            {/* Right: observation text */}
            <p className="text-sm text-gray-600 leading-relaxed flex-1">
              {obs}
            </p>
          </div>
        );
      })}
    </div>
  );
};

export default RiskAssessment;

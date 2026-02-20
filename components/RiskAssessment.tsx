'use client';

import React from 'react';
import { fmtCurrency, sanitizeObservationText } from '@/utils/format';

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

/**
 * Maps a risk band string to Tailwind color classes.
 * Bands follow the convention: Low, Moderate-Low, Moderate, Moderate-High, High.
 */
function getRiskBandColors(band: string): {
  container: string;
  badge: string;
  text: string;
} {
  const normalized = band.toLowerCase();

  if (normalized.includes('low') && !normalized.includes('moderate')) {
    return {
      container: 'bg-green-50 border-green-200',
      badge: 'bg-green-100 text-green-800',
      text: 'text-green-700',
    };
  }

  if (normalized === 'moderate-low' || normalized === 'moderate low') {
    return {
      container: 'bg-lime-50 border-lime-200',
      badge: 'bg-lime-100 text-lime-800',
      text: 'text-lime-700',
    };
  }

  if (normalized === 'moderate') {
    return {
      container: 'bg-yellow-50 border-yellow-200',
      badge: 'bg-yellow-100 text-yellow-800',
      text: 'text-yellow-700',
    };
  }

  if (normalized === 'moderate-high' || normalized === 'moderate high') {
    return {
      container: 'bg-orange-50 border-orange-200',
      badge: 'bg-orange-100 text-orange-800',
      text: 'text-orange-700',
    };
  }

  // High risk — default for unrecognized bands as well (conservative)
  return {
    container: 'bg-red-50 border-red-200',
    badge: 'bg-red-100 text-red-800',
    text: 'text-red-700',
  };
}

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

const RiskAssessment: React.FC<Props> = ({ data }) => {
  if (!data) return null;

  const bandColors = getRiskBandColors(data.band ?? '');

  return (
    <section className="mt-6 space-y-6">
      <h2 className="text-lg font-semibold">{data.header}</h2>

      {/* Pillar breakdown table */}
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-200">
            <th className="border p-1 text-left">Pillar</th>
            <th className="border p-1 text-left">Observations</th>
            <th className="border p-1 text-center">Impact</th>
            <th className="border p-1 text-center">Score (1–10)</th>
          </tr>
        </thead>
        <tbody>
          {PILLAR_KEYS.map((key) => {
            const p = data.pillars[key] as PillarScore | undefined;
            const obs =
              typeof p?.observations === 'string'
                ? sanitizeObservationText(p.observations)
                : typeof p?.observations === 'number'
                ? fmtCurrency(p.observations)
                : '—';
            const impact = typeof p?.impact === 'string' ? p.impact : '—';
            const score =
              typeof p?.score === 'number'
                ? p.score > 100
                  ? (p.score / 100).toFixed(1)
                  : p.score > 10
                  ? (p.score / 10).toFixed(1)
                  : p.score.toFixed(1)
                : '—';
            const label = LABEL_MAP[key] ?? key.replace(/_/g, ' ');
            return (
              <tr key={key}>
                <td className="border p-1 capitalize">{label}</td>
                <td className="border p-1">{obs}</td>
                <td className="border p-1 text-center">{impact}</td>
                <td className="border p-1 text-center">{score}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Overall verdict — weighted score, risk band, and lending recommendation */}
      <div className={`rounded-lg border-2 p-5 space-y-4 ${bandColors.container}`}>
        {/* Score and band row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">
              Overall Risk Band
            </p>
            <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${bandColors.badge}`}>
              {data.band ?? 'N/A'}
            </span>
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">
              Weighted Score
            </p>
            <p className={`text-2xl font-bold ${bandColors.text}`}>
              {data.weighted_score != null
                ? `${data.weighted_score.toFixed(1)} / 10`
                : 'N/A'}
            </p>
          </div>
        </div>

        {/* Lending recommendation */}
        {data.lending_recommendation && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">
              Lending Recommendation
            </p>
            <p className="text-sm leading-relaxed text-gray-800">
              {data.lending_recommendation}
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default RiskAssessment;

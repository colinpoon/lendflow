'use client';

import React from 'react';
import { fmtCurrency } from '@/utils/format';

const PILLAR_KEYS = [
  'profitability_cashflow',
  'leverage',
  'liquidity',
  'debt_service',
  'interest_rate_sensitivity',
  'concentration_sector',
  'governance',
] as const;

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
      | 'profitability_cashflow'
      | 'leverage'
      | 'liquidity'
      | 'debt_service'
      | 'interest_rate_sensitivity'
      | 'concentration_sector'
      | 'governance',
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

  return (
    <section className="mt-6 space-y-2">
      <h2 className="text-lg font-semibold">{data.header}</h2>

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
              typeof p?.observations === 'number'
                ? fmtCurrency(p.observations)
                : p?.observations ?? '—';
            const impact =
              typeof p?.impact === 'string' ? p.impact : '—';
            const score =
              typeof p?.score === 'number'
                ? p.score > 100
                  ? (p.score / 100).toFixed(1)
                  : p.score > 10
                  ? (p.score / 10).toFixed(1)
                  : p.score.toFixed(1)
                : '—';
            // Format header label
            const label = key
              .replace(/_/g, ' ')
              .replace('cashflow', 'cash flow')
              .replace(
                'concentration sector',
                'concentration & sector'
              );
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

      {(() => {
        const normalizedScore =
          typeof data.weighted_score === 'number'
            ? data.weighted_score > 100
              ? (data.weighted_score / 100).toFixed(1)
              : data.weighted_score > 10
              ? (data.weighted_score / 10).toFixed(1)
              : data.weighted_score.toFixed(1)
            : null;
        return (
          <p className="mt-2">
            <strong>Weighted score:</strong>{' '}
            {normalizedScore != null ? normalizedScore : '—'} / 10 →{' '}
            <strong>{data.band}</strong> risk band.
          </p>
        );
      })()}

      <h3 className="font-semibold mt-3">Lending recommendation</h3>
      <p className="whitespace-pre-line">
        {data.lending_recommendation}
      </p>
    </section>
  );
};

export default RiskAssessment;

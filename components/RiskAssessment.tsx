'use client';

import React from 'react';

export interface PillarScore {
  observations: string;
  impact: string; // "Positive" | "Negative" | "Manageable" | …
  weight?: number; // optional weighting %
  score?: number | null; // 1‑10 or null
}

export interface RiskData {
  /** human readable header e.g. "Credit‑risk snapshot – Zedcor Inc. (fiscal year‑end 2023)" */
  header: string;
  pillars: Record<
    | 'profitability_cashflow'
    | 'leverage'
    | 'liquidity'
    | 'debt_service'
    | 'interest_rate_sensitivity'
    | 'concentration_sector'
    | 'governance',
    PillarScore
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
            <th className="border p-1 text-center">Score /10</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(data.pillars).map(([key, raw]) => {
            const p = raw as any;
            const obs =
              p.observations ??
              p.observation ??
              JSON.stringify(p, null, 0);
            const impact = p.impact ?? '—';
            const score =
              p.score !== undefined && p.score !== null
                ? p.score
                : '—';

            return (
              <tr key={key}>
                <td className="border p-1 capitalize">
                  {key
                    .replace(/_/g, ' ')
                    .replace('cashflow', 'cash flow')
                    .replace(
                      'concentration sector',
                      'concentration & sector'
                    )}
                </td>
                <td className="border p-1">{obs}</td>
                <td className="border p-1 text-center">{impact}</td>
                <td className="border p-1 text-center">{score}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="mt-2">
        <strong>Weighted score:</strong> {data.weighted_score ?? '—'}{' '}
        / 10 → <strong>{data.band}</strong> risk band.
      </p>

      <h3 className="font-semibold mt-3">Lending recommendation</h3>
      <p className="whitespace-pre-line">
        {data.lending_recommendation}
      </p>
    </section>
  );
};

export default RiskAssessment;

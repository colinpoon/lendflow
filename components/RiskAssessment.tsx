'use client';

import React from 'react';
import { fmtCurrency, sanitizeObservationText } from '@/utils/format';

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
  impact: string;
  weight?: number;
  score?: number | null;
}

export interface RiskData {
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
  weighted_score: number | null;
  band: string;
  lending_recommendation: string;
}

interface Props {
  data: RiskData | null;
}

const getImpactColor = (impact: string): string => {
  const lower = impact.toLowerCase();
  if (lower.includes('positive')) return 'text-success bg-success/10';
  if (lower.includes('negative')) return 'text-danger bg-danger/10';
  if (lower.includes('manageable') || lower.includes('neutral')) return 'text-warning bg-warning/10';
  return 'text-muted-foreground bg-muted';
};

const getScoreColor = (score: number | null): string => {
  if (score === null) return 'text-muted-foreground';
  if (score >= 8) return 'text-success';
  if (score >= 6) return 'text-chart-2';
  if (score >= 4) return 'text-warning';
  if (score >= 2) return 'text-chart-4';
  return 'text-danger';
};

const RiskAssessment: React.FC<Props> = ({ data }) => {
  if (!data) return null;

  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">{data.header}</p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-3 px-3 text-left text-xs font-medium text-muted-foreground">
                Pillar
              </th>
              <th className="py-3 px-3 text-left text-xs font-medium text-muted-foreground">
                Observations
              </th>
              <th className="py-3 px-3 text-center text-xs font-medium text-muted-foreground">
                Impact
              </th>
              <th className="py-3 px-3 text-center text-xs font-medium text-muted-foreground">
                Score
              </th>
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
              const impact =
                typeof p?.impact === 'string' ? p.impact : '—';
              const rawScore =
                typeof p?.score === 'number'
                  ? p.score > 100
                    ? p.score / 100
                    : p.score > 10
                    ? p.score / 10
                    : p.score
                  : null;
              const scoreDisplay = rawScore !== null ? rawScore.toFixed(1) : '—';

              const label = key
                .replace(/_/g, ' ')
                .replace('cashflow', 'Cash Flow')
                .replace('concentration sector', 'Concentration & Sector');

              return (
                <tr
                  key={key}
                  className="border-b border-border/50 transition-colors hover:bg-muted/30"
                >
                  <td className="py-3 px-3 font-medium capitalize">
                    {label}
                  </td>
                  <td className="py-3 px-3 text-muted-foreground max-w-md text-sm">
                    {obs}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getImpactColor(impact)}`}>
                      {impact}
                    </span>
                  </td>
                  <td className={`py-3 px-3 text-center font-medium tabular-nums ${getScoreColor(rawScore)}`}>
                    {scoreDisplay}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default RiskAssessment;

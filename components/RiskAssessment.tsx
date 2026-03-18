'use client';

import React from 'react';
import { fmtCurrency, sanitizeObservationText } from '@/utils/format';
import type { PillarScore, RiskData } from '@/types/risk';

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
      container: 'bg-success/8 border-success/25',
      badge: 'bg-success/15 text-success',
      text: 'text-success',
    };
  }

  if (normalized === 'moderate-low' || normalized === 'moderate low') {
    return {
      container: 'bg-success/5 border-success/20',
      badge: 'bg-success/10 text-success',
      text: 'text-success',
    };
  }

  if (normalized === 'moderate') {
    return {
      container: 'bg-warning/8 border-warning/25',
      badge: 'bg-warning/15 text-warning',
      text: 'text-warning',
    };
  }

  if (normalized === 'moderate-high' || normalized === 'moderate high') {
    return {
      container: 'bg-error/6 border-error/20',
      badge: 'bg-error/12 text-error',
      text: 'text-error',
    };
  }

  // High risk — default for unrecognized bands as well (conservative)
  return {
    container: 'bg-error/8 border-error/25',
    badge: 'bg-error/15 text-error',
    text: 'text-error',
  };
}

/** Maps a numeric score (1–10) to Tailwind badge styling. */
function getScoreBadgeClass(score: number): string {
  if (score <= 3) return 'bg-success/15 text-success border border-success/25';
  if (score <= 5) return 'bg-warning/10 text-warning border border-warning/25';
  if (score <= 7) return 'bg-error/10 text-error border border-error/25';
  return 'bg-error/20 text-error border border-error/35';
}

/** Maps an impact string to a color class for the pill. */
function getImpactClass(impact: string): string {
  const lower = impact.toLowerCase();
  if (lower === 'positive') return 'bg-success/12 text-success';
  if (lower === 'negative') return 'bg-error/12 text-error';
  return 'bg-muted text-muted-foreground';
}

interface Props {
  data: RiskData | null;
}

const RiskAssessment: React.FC<Props> = ({ data }) => {
  if (!data) return null;

  const bandColors = getRiskBandColors(data.band ?? '');

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold text-foreground">{data.header}</h2>

      {/* Pillar breakdown — card-per-row for readability and mobile-friendliness */}
      <div className="space-y-3">
        {PILLAR_KEYS.map((key) => {
          const p = data.pillars[key] as PillarScore | undefined;
          const obs =
            typeof p?.observations === 'string'
              ? sanitizeObservationText(p.observations)
              : typeof p?.observations === 'number'
              ? fmtCurrency(p.observations)
              : '—';
          const impact = typeof p?.impact === 'string' ? p.impact : '—';
          const rawScore = typeof p?.score === 'number' ? p.score : null;
          const normalizedScore =
            rawScore !== null
              ? rawScore > 100
                ? rawScore / 100
                : rawScore > 10
                ? rawScore / 10
                : rawScore
              : null;
          const label = LABEL_MAP[key] ?? key.replace(/_/g, ' ');

          return (
            <div
              key={key}
              className="rounded-lg border border-border bg-card p-4 space-y-2"
            >
              {/* Header row: pillar name + score badge + impact pill */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="text-sm font-semibold text-foreground capitalize">
                  {label}
                </h3>
                <div className="flex items-center gap-2 shrink-0">
                  {impact !== '—' && (
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${getImpactClass(impact)}`}
                    >
                      {impact}
                    </span>
                  )}
                  {normalizedScore !== null && (
                    <span
                      className={`text-xs font-bold tabular-nums px-2.5 py-0.5 rounded-full ${getScoreBadgeClass(normalizedScore)}`}
                    >
                      {normalizedScore.toFixed(1)} / 10
                    </span>
                  )}
                </div>
              </div>

              {/* Score progress bar */}
              {normalizedScore !== null && (
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[9px] text-muted-foreground/50 uppercase tracking-wide">
                    <span>Better</span>
                    <span>Worse</span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(normalizedScore / 10) * 100}%`,
                        backgroundColor:
                          normalizedScore <= 3
                            ? 'var(--success)'
                            : normalizedScore <= 5
                            ? 'var(--warning)'
                            : 'var(--error)',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Observations */}
              {obs !== '—' && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {obs}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Overall verdict — weighted score, risk band, and lending recommendation */}
      <div className={`rounded-lg border p-5 space-y-4 ${bandColors.container}`}>
        {/* Score and band row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
              Overall Risk Band
            </p>
            <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${bandColors.badge}`}>
              {data.band ?? 'N/A'}
            </span>
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
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
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
              Lending Recommendation
            </p>
            <p className="text-sm leading-normal text-foreground">
              {data.lending_recommendation}
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default RiskAssessment;

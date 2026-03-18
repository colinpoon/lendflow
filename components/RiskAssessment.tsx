'use client';

import React from 'react';
import { fmtCurrency, sanitizeObservationText } from '@/utils/format';
import type { PillarScore, RiskData } from '@/types/risk';
import { PILLAR_KEYS, PILLAR_WEIGHTS } from '@/lib/constants';

const LABEL_MAP: Record<string, string> = {
  debt_service_capacity: 'Debt Service Capacity',
  leverage: 'Leverage & Capital Structure',
  profitability: 'Profitability',
  cash_flow: 'Cash Flow Adequacy',
  financial_trajectory: 'Financial Trajectory',
};

/**
 * Maps a risk band string to a complete set of Tailwind color classes.
 * Returns both the left-border accent color and card/badge styling.
 */
function getRiskBandColors(band: string): {
  container: string;
  badge: string;
  text: string;
  borderAccent: string;
} {
  const normalized = band.toLowerCase();

  if (normalized.includes('low') && !normalized.includes('moderate')) {
    return {
      container: 'bg-success/8 border-success/25',
      badge: 'bg-success/15 text-success',
      text: 'text-success',
      borderAccent: 'bg-success',
    };
  }

  if (normalized === 'moderate-low' || normalized === 'moderate low') {
    return {
      container: 'bg-success/5 border-success/20',
      badge: 'bg-success/10 text-success',
      text: 'text-success',
      borderAccent: 'bg-success/70',
    };
  }

  if (normalized === 'moderate') {
    return {
      container: 'bg-warning/8 border-warning/25',
      badge: 'bg-warning/15 text-warning',
      text: 'text-warning',
      borderAccent: 'bg-warning',
    };
  }

  if (normalized === 'moderate-high' || normalized === 'moderate high') {
    return {
      container: 'bg-error/6 border-error/20',
      badge: 'bg-error/12 text-error',
      text: 'text-error',
      borderAccent: 'bg-error/70',
    };
  }

  // High risk — default fallback (conservative)
  return {
    container: 'bg-error/8 border-error/25',
    badge: 'bg-error/15 text-error',
    text: 'text-error',
    borderAccent: 'bg-error',
  };
}

/** Maps a normalized score (1–10) to a full set of Tailwind styling classes. */
function getScoreColors(score: number): {
  badge: string;
  bar: string;
  borderAccent: string;
  number: string;
} {
  if (score <= 3) {
    return {
      badge: 'bg-success/15 text-success border border-success/25',
      bar: 'bg-success',
      borderAccent: 'bg-success',
      number: 'text-success',
    };
  }
  if (score <= 5) {
    return {
      badge: 'bg-warning/10 text-warning border border-warning/25',
      bar: 'bg-warning',
      borderAccent: 'bg-warning',
      number: 'text-warning',
    };
  }
  if (score <= 7) {
    return {
      badge: 'bg-error/10 text-error border border-error/25',
      bar: 'bg-error/80',
      borderAccent: 'bg-error/80',
      number: 'text-error',
    };
  }
  return {
    badge: 'bg-error/20 text-error border border-error/35',
    bar: 'bg-error',
    borderAccent: 'bg-error',
    number: 'text-error',
  };
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

      {/* Pillar breakdown — one card per pillar */}
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
          const weight = PILLAR_WEIGHTS[key];
          const scoreColors = normalizedScore !== null ? getScoreColors(normalizedScore) : null;

          return (
            <div
              key={key}
              className="relative rounded-lg border border-border bg-card overflow-hidden"
            >
              {/* Left border accent — color communicates risk level at a glance */}
              {scoreColors && (
                <div
                  className={`absolute left-0 inset-y-0 w-1 ${scoreColors.borderAccent}`}
                  aria-hidden="true"
                />
              )}

              <div className="pl-5 pr-4 py-4 space-y-3">
                {/* Header row: pillar name + weight + impact pill */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-semibold text-foreground capitalize leading-snug">
                      {label}
                    </h3>
                    {weight != null && (
                      <p className="text-[11px] text-muted-foreground/70 font-medium">
                        Weight: {weight}%
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 mt-0.5">
                    {impact !== '—' && (
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${getImpactClass(impact)}`}
                      >
                        {impact}
                      </span>
                    )}
                  </div>
                </div>

                {/* Score display — prominent number with progress bar */}
                {normalizedScore !== null && scoreColors && (
                  <div className="flex items-center gap-4">
                    {/* Large score number — the primary visual anchor */}
                    <div className="shrink-0 text-right w-16">
                      <span
                        className={`text-3xl font-bold tabular-nums leading-none ${scoreColors.number}`}
                      >
                        {normalizedScore.toFixed(1)}
                      </span>
                      <span className="block text-[10px] text-muted-foreground/60 mt-0.5">
                        / 10
                      </span>
                    </div>

                    {/* Progress bar with scale labels */}
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between text-[9px] text-muted-foreground/50 uppercase tracking-wide">
                        <span>Better</span>
                        <span>Worse</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${scoreColors.bar}`}
                          style={{ width: `${(normalizedScore / 10) * 100}%` }}
                        />
                      </div>
                      {/* Score badge below bar */}
                      <div className="flex justify-end">
                        <span
                          className={`text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full ${scoreColors.badge}`}
                        >
                          {normalizedScore <= 3
                            ? 'Low Risk'
                            : normalizedScore <= 5
                            ? 'Moderate'
                            : normalizedScore <= 7
                            ? 'Elevated'
                            : 'High Risk'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Observations */}
                {obs !== '—' && (
                  <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-2.5">
                    {obs}
                  </p>
                )}
              </div>
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
              Weighted Score
            </p>
            <div className="flex items-baseline gap-1.5">
              <p className={`text-4xl font-bold tabular-nums tracking-tighter ${bandColors.text}`}>
                {data.weighted_score != null ? data.weighted_score.toFixed(1) : 'N/A'}
              </p>
              {data.weighted_score != null && (
                <span className="text-sm text-muted-foreground">/ 10</span>
              )}
            </div>
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
              Overall Risk Band
            </p>
            <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${bandColors.badge}`}>
              {data.band ?? 'N/A'}
            </span>
          </div>
        </div>

        {/* Lending recommendation */}
        {data.lending_recommendation && (
          <div className="border-t border-border/30 pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
              Lending Recommendation
            </p>
            <p className="text-sm leading-relaxed text-foreground">
              {data.lending_recommendation}
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default RiskAssessment;

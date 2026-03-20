'use client';

import React from 'react';
import { fmtCurrency, sanitizeObservationText } from '@/utils/format';
import type { PillarScore, RiskData } from '@/types/risk';
import { PILLAR_KEYS } from '@/lib/constants';

const LABEL_MAP: Record<string, string> = {
  debt_service_capacity: 'Debt Service Capacity',
  leverage: 'Leverage & Capital Structure',
  profitability: 'Profitability',
  cash_flow: 'Cash Flow Adequacy',
  financial_trajectory: 'Financial Trajectory',
};

/** Maps an impact string to a border accent color. */
function getImpactBorderColor(impact: string): string {
  const lower = impact.toLowerCase();
  if (lower === 'positive') return 'bg-success';
  if (lower === 'negative') return 'bg-error';
  return 'bg-muted-foreground/30';
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
          const label = LABEL_MAP[key] ?? key.replace(/_/g, ' ');

          return (
            <div
              key={key}
              className="relative rounded-lg border border-border bg-card overflow-hidden"
            >
              {/* Left border accent — color communicates impact at a glance */}
              <div
                className={`absolute left-0 inset-y-0 w-1 ${getImpactBorderColor(impact)}`}
                aria-hidden="true"
              />

              <div className="pl-5 pr-4 py-4 space-y-3">
                {/* Header row: pillar name + impact pill */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <h3 className="text-sm font-semibold text-foreground capitalize leading-snug">
                    {label}
                  </h3>
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

                {/* Observations — narrative analysis */}
                {obs !== '—' && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {obs}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall AI advisory summary */}
      <div className="rounded-lg border border-border bg-muted/30 p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
              AI Assessment
            </p>
            <span className="inline-block rounded-full px-3 py-1 text-xs font-medium text-muted-foreground bg-muted">
              {data.band ?? 'N/A'}
            </span>
          </div>
          <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60 border border-border/50 rounded px-2 py-0.5">
            Advisory Only
          </span>
        </div>

        {/* Advisory narrative */}
        {data.lending_recommendation && (
          <div className="border-t border-border/30 pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
              Narrative
            </p>
            <p className="text-sm leading-relaxed text-foreground">
              {data.lending_recommendation}
            </p>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
          AI-generated qualitative analysis. Not scored for lending decisions — see Lending Risk Score for the authoritative assessment.
        </p>
      </div>
    </section>
  );
};

export default RiskAssessment;

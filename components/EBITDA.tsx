'use client';

import React from 'react';
import { fmtCurrency } from '@/utils/format';

/** Metrics for a single fiscal year */
interface YearMetrics {
  /** EBITDA may arrive as number, numeric string, or null */
  ebitda: number | string | null;
}

interface EBITDAProps {
  /** Backend response shape: { metrics_by_year: { "2024": {...}, "2023": {...} } } */
  data: { metrics_by_year: Record<string, YearMetrics> } | null;
}

const EBITDA: React.FC<EBITDAProps> = ({ data }) => {
  if (
    !data ||
    !data.metrics_by_year ||
    Object.keys(data.metrics_by_year).length === 0
  ) {
    return <p className="text-muted-foreground">EBITDA data unavailable.</p>;
  }

  const years = Object.keys(data.metrics_by_year).sort().reverse(); // newest first

  return (
    <div className="p-4 border border-border rounded-lg shadow-md w-full max-w-lg mx-auto mt-4 bg-card">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-semibold text-foreground">
          EBITDA Calculation
        </h2>
        <span className="text-xs text-muted-foreground">(Values in thousands)</span>
      </div>
      {years.map((y) => (
        <p key={y} className="text-foreground">
          <span className="font-semibold">{y}:</span>{' '}
          <strong>
            {fmtCurrency(
              typeof data.metrics_by_year[y]?.ebitda === 'string'
                ? parseFloat(data.metrics_by_year[y]?.ebitda)
                : data.metrics_by_year[y]?.ebitda
            )}
          </strong>
        </p>
      ))}
    </div>
  );
};

export default EBITDA;

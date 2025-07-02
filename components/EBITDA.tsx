'use client';

import React from 'react';

/** Metrics for a single fiscal year */
interface YearMetrics {
  /** EBITDA may arrive as number, numeric string, or null */
  ebitda: number | string | null;
}

interface EBITDAProps {
  /** Backend response shape: { metrics_by_year: { "2024": {...}, "2023": {...} } } */
  data: { metrics_by_year: Record<string, YearMetrics> } | null;
}

/** Normalise any numeric string or number to a JS number */
const toNumber = (
  val: number | string | null | undefined
): number | null => {
  if (val == null) return null;
  if (typeof val === 'number') return val;
  // strip $ commas and spaces
  const num = parseFloat(val.replace(/[$,\s]/g, ''));
  return isNaN(num) ? null : num;
};

/** Format currency or show “N/A” when null/invalid */
const fmtCurrency = (v: number | string | null | undefined) => {
  const num = toNumber(v);
  return num == null
    ? 'N/A'
    : num.toLocaleString(undefined, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      });
};

const EBITDA: React.FC<EBITDAProps> = ({ data }) => {
  if (
    !data ||
    !data.metrics_by_year ||
    Object.keys(data.metrics_by_year).length === 0
  ) {
    return <p className="text-gray-500">EBITDA data unavailable.</p>;
  }

  const years = Object.keys(data.metrics_by_year).sort().reverse(); // newest first

  return (
    <div className="p-4 border rounded-lg shadow-md w-full max-w-lg mx-auto mt-4">
      <h2 className="text-lg font-semibold mb-2">
        EBITDA Calculation
      </h2>
      {years.map((y) => (
        <p key={y} className="text-gray-700">
          <span className="font-semibold">{y}:</span>{' '}
          <strong>
            {fmtCurrency(data.metrics_by_year[y]?.ebitda)}
          </strong>
        </p>
      ))}
    </div>
  );
};

export default EBITDA;

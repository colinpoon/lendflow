'use client';

import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  Info,
  Calendar,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { QuantitativeRiskAssessment, MetricScore } from '@/lib/quantitative-risk';

export type { QuantitativeRiskAssessment, MetricScore };

interface QuantitativeRiskCardProps {
  data: QuantitativeRiskAssessment | null;
}

// Score colors (1-5 scale, lower is better)
export const getQuantScoreStyle = (score: number): string => {
  if (score <= 1.5) return 'bg-green-500 text-white';
  if (score <= 2.5) return 'bg-lime-500 text-white';
  if (score <= 3.5) return 'bg-yellow-500 text-white';
  if (score <= 4.5) return 'bg-orange-500 text-white';
  return 'bg-red-500 text-white';
};

// Trend icon and color
export const TrendIndicator: React.FC<{ metric: MetricScore }> = ({ metric }) => {
  if (metric.trend_direction == null) {
    return <Minus className="h-4 w-4 text-gray-400" />;
  }
  if (metric.trend_direction === 'improving') {
    return <TrendingUp className="h-4 w-4 text-green-500" />;
  }
  if (metric.trend_direction === 'worsening') {
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  }
  return <Minus className="h-4 w-4 text-gray-400" />;
};

// Format metric value for display
export const formatQuantValue = (metric: MetricScore): string => {
  if (metric.current_value == null) return 'N/A';
  if (metric.name === 'EBITDA Trend') {
    const val = metric.current_value;
    return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
  }
  if (metric.name === 'Debt / Capital') {
    return `${(metric.current_value * 100).toFixed(1)}%`;
  }
  return `${metric.current_value.toFixed(2)}x`;
};

// Format avg annual change
export const formatQuantChange = (change: number | null): string => {
  if (change == null) return '—';
  return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
};

// Metrics table — exported so WeightedRiskGauge can embed it
export const QuantitativeMetricsTable: React.FC<{
  data: QuantitativeRiskAssessment;
}> = ({ data }) => (
  <TooltipProvider>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th className="text-left py-3 px-2 font-semibold text-gray-700">Metric</th>
            <th className="text-center py-3 px-2 font-semibold text-gray-700">Weight</th>
            <th className="text-center py-3 px-2 font-semibold text-gray-700">Value</th>
            <th className="text-center py-3 px-2 font-semibold text-gray-700">Score</th>
            <th className="text-center py-3 px-2 font-semibold text-gray-700">Avg Change</th>
            <th className="text-center py-3 px-2 font-semibold text-gray-700">Trend</th>
          </tr>
        </thead>
        <tbody>
          {data.metrics.map((metric, idx) => (
            <tr
              key={metric.name}
              className={`border-b ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
            >
              <td className="py-3 px-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-800">{metric.name}</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <p className="text-xs">{metric.rationale}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </td>
              <td className="py-3 px-2 text-center">
                <span className="text-gray-600 tabular-nums font-mono">
                  {(metric.weight * 100).toFixed(0)}%
                </span>
              </td>
              <td className="py-3 px-2 text-center">
                <span className="tabular-nums font-mono text-gray-800">
                  {formatQuantValue(metric)}
                </span>
              </td>
              <td className="py-3 px-2 text-center">
                <span
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${getQuantScoreStyle(metric.adjusted_score)}`}
                >
                  {metric.adjusted_score.toFixed(0)}
                </span>
              </td>
              <td className="py-3 px-2 text-center">
                <span
                  className={`tabular-nums font-mono ${
                    metric.avg_annual_change_pct == null
                      ? 'text-gray-400'
                      : metric.trend_direction === 'improving'
                      ? 'text-green-600'
                      : metric.trend_direction === 'worsening'
                      ? 'text-red-600'
                      : 'text-gray-600'
                  }`}
                >
                  {formatQuantChange(metric.avg_annual_change_pct)}
                </span>
              </td>
              <td className="py-3 px-2 text-center">
                <div className="flex items-center justify-center gap-1">
                  <TrendIndicator metric={metric} />
                  <span
                    className={`text-xs capitalize ${
                      metric.trend_direction === 'improving'
                        ? 'text-green-600'
                        : metric.trend_direction === 'worsening'
                        ? 'text-red-600'
                        : 'text-gray-500'
                    }`}
                  >
                    {metric.trend_direction ?? '—'}
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </TooltipProvider>
);

const QuantitativeRiskCard: React.FC<QuantitativeRiskCardProps> = ({ data }) => {
  if (!data) {
    return (
      <div className="flex flex-col items-center gap-2 text-gray-500 p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <AlertCircle className="h-5 w-5" />
        <span className="font-medium">Quantitative Risk Scorecard</span>
        <span className="text-sm">Data not available</span>
      </div>
    );
  }

  const hasYoY = data.metrics.some(
    (m) => Object.keys(m.values_by_year).length > 1,
  );

  return (
    <div className="space-y-6">
      {/* Trend Summary */}
      <p className="text-sm text-gray-600">{data.trend_summary}</p>

      {/* Metrics Table */}
      <QuantitativeMetricsTable data={data} />

      {/* Scoring Legend */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Scoring Guide</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
          {[
            { score: 1, label: 'Strong', cls: 'bg-green-500' },
            { score: 2, label: 'Good', cls: 'bg-lime-500' },
            { score: 3, label: 'Adequate', cls: 'bg-yellow-500' },
            { score: 4, label: 'Weak', cls: 'bg-orange-500' },
            { score: 5, label: 'Poor', cls: 'bg-red-500' },
          ].map(({ score, label, cls }) => (
            <div key={score} className="flex items-center gap-2">
              <span
                className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-white font-bold ${cls}`}
              >
                {score}
              </span>
              <span className="text-gray-600">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Year-over-Year Detail */}
      {hasYoY && (
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="yoy" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-500" />
                <span className="font-semibold text-gray-800">
                  Year-over-Year Values
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="overflow-x-auto mt-2">
                {(() => {
                  // Derive the union of all years across all metrics so every
                  // row uses the same canonical column set — prevents misaligned
                  // columns when individual metrics span different year ranges.
                  const allYears = [
                    ...new Set(
                      data.metrics.flatMap((m) => Object.keys(m.values_by_year))
                    ),
                  ].sort();

                  return (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2">Metric</th>
                          {allYears.map((year) => (
                            <th key={year} className="text-center py-2 px-2">
                              {year}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.metrics.map((metric) => (
                          <tr key={metric.name} className="border-b">
                            <td className="py-2 px-2 font-medium">{metric.name}</td>
                            {allYears.map((year) => {
                              const val = metric.values_by_year[year];
                              let display = '—';
                              if (val != null) {
                                if (metric.name === 'Debt / Capital') {
                                  display = `${(val * 100).toFixed(1)}%`;
                                } else if (metric.name === 'EBITDA Trend') {
                                  display = val.toLocaleString();
                                } else {
                                  display = `${val.toFixed(2)}x`;
                                }
                              }
                              return (
                                <td
                                  key={year}
                                  className="text-center py-2 px-2 tabular-nums font-mono"
                                >
                                  {display}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
};

export default QuantitativeRiskCard;

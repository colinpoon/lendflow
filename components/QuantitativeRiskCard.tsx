'use client';

import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  Info,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { QuantitativeRiskAssessment, MetricScore } from '@/lib/quantitative-risk';

interface QuantitativeRiskCardProps {
  data: QuantitativeRiskAssessment | null;
}

// Risk band colors
const RISK_BAND_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  'Low Risk': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  'Moderate Risk': { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  'Elevated Risk': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  'High Risk': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  'Distressed': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
};

// Score colors (1-5 scale, lower is better)
const getScoreStyle = (score: number): string => {
  if (score <= 1.5) return 'bg-green-500 text-white';
  if (score <= 2.5) return 'bg-lime-500 text-white';
  if (score <= 3.5) return 'bg-yellow-500 text-white';
  if (score <= 4.5) return 'bg-orange-500 text-white';
  return 'bg-red-500 text-white';
};

// Trend icon and color
const TrendIndicator: React.FC<{ metric: MetricScore }> = ({ metric }) => {
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
const formatValue = (metric: MetricScore): string => {
  if (metric.current_value == null) return 'N/A';

  // EBITDA Trend shows percentage
  if (metric.name === 'EBITDA Trend') {
    const val = metric.current_value;
    return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
  }

  // Debt/Capital shows as percentage
  if (metric.name === 'Debt / Capital') {
    return `${(metric.current_value * 100).toFixed(1)}%`;
  }

  // Others show as ratio
  return `${metric.current_value.toFixed(2)}x`;
};

// Format avg annual change
const formatChange = (change: number | null): string => {
  if (change == null) return '—';
  return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
};

// Score gauge component
const ScoreGauge: React.FC<{ score: number; maxScore?: number }> = ({
  score,
  maxScore = 100,
}) => {
  const percentage = (score / maxScore) * 100;
  const riskBand =
    score <= 20 ? 'Low Risk' :
    score <= 40 ? 'Moderate Risk' :
    score <= 60 ? 'Elevated Risk' :
    score <= 80 ? 'High Risk' : 'Distressed';

  const bandStyle = RISK_BAND_STYLES[riskBand];

  // Gradient stops for the gauge
  const gradientId = 'risk-gauge-gradient';

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-24 overflow-hidden">
        <svg viewBox="0 0 200 100" className="w-full h-full">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="25%" stopColor="#84cc16" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="75%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>

          {/* Background arc */}
          <path
            d="M 20 90 A 80 80 0 0 1 180 90"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="16"
            strokeLinecap="round"
          />

          {/* Filled arc */}
          <path
            d="M 20 90 A 80 80 0 0 1 180 90"
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={`${(percentage / 100) * 251.3} 251.3`}
          />

          {/* Needle */}
          <g transform={`rotate(${-90 + (percentage / 100) * 180}, 100, 90)`}>
            <line
              x1="100"
              y1="90"
              x2="100"
              y2="30"
              stroke="#374151"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="100" cy="90" r="6" fill="#374151" />
          </g>
        </svg>
      </div>

      <div className="text-center -mt-2">
        <span className="text-4xl font-bold text-gray-800">{score}</span>
        <span className="text-lg text-gray-500">/100</span>
      </div>

      <span
        className={`mt-2 px-4 py-1 rounded-full text-sm font-semibold ${bandStyle.bg} ${bandStyle.text}`}
      >
        {riskBand}
      </span>
    </div>
  );
};

const QuantitativeRiskCard: React.FC<QuantitativeRiskCardProps> = ({ data }) => {
  console.log('🎯 QuantitativeRiskCard received data:', data);

  if (!data) {
    console.log('🎯 QuantitativeRiskCard: data is null/undefined, showing fallback');
    return (
      <div className="flex flex-col items-center gap-2 text-gray-500 p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <AlertCircle className="h-5 w-5" />
        <span className="font-medium">Quantitative Risk Scorecard</span>
        <span className="text-sm">Data not available - check browser console for debug logs</span>
      </div>
    );
  }

  console.log('🎯 QuantitativeRiskCard: rendering with score', data.normalized_score);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h3 className="text-xl font-bold text-gray-800">
            Quantitative Risk Scorecard
          </h3>
          <p className="text-sm text-gray-500">
            5-Metric Weighted Assessment with Trend Analysis
          </p>
        </div>

        {/* Score Gauge */}
        <div className="flex justify-center">
          <ScoreGauge score={data.normalized_score} />
        </div>

        {/* Trend Summary */}
        <div className="text-center">
          <span className="text-sm text-gray-600">{data.trend_summary}</span>
        </div>

        {/* Metrics Table */}
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
                    <span className="text-gray-600">{(metric.weight * 100).toFixed(0)}%</span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className="font-mono text-gray-800">{formatValue(metric)}</span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span
                      className={`inline-block w-8 h-8 leading-8 rounded-full text-sm font-bold ${getScoreStyle(
                        metric.adjusted_score
                      )}`}
                    >
                      {metric.adjusted_score.toFixed(0)}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span
                      className={`font-mono ${
                        metric.avg_annual_change_pct == null
                          ? 'text-gray-400'
                          : metric.trend_direction === 'improving'
                          ? 'text-green-600'
                          : metric.trend_direction === 'worsening'
                          ? 'text-red-600'
                          : 'text-gray-600'
                      }`}
                    >
                      {formatChange(metric.avg_annual_change_pct)}
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

        {/* Scoring Legend */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Scoring Guide</h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center font-bold">1</span>
              <span className="text-gray-600">Strong</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-lime-500 text-white flex items-center justify-center font-bold">2</span>
              <span className="text-gray-600">Good</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-yellow-500 text-white flex items-center justify-center font-bold">3</span>
              <span className="text-gray-600">Adequate</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold">4</span>
              <span className="text-gray-600">Weak</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center font-bold">5</span>
              <span className="text-gray-600">Poor</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-200">
            <h5 className="text-xs font-semibold text-gray-600 mb-2">Risk Bands (0-100)</h5>
            <div className="flex flex-wrap gap-2">
              {Object.entries(RISK_BAND_STYLES).map(([band, style]) => (
                <span
                  key={band}
                  className={`text-xs px-2 py-1 rounded ${style.bg} ${style.text}`}
                >
                  {band}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Year-over-Year Detail (expandable) */}
        {data.metrics.some(m => Object.keys(m.values_by_year).length > 1) && (
          <details className="bg-gray-50 rounded-lg p-4">
            <summary className="cursor-pointer text-sm font-semibold text-gray-700 hover:text-gray-900">
              View Year-over-Year Values
            </summary>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Metric</th>
                    {Object.keys(data.metrics[0]?.values_by_year || {})
                      .sort()
                      .map(year => (
                        <th key={year} className="text-center py-2 px-2">{year}</th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {data.metrics.map((metric) => (
                    <tr key={metric.name} className="border-b">
                      <td className="py-2 px-2 font-medium">{metric.name}</td>
                      {Object.keys(metric.values_by_year)
                        .sort()
                        .map(year => {
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
                            <td key={year} className="text-center py-2 px-2 font-mono">
                              {display}
                            </td>
                          );
                        })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>
    </TooltipProvider>
  );
};

export default QuantitativeRiskCard;

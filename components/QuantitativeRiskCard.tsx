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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { QuantitativeRiskAssessment, MetricScore } from '@/lib/quantitative-risk';

interface QuantitativeRiskCardProps {
  data: QuantitativeRiskAssessment | null;
}

// Risk band styles using semantic tokens
const RISK_BAND_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  'Low Risk':       { bg: 'bg-success/10',   text: 'text-success',          border: 'border-success/25' },
  'Moderate Risk':  { bg: 'bg-warning/10',   text: 'text-warning',          border: 'border-warning/25' },
  'Elevated Risk':  { bg: 'bg-error/10',     text: 'text-error',            border: 'border-error/25' },
  'High Risk':      { bg: 'bg-error/15',     text: 'text-error',            border: 'border-error/30' },
  'Distressed':     { bg: 'bg-error/20',     text: 'text-error',            border: 'border-error/40' },
};

// Score badge colors — 5-level scale, lower is better.
// 1 = Strong (success), 2 = Good (success/70), 3 = Adequate (warning), 4 = Weak (error/80), 5 = Poor (error)
const getScoreStyle = (score: number): string => {
  if (score <= 1.5) return 'bg-success text-white';
  if (score <= 2.5) return 'bg-success/70 text-white';
  if (score <= 3.5) return 'bg-warning text-white';
  if (score <= 4.5) return 'bg-error/80 text-white';
  return 'bg-error text-white';
};

// Trend icon and color
const TrendIndicator: React.FC<{ metric: MetricScore }> = ({ metric }) => {
  if (metric.trend_direction == null) {
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  }

  if (metric.trend_direction === 'improving') {
    return <TrendingUp className="h-4 w-4 text-success" />;
  }
  if (metric.trend_direction === 'worsening') {
    return <TrendingDown className="h-4 w-4 text-error" />;
  }
  return <Minus className="h-4 w-4 text-muted-foreground" />;
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

  // Gradient stops for the gauge (SVG hex values retained intentionally)
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
            stroke="var(--border)"
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
              stroke="var(--foreground)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="100" cy="90" r="6" fill="var(--foreground)" />
          </g>
        </svg>
      </div>

      <div className="text-center -mt-2" aria-label={`Risk score: ${score} out of 100`}>
        <span className="text-4xl font-bold text-foreground">{score}</span>
        <span className="text-lg text-muted-foreground">/100</span>
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
  if (!data) {
    return (
      <div className="flex flex-col items-center gap-2 text-muted-foreground p-4 bg-muted rounded-lg border-2 border-dashed border-border">
        <AlertCircle className="h-5 w-5" />
        <span className="font-medium">Quantitative Risk Scorecard</span>
        <span className="text-sm">Data not available</span>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h3 className="text-xl font-bold text-foreground">
            Quantitative Risk Scorecard
          </h3>
          <p className="text-sm text-muted-foreground">
            5-Metric Weighted Assessment with Trend Analysis
          </p>
        </div>

        {/* Score Gauge */}
        <div className="flex justify-center">
          <ScoreGauge score={data.normalized_score} />
        </div>

        {/* Trend Summary */}
        <div className="text-center">
          <span className="text-sm text-muted-foreground">{data.trend_summary}</span>
        </div>

        {/* Metrics Table */}
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table className="table-financial min-w-[560px]">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-[11px] uppercase tracking-[0.10em] font-semibold text-muted-foreground">Metric</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-[0.10em] font-semibold text-muted-foreground">Weight</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-[0.10em] font-semibold text-muted-foreground">Value</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-[0.10em] font-semibold text-muted-foreground">Score</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-[0.10em] font-semibold text-muted-foreground">Avg Change</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-[0.10em] font-semibold text-muted-foreground">Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.metrics.map((metric) => (
                <TableRow key={metric.name}>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{metric.name}</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          <p className="text-xs">{metric.rationale}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                  <TableCell className="text-center py-3">
                    <span className="text-muted-foreground tabular-nums">{(metric.weight * 100).toFixed(0)}%</span>
                  </TableCell>
                  <TableCell className="text-center py-3">
                    <span className="font-mono text-foreground tabular-nums">{formatValue(metric)}</span>
                  </TableCell>
                  <TableCell className="text-center py-3">
                    <span
                      className={`inline-flex items-center justify-center min-w-[2rem] h-8 px-2 rounded-full text-sm font-bold ${getScoreStyle(
                        metric.adjusted_score
                      )}`}
                    >
                      {metric.adjusted_score.toFixed(0)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center py-3">
                    <span
                      className={`font-mono tabular-nums ${
                        metric.avg_annual_change_pct == null
                          ? 'text-muted-foreground'
                          : metric.trend_direction === 'improving'
                          ? 'text-success'
                          : metric.trend_direction === 'worsening'
                          ? 'text-error'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {formatChange(metric.avg_annual_change_pct)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center py-3">
                    <div className="flex items-center justify-center gap-1">
                      <TrendIndicator metric={metric} />
                      <span
                        className={`text-xs capitalize ${
                          metric.trend_direction === 'improving'
                            ? 'text-success'
                            : metric.trend_direction === 'worsening'
                            ? 'text-error'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {metric.trend_direction ?? '—'}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Scoring Legend */}
        <div className="bg-muted rounded-lg p-4">
          <h4 className="text-sm font-semibold text-foreground mb-3">Scoring Guide</h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-success text-white flex items-center justify-center font-bold">1</span>
              <span className="text-muted-foreground">Strong</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-success/70 text-white flex items-center justify-center font-bold">2</span>
              <span className="text-muted-foreground">Good</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-warning text-white flex items-center justify-center font-bold">3</span>
              <span className="text-muted-foreground">Adequate</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-error/80 text-white flex items-center justify-center font-bold">4</span>
              <span className="text-muted-foreground">Weak</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-error text-white flex items-center justify-center font-bold">5</span>
              <span className="text-muted-foreground">Poor</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border">
            <h5 className="text-xs font-semibold text-muted-foreground mb-2">Risk Bands (0-100)</h5>
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
          <Accordion type="single" collapsible className="bg-muted rounded-lg">
            <AccordionItem value="yoy" className="border-0 px-4">
              <AccordionTrigger className="text-sm font-semibold text-foreground hover:no-underline py-4">
                View Year-over-Year Values
              </AccordionTrigger>
              <AccordionContent>
                <div className="overflow-x-auto pb-2 rounded-lg border border-border">
                  <Table className="table-financial min-w-[400px] text-xs">
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="text-[11px] uppercase tracking-[0.10em] font-semibold text-muted-foreground">Metric</TableHead>
                        {Object.keys(data.metrics[0]?.values_by_year || {})
                          .sort()
                          .map(year => (
                            <TableHead key={year} className="text-center text-[11px] uppercase tracking-[0.10em] font-semibold text-muted-foreground">{year}</TableHead>
                          ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.metrics.map((metric) => (
                        <TableRow key={metric.name}>
                          <TableCell className="py-2 font-medium text-foreground">{metric.name}</TableCell>
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
                                <TableCell key={year} className="text-center py-2 font-mono tabular-nums text-muted-foreground">
                                  {display}
                                </TableCell>
                              );
                            })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </div>
    </TooltipProvider>
  );
};

export default QuantitativeRiskCard;

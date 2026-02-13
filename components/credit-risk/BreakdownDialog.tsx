'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { YearMetrics, FCCRBreakdownData, HealthConfig } from './types';
import { formatCurrency, formatRatio, formatPercent, getHealthLabel } from './utils';

type BreakdownType = 'fccr' | 'debtEbitda' | 'debtCapital' | 'currentRatio';

interface BreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: BreakdownType;
  metrics: YearMetrics;
  health: HealthConfig;
  year: string;
}

// FCCR Breakdown Content
const FCCRBreakdownContent: React.FC<{
  breakdown: FCCRBreakdownData;
  fccr: number | null;
  health: HealthConfig;
}> = ({ breakdown, fccr, health }) => (
  <div className="space-y-4">
    {/* Formula */}
    <div className="bg-gray-50 rounded-lg p-3">
      <code className="text-xs text-gray-600">
        FCCR = (Adj. EBITDA - CapEx - Taxes - Distributions) / Debt Service
      </code>
    </div>

    {/* Numerator */}
    <div className="border rounded-lg p-4">
      <h4 className="text-sm font-semibold text-green-700 mb-3">
        Numerator (Cash Available)
      </h4>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Adjusted EBITDA</span>
          <span className="font-medium">{formatCurrency(breakdown.adjusted_ebitda)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">- Unfunded CapEx</span>
          <span className="font-medium text-red-600">
            - {formatCurrency(breakdown.capex_deduction)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">- Cash Taxes Paid</span>
          <span className="font-medium text-red-600">
            - {formatCurrency(breakdown.cash_taxes_paid)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">- Distributions Paid</span>
          <span className="font-medium text-red-600">
            - {formatCurrency(breakdown.distributions_paid)}
          </span>
        </div>
        <div className="flex justify-between pt-2 border-t font-semibold">
          <span>= Cash for Debt Service</span>
          <span className="text-green-700">{formatCurrency(breakdown.numerator)}</span>
        </div>
      </div>
    </div>

    {/* Denominator */}
    <div className="border rounded-lg p-4">
      <h4 className="text-sm font-semibold text-blue-700 mb-3">
        Denominator (Total Debt Service)
      </h4>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Principal Payments</span>
          <span className="font-medium">{formatCurrency(breakdown.ttm_principal_payments)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">+ Interest Expense</span>
          <span className="font-medium">+ {formatCurrency(breakdown.ttm_interest_expense)}</span>
        </div>
        {breakdown.lease_payments > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-600">+ Lease Payments</span>
            <span className="font-medium">+ {formatCurrency(breakdown.lease_payments)}</span>
          </div>
        )}
        <div className="flex justify-between pt-2 border-t font-semibold">
          <span>= Total Debt Service</span>
          <span className="text-blue-700">{formatCurrency(breakdown.denominator)}</span>
        </div>
      </div>
    </div>

    {/* Result */}
    <div className="bg-gray-100 rounded-lg p-4 text-center">
      <div className="text-sm text-gray-600 mb-2">
        {formatCurrency(breakdown.numerator)} / {formatCurrency(breakdown.denominator)} =
      </div>
      <div className="flex items-center justify-center gap-2">
        <span className="text-3xl font-bold text-gray-800">{formatRatio(fccr)}</span>
        <Badge className={`${health.bgClass} text-white`}>
          {getHealthLabel(health.level)}
        </Badge>
      </div>
    </div>
  </div>
);

// Senior Debt / EBITDA Breakdown Content
const DebtEbitdaBreakdownContent: React.FC<{
  metrics: YearMetrics;
  health: HealthConfig;
}> = ({ metrics, health }) => (
  <div className="space-y-4">
    {/* Formula */}
    <div className="bg-gray-50 rounded-lg p-3">
      <code className="text-xs text-gray-600">
        Senior Debt / EBITDA = Senior Debt / Adjusted EBITDA
      </code>
    </div>

    {/* Components */}
    <div className="border rounded-lg p-4">
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Senior Debt</span>
          <span className="font-medium">{formatCurrency(metrics.senior_debt)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Adjusted EBITDA</span>
          <span className="font-medium">{formatCurrency(metrics.adjusted_ebitda ?? metrics.ebitda)}</span>
        </div>
      </div>
    </div>

    {/* Result */}
    <div className="bg-gray-100 rounded-lg p-4 text-center">
      <div className="text-sm text-gray-600 mb-2">
        {formatCurrency(metrics.senior_debt)} / {formatCurrency(metrics.adjusted_ebitda ?? metrics.ebitda)} =
      </div>
      <div className="flex items-center justify-center gap-2">
        <span className="text-3xl font-bold text-gray-800">
          {formatRatio(metrics.senior_debt_to_ebitda)}
        </span>
        <Badge className={`${health.bgClass} text-white`}>
          {getHealthLabel(health.level)}
        </Badge>
      </div>
    </div>

    {/* Interpretation */}
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
      <strong>Interpretation:</strong> This ratio shows how many years of EBITDA would be needed
      to pay off senior debt. Lower is better. Target is typically &lt;2.5x for investment grade.
    </div>
  </div>
);

// Debt / Capital Breakdown Content
const DebtCapitalBreakdownContent: React.FC<{
  metrics: YearMetrics;
  health: HealthConfig;
}> = ({ metrics, health }) => {
  const totalCapital = (metrics.total_debt ?? 0) + (metrics.shareholders_equity ?? 0);

  return (
    <div className="space-y-4">
      {/* Formula */}
      <div className="bg-gray-50 rounded-lg p-3">
        <code className="text-xs text-gray-600">
          Debt/Capital = Total Debt / (Total Debt + Shareholders&apos; Equity)
        </code>
      </div>

      {/* Components */}
      <div className="border rounded-lg p-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Total Debt</span>
            <span className="font-medium">{formatCurrency(metrics.total_debt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Shareholders&apos; Equity</span>
            <span className="font-medium">{formatCurrency(metrics.shareholders_equity)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t">
            <span className="text-gray-600">Total Capital</span>
            <span className="font-medium">{formatCurrency(totalCapital)}</span>
          </div>
        </div>
      </div>

      {/* Result */}
      <div className="bg-gray-100 rounded-lg p-4 text-center">
        <div className="text-sm text-gray-600 mb-2">
          {formatCurrency(metrics.total_debt)} / {formatCurrency(totalCapital)} =
        </div>
        <div className="flex items-center justify-center gap-2">
          <span className="text-3xl font-bold text-gray-800">
            {formatPercent(metrics.total_debt_to_capital)}
          </span>
          <Badge className={`${health.bgClass} text-white`}>
            {getHealthLabel(health.level)}
          </Badge>
        </div>
      </div>

      {/* Interpretation */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
        <strong>Interpretation:</strong> Shows proportion of debt financing vs total capital.
        Lower indicates stronger equity position and less financial risk. Target is typically &lt;50%.
      </div>
    </div>
  );
};

// Current Ratio Breakdown Content
const CurrentRatioBreakdownContent: React.FC<{
  metrics: YearMetrics;
  health: HealthConfig;
}> = ({ metrics, health }) => (
  <div className="space-y-4">
    {/* Formula */}
    <div className="bg-gray-50 rounded-lg p-3">
      <code className="text-xs text-gray-600">
        Current Ratio = Current Assets / Current Liabilities
      </code>
    </div>

    {/* Result */}
    <div className="bg-gray-100 rounded-lg p-4 text-center">
      <div className="flex items-center justify-center gap-2">
        <span className="text-3xl font-bold text-gray-800">
          {formatRatio(metrics.current_ratio ?? null)}
        </span>
        <Badge className={`${health.bgClass} text-white`}>
          {getHealthLabel(health.level)}
        </Badge>
      </div>
    </div>

    {/* Interpretation */}
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
      <strong>Interpretation:</strong> Measures short-term liquidity. A ratio &gt;1 means the company
      can cover current liabilities with current assets. Target is typically &gt;1.5x.
    </div>
  </div>
);

// Titles and descriptions for each breakdown type
const BREAKDOWN_CONFIG: Record<BreakdownType, { title: string; description: string }> = {
  fccr: {
    title: 'Fixed Charge Coverage Ratio (FCCR)',
    description: 'Measures the ability to cover fixed charges with operating cash flow',
  },
  debtEbitda: {
    title: 'Senior Debt / EBITDA',
    description: 'Measures leverage relative to earnings',
  },
  debtCapital: {
    title: 'Total Debt / Total Capital',
    description: 'Measures the proportion of debt financing',
  },
  currentRatio: {
    title: 'Current Ratio',
    description: 'Measures short-term liquidity',
  },
};

const BreakdownDialog: React.FC<BreakdownDialogProps> = ({
  open,
  onOpenChange,
  type,
  metrics,
  health,
  year,
}) => {
  const config = BREAKDOWN_CONFIG[type];

  const renderContent = () => {
    switch (type) {
      case 'fccr':
        return metrics.fccr_breakdown ? (
          <FCCRBreakdownContent
            breakdown={metrics.fccr_breakdown}
            fccr={metrics.fccr}
            health={health}
          />
        ) : (
          <p className="text-gray-500 text-center py-8">
            FCCR breakdown data not available
          </p>
        );
      case 'debtEbitda':
        return <DebtEbitdaBreakdownContent metrics={metrics} health={health} />;
      case 'debtCapital':
        return <DebtCapitalBreakdownContent metrics={metrics} health={health} />;
      case 'currentRatio':
        return <CurrentRatioBreakdownContent metrics={metrics} health={health} />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>
            {config.description} - FY {year}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">{renderContent()}</div>
      </DialogContent>
    </Dialog>
  );
};

export default BreakdownDialog;

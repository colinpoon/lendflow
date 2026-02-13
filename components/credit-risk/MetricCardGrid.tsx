'use client';

import React, { useState } from 'react';
import MetricCard from './MetricCard';
import type {
  YearMetrics,
  FinancialData,
  MetricScore,
} from './types';
import {
  getFCCRHealth,
  getSeniorDebtEBITDAHealth,
  getDebtCapitalHealth,
  getCurrentRatioHealth,
  formatRatio,
  formatPercent,
  formatCurrency,
  calculateSparklineData,
  getHealthLabel,
} from './utils';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Plus, Trash2 } from 'lucide-react';

type MetricId =
  | 'fccr'
  | 'debtEbitda'
  | 'debtCapital'
  | 'currentRatio';

interface MetricCardGridProps {
  financialData: FinancialData;
  latestMetrics: YearMetrics;
  quantitativeMetrics?: MetricScore[];
  latestYear?: string;
}

type CapexTreatment = 'unfunded' | 'all' | 'none' | 'custom';

interface CustomAdjustment {
  id: string;
  label: string;
  amount: number;
  type: 'add' | 'subtract';
}

const MetricCardGrid: React.FC<MetricCardGridProps> = ({
  financialData,
  latestMetrics,
  quantitativeMetrics,
  latestYear,
}) => {
  const [expandedCard, setExpandedCard] = useState<MetricId | null>(
    null,
  );
  const years = Object.keys(financialData.metrics_by_year).sort();

  // FCCR Custom Adjustments State
  const defaultCapexTreatment =
    latestMetrics.fccr_breakdown?.capex_treatment ?? 'unfunded';
  const defaultCustomPct =
    latestMetrics.fccr_breakdown?.capex_custom_percentage ?? 50;
  const [capexTreatment, setCapexTreatment] =
    useState<CapexTreatment>(defaultCapexTreatment);
  const [customCapexPct, setCustomCapexPct] =
    useState<number>(defaultCustomPct);

  // Custom line item adjustments for FCCR numerator
  const [customAdjustments, setCustomAdjustments] = useState<
    CustomAdjustment[]
  >([]);

  const addCustomAdjustment = () => {
    setCustomAdjustments((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        label: '',
        amount: 0,
        type: 'add',
      },
    ]);
  };

  const removeCustomAdjustment = (id: string) => {
    setCustomAdjustments((prev) =>
      prev.filter((adj) => adj.id !== id),
    );
  };

  const updateCustomAdjustment = (
    id: string,
    field: keyof CustomAdjustment,
    value: string | number,
  ) => {
    setCustomAdjustments((prev) =>
      prev.map((adj) =>
        adj.id === id ? { ...adj, [field]: value } : adj,
      ),
    );
  };

  const getTotalCustomAdjustments = () => {
    return customAdjustments.reduce((sum, adj) => {
      return sum + (adj.type === 'add' ? adj.amount : -adj.amount);
    }, 0);
  };

  // Get trend info from quantitative metrics if available
  const getTrendInfo = (metricName: string) => {
    if (!quantitativeMetrics) return undefined;
    const metric = quantitativeMetrics.find((m) =>
      m.name.toLowerCase().includes(metricName.toLowerCase()),
    );
    if (!metric) return undefined;
    return {
      direction: metric.trend_direction,
      change: metric.avg_annual_change_pct,
    };
  };

  // Build sparkline data for each metric
  const fccrValues = years.map(
    (y) => financialData.metrics_by_year[y].fccr,
  );
  const debtEbitdaValues = years.map(
    (y) => financialData.metrics_by_year[y].senior_debt_to_ebitda,
  );
  const debtCapitalValues = years.map(
    (y) => financialData.metrics_by_year[y].total_debt_to_capital,
  );
  const currentRatioValues = years.map(
    (y) => financialData.metrics_by_year[y].current_ratio ?? null,
  );

  // Get health configs for each metric
  const fccrHealth = getFCCRHealth(latestMetrics.fccr ?? 0);
  const debtEbitdaHealth = getSeniorDebtEBITDAHealth(
    latestMetrics.senior_debt_to_ebitda ?? 999,
  );
  const debtCapitalHealth = getDebtCapitalHealth(
    latestMetrics.total_debt_to_capital ?? 1,
  );
  const currentRatioHealth = getCurrentRatioHealth(
    latestMetrics.current_ratio ?? 0,
  );

  // FCCR Breakdown Content
  const FCCRBreakdownContent = () => {
    const breakdown = latestMetrics.fccr_breakdown;
    if (!breakdown) {
      return (
        <p className="text-gray-500 text-center py-8">
          FCCR breakdown data not available
        </p>
      );
    }

    // Calculate CapEx deduction based on selected treatment
    const calculateCapexDeduction = (
      treatment: CapexTreatment,
      pct: number,
    ): number => {
      const totalCapex = breakdown.capital_expenditures ?? 0;
      const proceeds = breakdown.proceeds_from_lt_debt ?? 0;

      switch (treatment) {
        case 'unfunded':
          return Math.max(0, totalCapex - proceeds);
        case 'all':
          return totalCapex;
        case 'none':
          return 0;
        case 'custom':
          return totalCapex * (pct / 100);
        default:
          return breakdown.capex_deduction;
      }
    };

    // Calculate adjusted values based on selected treatment and custom adjustments
    const adjustedCapexDeduction = calculateCapexDeduction(
      capexTreatment,
      customCapexPct,
    );
    const customAdjustmentTotal = getTotalCustomAdjustments();
    const adjustedNumerator =
      breakdown.adjusted_ebitda -
      adjustedCapexDeduction -
      breakdown.cash_taxes_paid -
      breakdown.distributions_paid +
      customAdjustmentTotal;
    const adjustedFCCR =
      breakdown.denominator > 0
        ? adjustedNumerator / breakdown.denominator
        : null;
    const adjustedHealth = getFCCRHealth(adjustedFCCR ?? 0);

    // Check if values differ from original
    const isCapexAdjusted =
      capexTreatment !== defaultCapexTreatment ||
      (capexTreatment === 'custom' &&
        customCapexPct !== defaultCustomPct);
    const hasCustomAdjustments =
      customAdjustments.length > 0 && customAdjustmentTotal !== 0;
    const isAdjusted = isCapexAdjusted || hasCustomAdjustments;

    // Calculate YOY data
    const yoyData = years.map((year) => {
      const yearMetrics = financialData.metrics_by_year[year];
      return {
        year,
        fccr: yearMetrics.fccr,
        numerator: yearMetrics.fccr_breakdown?.numerator ?? null,
        denominator: yearMetrics.fccr_breakdown?.denominator ?? null,
      };
    });

    // Source data for transparency
    const sources = breakdown.sources;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Calculation Breakdown */}
        <div className="space-y-4">
          {/* Formula */}
          <div className="rounded-lg p-3 border border-black">
            <code className="text-xs text-gray-600">
              FCCR = (Adj. EBITDA - CapEx - Taxes - Distributions +
              Adjustments) / Debt Service
            </code>
          </div>

          {/* Numerator */}
          <div className="border rounded-lg p-4">
            <h4 className="text-sm font-semibold text-green-700 mb-3">
              Numerator (Cash Available)
              {isAdjusted && (
                <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                  Adjusted
                </span>
              )}
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Adjusted EBITDA</span>
                <span className="font-medium">
                  {formatCurrency(breakdown.adjusted_ebitda)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">
                  - CapEx Deduction
                </span>
                <span
                  className={`font-medium text-red-600 ${isCapexAdjusted ? 'bg-amber-100 px-1 rounded' : ''}`}
                >
                  - {formatCurrency(adjustedCapexDeduction)}
                  {isCapexAdjusted &&
                    breakdown.capex_deduction !==
                      adjustedCapexDeduction && (
                      <span className="text-xs text-gray-400 ml-1">
                        (was{' '}
                        {formatCurrency(breakdown.capex_deduction)})
                      </span>
                    )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">
                  - Cash Taxes Paid
                </span>
                <span className="font-medium text-red-600">
                  - {formatCurrency(breakdown.cash_taxes_paid)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">
                  - Distributions Paid
                </span>
                <span className="font-medium text-red-600">
                  - {formatCurrency(breakdown.distributions_paid)}
                </span>
              </div>
              {/* Custom Adjustments Line Items */}
              {customAdjustments
                .filter((adj) => adj.amount !== 0)
                .map((adj) => (
                  <div
                    key={adj.id}
                    className="flex justify-between px-1 rounded border border-black"
                  >
                    <span className={adj.type === 'add' ? 'text-green-700' : 'text-red-700'}>
                      {adj.type === 'add' ? '+' : '-'}{' '}
                      {adj.label || 'Custom Adjustment'}
                    </span>
                    <span
                      className={`font-medium ${adj.type === 'add' ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {adj.type === 'add' ? '+' : '-'}{' '}
                      {formatCurrency(Math.abs(adj.amount))}
                    </span>
                  </div>
                ))}
              <div className="flex justify-between pt-2 border-t font-semibold">
                <span>= Cash for Debt Service</span>
                <span
                  className={`text-green-700 ${isAdjusted ? 'bg-amber-100 px-1 rounded' : ''}`}
                >
                  {formatCurrency(adjustedNumerator)}
                </span>
              </div>
            </div>
          </div>

          {/* Denominator */}
          <div className="border rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              Denominator (Total Debt Service)
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">
                  Principal Payments
                </span>
                <span className="font-medium">
                  {formatCurrency(breakdown.ttm_principal_payments)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">
                  + Interest Expense
                </span>
                <span className="font-medium">
                  + {formatCurrency(breakdown.ttm_interest_expense)}
                </span>
              </div>
              {breakdown.lease_payments > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    + Lease Payments
                  </span>
                  <span className="font-medium">
                    + {formatCurrency(breakdown.lease_payments)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t font-semibold">
                <span>= Total Debt Service</span>
                <span className="text-gray-700">
                  {formatCurrency(breakdown.denominator)}
                </span>
              </div>
            </div>
          </div>

          {/* Result */}
          <div
            className={`rounded-lg p-4 text-center ${isAdjusted ? 'bg-amber-50 border-2 border-amber-300' : 'border border-black'}`}
          >
            {isAdjusted && (
              <div className="text-xs text-amber-700 font-medium mb-2">
                ADJUSTED CALCULATION
              </div>
            )}
            <div className="text-sm text-gray-600 mb-2">
              {formatCurrency(adjustedNumerator)} /{' '}
              {formatCurrency(breakdown.denominator)} =
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl font-bold text-gray-800">
                {formatRatio(adjustedFCCR)}
              </span>
              <Badge
                className={`${adjustedHealth.bgClass} text-white`}
              >
                {getHealthLabel(adjustedHealth.level)}
              </Badge>
            </div>
            {isAdjusted && latestMetrics.fccr !== adjustedFCCR && (
              <div className="text-xs text-gray-500 mt-2">
                Original: {formatRatio(latestMetrics.fccr)}
              </div>
            )}
          </div>

          {/* Accordions for Adjustments and Sources */}
          <Accordion type="multiple" className="w-full">
            {/* CapEx Treatment Accordion */}
            <AccordionItem
              value="capex"
              className="border rounded-lg"
            >
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-amber-800">
                    CapEx Treatment
                  </span>
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded capitalize">
                    {capexTreatment}
                    {capexTreatment === 'custom'
                      ? ` (${customCapexPct}%)`
                      : ''}
                  </span>
                  {isCapexAdjusted && (
                    <span className="text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded">
                      Modified
                    </span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-3">
                  {isCapexAdjusted && (
                    <button
                      onClick={() => {
                        setCapexTreatment(defaultCapexTreatment);
                        setCustomCapexPct(defaultCustomPct);
                      }}
                      className="text-xs text-amber-700 hover:text-amber-900 underline"
                    >
                      Reset to Default
                    </button>
                  )}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="capexTreatment"
                        checked={capexTreatment === 'unfunded'}
                        onChange={() => setCapexTreatment('unfunded')}
                        className="text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-sm text-gray-700">
                        Unfunded{' '}
                        <span className="text-xs text-gray-500">
                          (CapEx - Debt Proceeds)
                        </span>
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="capexTreatment"
                        checked={capexTreatment === 'all'}
                        onChange={() => setCapexTreatment('all')}
                        className="text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-sm text-gray-700">
                        All CapEx{' '}
                        <span className="text-xs text-gray-500">
                          (100% deducted)
                        </span>
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="capexTreatment"
                        checked={capexTreatment === 'none'}
                        onChange={() => setCapexTreatment('none')}
                        className="text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-sm text-gray-700">
                        None{' '}
                        <span className="text-xs text-gray-500">
                          (No deduction)
                        </span>
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="capexTreatment"
                        checked={capexTreatment === 'custom'}
                        onChange={() => setCapexTreatment('custom')}
                        className="text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-sm text-gray-700">
                        Custom %
                      </span>
                      {capexTreatment === 'custom' && (
                        <div className="flex items-center gap-1 ml-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={customCapexPct}
                            onChange={(e) =>
                              setCustomCapexPct(
                                Math.min(
                                  100,
                                  Math.max(
                                    0,
                                    parseInt(e.target.value) || 0,
                                  ),
                                ),
                              )
                            }
                            className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-600">
                            %
                          </span>
                        </div>
                      )}
                    </label>
                  </div>
                  <div className="pt-2 border-t text-xs text-gray-500">
                    Total CapEx:{' '}
                    {formatCurrency(breakdown.capital_expenditures)} |
                    Debt Proceeds:{' '}
                    {formatCurrency(breakdown.proceeds_from_lt_debt)}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Custom Adjustments Calculator Accordion */}
            <AccordionItem
              value="custom-adjustments"
              className="border rounded-lg mt-2"
            >
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800">
                    Custom Adjustments
                  </span>
                  {customAdjustments.length > 0 && (
                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                      {customAdjustments.length} item
                      {customAdjustments.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {hasCustomAdjustments && (
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${customAdjustmentTotal >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                    >
                      {customAdjustmentTotal >= 0 ? '+' : ''}
                      {formatCurrency(customAdjustmentTotal)}
                    </span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">
                    Add custom line items to adjust the FCCR numerator
                    calculation.
                  </p>
                  {customAdjustments.map((adj) => (
                    <div
                      key={adj.id}
                      className="flex items-center gap-2 p-2 rounded border border-black"
                    >
                      <select
                        value={adj.type}
                        onChange={(e) =>
                          updateCustomAdjustment(
                            adj.id,
                            'type',
                            e.target.value,
                          )
                        }
                        className="text-sm border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="add">+ Add</option>
                        <option value="subtract">- Subtract</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Description"
                        value={adj.label}
                        onChange={(e) =>
                          updateCustomAdjustment(
                            adj.id,
                            'label',
                            e.target.value,
                          )
                        }
                        className="flex-1 text-sm border border-gray-300 rounded px-2 py-1"
                      />
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-gray-500">
                          $
                        </span>
                        <input
                          type="number"
                          placeholder="0"
                          value={adj.amount || ''}
                          onChange={(e) =>
                            updateCustomAdjustment(
                              adj.id,
                              'amount',
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="w-24 text-sm border border-gray-300 rounded px-2 py-1"
                        />
                        <span className="text-xs text-gray-500">
                          K
                        </span>
                      </div>
                      <button
                        onClick={() => removeCustomAdjustment(adj.id)}
                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addCustomAdjustment}
                    className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800 border border-black rounded px-2 py-1"
                  >
                    <Plus className="h-4 w-4" />
                    Add Adjustment
                  </button>
                  {customAdjustments.length > 0 && (
                    <div className="pt-2 border-t flex justify-between text-sm">
                      <span className="font-medium text-gray-700">
                        Net Adjustment:
                      </span>
                      <span
                        className={`font-semibold ${customAdjustmentTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {customAdjustmentTotal >= 0 ? '+' : ''}
                        {formatCurrency(customAdjustmentTotal)}
                      </span>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Source Data Accordion */}
            {sources && (
              <AccordionItem
                value="sources"
                className="border rounded-lg mt-2"
              >
                <AccordionTrigger className="px-4 hover:no-underline">
                  <span className="text-sm font-semibold text-gray-700">
                    Source Calculation Breakdown
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-3 text-xs">
                    <div className="font-medium text-gray-600 border-b pb-1">
                      Numerator Sources
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-gray-500">
                          CapEx (extracted):
                        </span>
                        <span className="ml-1 font-medium">
                          {formatCurrency(
                            sources.capital_expenditures_extracted,
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">
                          LT Debt Proceeds:
                        </span>
                        <span className="ml-1 font-medium">
                          {formatCurrency(
                            sources.proceeds_from_lt_debt_extracted,
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">
                          Cash Taxes:
                        </span>
                        <span className="ml-1 font-medium">
                          {formatCurrency(
                            sources.cash_taxes_paid_extracted,
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">
                          Distributions:
                        </span>
                        <span className="ml-1 font-medium">
                          {formatCurrency(
                            sources.distributions_paid_extracted,
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="font-medium text-gray-600 border-b pb-1 pt-2">
                      Denominator Sources
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-gray-500">
                          Principal (extracted):
                        </span>
                        <span className="ml-1 font-medium">
                          {formatCurrency(
                            sources.ttm_principal_payments_extracted,
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">
                          Repayment (fallback):
                        </span>
                        <span className="ml-1 font-medium">
                          {formatCurrency(
                            sources.repayment_of_debt_fallback,
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">
                          Interest (extracted):
                        </span>
                        <span className="ml-1 font-medium">
                          {formatCurrency(
                            sources.ttm_interest_expense_extracted,
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">
                          Cash Interest (fallback):
                        </span>
                        <span className="ml-1 font-medium">
                          {formatCurrency(
                            sources.cash_interest_paid_fallback,
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">
                          Lease Payments:
                        </span>
                        <span className="ml-1 font-medium">
                          {formatCurrency(
                            sources.lease_payments_extracted,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </div>

        {/* Right Column: YOY Comparison */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-700">
            Year-over-Year Comparison
          </h4>
          <div className="border border-black rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-black">
                <tr>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">
                    Year
                  </th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">
                    Numerator
                  </th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">
                    Denominator
                  </th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">
                    FCCR
                  </th>
                </tr>
              </thead>
              <tbody>
                {yoyData.map((row) => {
                  const isLatest = row.year === latestYear;
                  const health = getFCCRHealth(row.fccr ?? 0);
                  return (
                    <tr
                      key={row.year}
                      className={`border-t ${isLatest ? 'font-semibold' : ''} hover:bg-gray-50`}
                    >
                      <td
                        className={`py-2 px-3 ${isLatest ? 'font-semibold' : ''}`}
                      >
                        {row.year}
                        {isLatest && (
                          <span className="ml-1 text-xs text-gray-600">
                            (Latest)
                          </span>
                        )}
                      </td>
                      <td className="text-right py-2 px-3">
                        {formatCurrency(row.numerator)}
                      </td>
                      <td className="text-right py-2 px-3">
                        {formatCurrency(row.denominator)}
                      </td>
                      <td className="text-right py-2 px-3">
                        <span
                          className={`font-medium ${health.textClass}`}
                        >
                          {formatRatio(row.fccr)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Trend interpretation */}
          {yoyData.length > 1 && (
            <div className="border border-black rounded-lg p-3 text-sm text-gray-700">
              <strong>Trend Analysis:</strong>{' '}
              {(() => {
                const latest = yoyData[yoyData.length - 1]?.fccr ?? 0;
                const previous =
                  yoyData[yoyData.length - 2]?.fccr ?? 0;
                if (latest > previous) {
                  return `FCCR improved by ${formatRatio(latest - previous)} from the prior year.`;
                } else if (latest < previous) {
                  return `FCCR declined by ${formatRatio(previous - latest)} from the prior year.`;
                }
                return 'FCCR remained stable from the prior year.';
              })()}
            </div>
          )}

          {/* Interpretation */}
          <div className="border border-black rounded-lg p-3 text-sm text-gray-700">
            <strong>Target:</strong> FCCR &gt; 1.2x indicates strong
            coverage. Values below 1.0x suggest the company cannot
            fully cover its fixed charges from operating cash flow.
          </div>
        </div>
      </div>
    );
  };

  // Senior Debt / EBITDA Breakdown Content
  const DebtEbitdaBreakdownContent = () => {
    const debtBreakdown = latestMetrics.debt_breakdown;

    // Calculate YOY data
    const yoyData = years.map((year) => {
      const yearMetrics = financialData.metrics_by_year[year];
      return {
        year,
        seniorDebt: yearMetrics.senior_debt,
        ebitda: yearMetrics.adjusted_ebitda ?? yearMetrics.ebitda,
        ratio: yearMetrics.senior_debt_to_ebitda,
      };
    });

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Calculation */}
        <div className="space-y-4">
          {/* Formula */}
          <div className="rounded-lg p-3 border border-black">
            <code className="text-xs text-gray-600">
              Senior Debt / EBITDA = Senior Debt / Adjusted EBITDA
            </code>
          </div>

          {/* Components */}
          <div className="border rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              Components
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Senior Debt</span>
                <span className="font-medium">
                  {formatCurrency(latestMetrics.senior_debt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Adjusted EBITDA</span>
                <span className="font-medium">
                  {formatCurrency(
                    latestMetrics.adjusted_ebitda ??
                      latestMetrics.ebitda,
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Result */}
          <div className="rounded-lg p-4 text-center border border-black">
            <div className="text-sm text-gray-600 mb-2">
              {formatCurrency(latestMetrics.senior_debt)} /{' '}
              {formatCurrency(
                latestMetrics.adjusted_ebitda ?? latestMetrics.ebitda,
              )}{' '}
              =
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl font-bold text-gray-800">
                {formatRatio(latestMetrics.senior_debt_to_ebitda)}
              </span>
              <Badge
                className={`${debtEbitdaHealth.bgClass} text-white`}
              >
                {getHealthLabel(debtEbitdaHealth.level)}
              </Badge>
            </div>
          </div>

          {/* Interpretation */}
          <div className="border border-black rounded-lg p-3 text-sm text-gray-700">
            <strong>Target:</strong> &lt;2.5x for investment grade.
            Lower ratios indicate less leverage and greater capacity
            to service debt.
          </div>

          {/* Source Calculation Breakdown Accordion */}
          <Accordion type="multiple" className="w-full">
            <AccordionItem
              value="sources"
              className="border rounded-lg"
            >
              <AccordionTrigger className="px-4 hover:no-underline">
                <span className="text-sm font-semibold text-gray-700">
                  Source Calculation Breakdown
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-4 text-xs">
                  {/* Senior Debt Breakdown */}
                  <div>
                    <div className="font-medium text-gray-600 border-b pb-1 mb-2">
                      Senior Debt Composition
                    </div>
                    {debtBreakdown ? (
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-500">
                            Bank Debt:
                          </span>
                          <span className="font-medium">
                            {formatCurrency(debtBreakdown.bank_debt)}
                          </span>
                        </div>
                        {debtBreakdown.notes_payable > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">
                              Notes Payable (Senior):
                            </span>
                            <span className="font-medium">
                              {formatCurrency(
                                debtBreakdown.notes_payable,
                              )}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between pt-1 border-t font-medium">
                          <span className="text-gray-600">
                            Total Senior Debt:
                          </span>
                          <span>
                            {formatCurrency(
                              latestMetrics.senior_debt,
                            )}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-400 italic">
                        Detailed breakdown not available
                      </p>
                    )}
                  </div>

                  {/* EBITDA Source */}
                  <div>
                    <div className="font-medium text-gray-600 border-b pb-1 mb-2">
                      EBITDA Source
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-500">
                          Reported EBITDA:
                        </span>
                        <span className="font-medium">
                          {formatCurrency(latestMetrics.ebitda)}
                        </span>
                      </div>
                      {latestMetrics.adjusted_ebitda &&
                        latestMetrics.adjusted_ebitda !==
                          latestMetrics.ebitda && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">
                              Adjusted EBITDA:
                            </span>
                            <span className="font-medium text-green-600">
                              {formatCurrency(
                                latestMetrics.adjusted_ebitda,
                              )}
                            </span>
                          </div>
                        )}
                      <div className="flex justify-between pt-1 border-t font-medium">
                        <span className="text-gray-600">
                          EBITDA Used:
                        </span>
                        <span>
                          {formatCurrency(
                            latestMetrics.adjusted_ebitda ??
                              latestMetrics.ebitda,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Right Column: YOY Comparison */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-700">
            Year-over-Year Comparison
          </h4>
          <div className="border border-black rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-black">
                <tr>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">
                    Year
                  </th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">
                    Sr. Debt
                  </th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">
                    EBITDA
                  </th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">
                    Ratio
                  </th>
                </tr>
              </thead>
              <tbody>
                {yoyData.map((row) => {
                  const isLatest = row.year === latestYear;
                  const health = getSeniorDebtEBITDAHealth(
                    row.ratio ?? 999,
                  );
                  return (
                    <tr
                      key={row.year}
                      className={`border-t ${isLatest ? 'font-semibold' : ''} hover:bg-gray-50`}
                    >
                      <td
                        className={`py-2 px-3 ${isLatest ? 'font-semibold' : ''}`}
                      >
                        {row.year}
                        {isLatest && (
                          <span className="ml-1 text-xs text-gray-600">
                            (Latest)
                          </span>
                        )}
                      </td>
                      <td className="text-right py-2 px-3">
                        {formatCurrency(row.seniorDebt)}
                      </td>
                      <td className="text-right py-2 px-3">
                        {formatCurrency(row.ebitda)}
                      </td>
                      <td className="text-right py-2 px-3">
                        <span
                          className={`font-medium ${health.textClass}`}
                        >
                          {formatRatio(row.ratio)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Trend interpretation */}
          {yoyData.length > 1 && (
            <div className="border border-black rounded-lg p-3 text-sm text-gray-700">
              <strong>Trend Analysis:</strong>{' '}
              {(() => {
                const latest =
                  yoyData[yoyData.length - 1]?.ratio ?? 999;
                const previous =
                  yoyData[yoyData.length - 2]?.ratio ?? 999;
                if (latest < previous) {
                  return `Leverage improved (decreased by ${formatRatio(previous - latest)}) from the prior year.`;
                } else if (latest > previous) {
                  return `Leverage increased by ${formatRatio(latest - previous)} from the prior year.`;
                }
                return 'Leverage remained stable from the prior year.';
              })()}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Debt / Capital Breakdown Content
  const DebtCapitalBreakdownContent = () => {
    const totalCapital =
      (latestMetrics.total_debt ?? 0) +
      (latestMetrics.shareholders_equity ?? 0);
    const debtBreakdown = latestMetrics.debt_breakdown;

    // Calculate YOY data
    const yoyData = years.map((year) => {
      const yearMetrics = financialData.metrics_by_year[year];
      const yearTotalCapital =
        (yearMetrics.total_debt ?? 0) +
        (yearMetrics.shareholders_equity ?? 0);
      return {
        year,
        totalDebt: yearMetrics.total_debt,
        equity: yearMetrics.shareholders_equity,
        totalCapital: yearTotalCapital,
        ratio: yearMetrics.total_debt_to_capital,
      };
    });

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Calculation */}
        <div className="space-y-4">
          {/* Formula */}
          <div className="rounded-lg p-3 border border-black">
            <code className="text-xs text-gray-600">
              Debt/Capital = Total Debt / (Total Debt +
              Shareholders&apos; Equity)
            </code>
          </div>

          {/* Components */}
          <div className="border rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              Components
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Debt</span>
                <span className="font-medium">
                  {formatCurrency(latestMetrics.total_debt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">
                  Shareholders&apos; Equity
                </span>
                <span className="font-medium">
                  {formatCurrency(latestMetrics.shareholders_equity)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="text-gray-600">Total Capital</span>
                <span className="font-medium">
                  {formatCurrency(totalCapital)}
                </span>
              </div>
            </div>
          </div>

          {/* Result */}
          <div className="rounded-lg p-4 text-center border border-black">
            <div className="text-sm text-gray-600 mb-2">
              {formatCurrency(latestMetrics.total_debt)} /{' '}
              {formatCurrency(totalCapital)} =
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl font-bold text-gray-800">
                {formatPercent(latestMetrics.total_debt_to_capital)}
              </span>
              <Badge
                className={`${debtCapitalHealth.bgClass} text-white`}
              >
                {getHealthLabel(debtCapitalHealth.level)}
              </Badge>
            </div>
          </div>

          {/* Interpretation */}
          <div className="border border-black rounded-lg p-3 text-sm text-gray-700">
            <strong>Target:</strong> &lt;50% indicates healthy capital
            structure. Lower ratios suggest stronger equity position
            and reduced financial risk.
          </div>

          {/* Source Calculation Breakdown Accordion */}
          <Accordion type="multiple" className="w-full">
            <AccordionItem
              value="sources"
              className="border rounded-lg"
            >
              <AccordionTrigger className="px-4 hover:no-underline">
                <span className="text-sm font-semibold text-gray-700">
                  Source Calculation Breakdown
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-4 text-xs">
                  {/* Total Debt Breakdown */}
                  <div>
                    <div className="font-medium text-gray-600 border-b pb-1 mb-2">
                      Total Debt Composition
                    </div>
                    {debtBreakdown ? (
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-500">
                            Bank Debt:
                          </span>
                          <span className="font-medium">
                            {formatCurrency(debtBreakdown.bank_debt)}
                          </span>
                        </div>
                        {debtBreakdown.lease_liabilities > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">
                              Lease Liabilities:
                            </span>
                            <span className="font-medium">
                              {formatCurrency(
                                debtBreakdown.lease_liabilities,
                              )}
                            </span>
                          </div>
                        )}
                        {debtBreakdown.notes_payable > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">
                              Notes Payable:
                            </span>
                            <span className="font-medium">
                              {formatCurrency(
                                debtBreakdown.notes_payable,
                              )}
                            </span>
                          </div>
                        )}
                        {debtBreakdown.subordinated_debt > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">
                              Subordinated Debt:
                            </span>
                            <span className="font-medium">
                              {formatCurrency(
                                debtBreakdown.subordinated_debt,
                              )}
                            </span>
                          </div>
                        )}
                        {debtBreakdown.other_non_senior_debt > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">
                              Other Non-Senior Debt:
                            </span>
                            <span className="font-medium">
                              {formatCurrency(
                                debtBreakdown.other_non_senior_debt,
                              )}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between pt-1 border-t font-medium">
                          <span className="text-gray-600">
                            Total Debt:
                          </span>
                          <span>
                            {formatCurrency(latestMetrics.total_debt)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between">
                        <span className="text-gray-500">
                          Total Debt (extracted):
                        </span>
                        <span className="font-medium">
                          {formatCurrency(latestMetrics.total_debt)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Capital Structure */}
                  <div>
                    <div className="font-medium text-gray-600 border-b pb-1 mb-2">
                      Capital Structure
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-500">
                          Debt Component:
                        </span>
                        <span className="font-medium">
                          {formatCurrency(latestMetrics.total_debt)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">
                          Equity Component:
                        </span>
                        <span className="font-medium">
                          {formatCurrency(
                            latestMetrics.shareholders_equity,
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between pt-1 border-t font-medium">
                        <span className="text-gray-600">
                          Total Capital:
                        </span>
                        <span>{formatCurrency(totalCapital)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Right Column: YOY Comparison */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-700">
            Year-over-Year Comparison
          </h4>
          <div className="border border-black rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-black">
                <tr>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">
                    Year
                  </th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">
                    Debt
                  </th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">
                    Equity
                  </th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">
                    Ratio
                  </th>
                </tr>
              </thead>
              <tbody>
                {yoyData.map((row) => {
                  const isLatest = row.year === latestYear;
                  const health = getDebtCapitalHealth(row.ratio ?? 1);
                  return (
                    <tr
                      key={row.year}
                      className={`border-t ${isLatest ? 'font-semibold' : ''} hover:bg-gray-50`}
                    >
                      <td
                        className={`py-2 px-3 ${isLatest ? 'font-semibold' : ''}`}
                      >
                        {row.year}
                        {isLatest && (
                          <span className="ml-1 text-xs text-gray-600">
                            (Latest)
                          </span>
                        )}
                      </td>
                      <td className="text-right py-2 px-3">
                        {formatCurrency(row.totalDebt)}
                      </td>
                      <td className="text-right py-2 px-3">
                        {formatCurrency(row.equity)}
                      </td>
                      <td className="text-right py-2 px-3">
                        <span
                          className={`font-medium ${health.textClass}`}
                        >
                          {formatPercent(row.ratio)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Trend interpretation */}
          {yoyData.length > 1 && (
            <div className="border border-black rounded-lg p-3 text-sm text-gray-700">
              <strong>Trend Analysis:</strong>{' '}
              {(() => {
                const latest =
                  yoyData[yoyData.length - 1]?.ratio ?? 1;
                const previous =
                  yoyData[yoyData.length - 2]?.ratio ?? 1;
                const diff = ((latest - previous) * 100).toFixed(1);
                if (latest < previous) {
                  return `Capital structure improved with debt ratio decreasing ${Math.abs(parseFloat(diff))}% from prior year.`;
                } else if (latest > previous) {
                  return `Debt ratio increased ${diff}% from the prior year.`;
                }
                return 'Capital structure remained stable from the prior year.';
              })()}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Current Ratio Breakdown Content
  const CurrentRatioBreakdownContent = () => {
    // Calculate YOY data
    const yoyData = years.map((year) => {
      const yearMetrics = financialData.metrics_by_year[year];
      return {
        year,
        ratio: yearMetrics.current_ratio ?? null,
      };
    });

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Calculation */}
        <div className="space-y-4">
          {/* Formula */}
          <div className="rounded-lg p-3 border border-black">
            <code className="text-xs text-gray-600">
              Current Ratio = Current Assets / Current Liabilities
            </code>
          </div>

          {/* Result */}
          <div className="rounded-lg p-4 text-center border border-black">
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl font-bold text-gray-800">
                {formatRatio(latestMetrics.current_ratio ?? null)}
              </span>
              <Badge
                className={`${currentRatioHealth.bgClass} text-white`}
              >
                {getHealthLabel(currentRatioHealth.level)}
              </Badge>
            </div>
          </div>

          {/* Interpretation */}
          <div className="border border-black rounded-lg p-3 text-sm text-gray-700">
            <strong>Target:</strong> &gt;1.5x indicates strong
            liquidity. A ratio &gt;1 means the company can cover
            current liabilities with current assets.
          </div>

          {/* Source Calculation Breakdown Accordion */}
          <Accordion type="multiple" className="w-full">
            <AccordionItem
              value="sources"
              className="border rounded-lg"
            >
              <AccordionTrigger className="px-4 hover:no-underline">
                <span className="text-sm font-semibold text-gray-700">
                  Source Calculation Breakdown
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-3 text-xs">
                  <div>
                    <div className="font-medium text-gray-600 border-b pb-1 mb-2">
                      Liquidity Components
                    </div>
                    <div className="space-y-2">
                      <p className="text-gray-500 italic">
                        Current Ratio is extracted directly from the
                        financial statements. A ratio of{' '}
                        {formatRatio(
                          latestMetrics.current_ratio ?? null,
                        )}{' '}
                        means:
                      </p>
                      <ul className="list-disc list-inside text-gray-600 space-y-1">
                        <li>
                          For every $1 of current liabilities, the
                          company has $
                          {(latestMetrics.current_ratio ?? 0).toFixed(
                            2,
                          )}{' '}
                          in current assets
                        </li>
                        {(latestMetrics.current_ratio ?? 0) > 1 && (
                          <li className="text-green-600">
                            Company can cover all short-term
                            obligations
                          </li>
                        )}
                        {(latestMetrics.current_ratio ?? 0) < 1 && (
                          <li className="text-red-600">
                            Company may struggle to meet short-term
                            obligations
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>

                  <div>
                    <div className="font-medium text-gray-600 border-b pb-1 mb-2">
                      Typical Current Assets
                    </div>
                    <ul className="list-disc list-inside text-gray-500 space-y-1">
                      <li>Cash and cash equivalents</li>
                      <li>Accounts receivable</li>
                      <li>Inventory</li>
                      <li>Prepaid expenses</li>
                    </ul>
                  </div>

                  <div>
                    <div className="font-medium text-gray-600 border-b pb-1 mb-2">
                      Typical Current Liabilities
                    </div>
                    <ul className="list-disc list-inside text-gray-500 space-y-1">
                      <li>Accounts payable</li>
                      <li>Short-term debt</li>
                      <li>Current portion of long-term debt</li>
                      <li>Accrued expenses</li>
                    </ul>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Right Column: YOY Comparison */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-700">
            Year-over-Year Comparison
          </h4>
          <div className="border border-black rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-black">
                <tr>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">
                    Year
                  </th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">
                    Current Ratio
                  </th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {yoyData.map((row) => {
                  const isLatest = row.year === latestYear;
                  const health = getCurrentRatioHealth(
                    row.ratio ?? 0,
                  );
                  return (
                    <tr
                      key={row.year}
                      className={`border-t ${isLatest ? 'font-semibold' : ''} hover:bg-gray-50`}
                    >
                      <td
                        className={`py-2 px-3 ${isLatest ? 'font-semibold' : ''}`}
                      >
                        {row.year}
                        {isLatest && (
                          <span className="ml-1 text-xs text-gray-600">
                            (Latest)
                          </span>
                        )}
                      </td>
                      <td className="text-right py-2 px-3">
                        <span
                          className={`font-medium ${health.textClass}`}
                        >
                          {formatRatio(row.ratio)}
                        </span>
                      </td>
                      <td className="text-right py-2 px-3">
                        <Badge
                          className={`${health.bgClass} text-white text-xs`}
                        >
                          {getHealthLabel(health.level)}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Trend interpretation */}
          {yoyData.length > 1 && (
            <div className="border border-black rounded-lg p-3 text-sm text-gray-700">
              <strong>Trend Analysis:</strong>{' '}
              {(() => {
                const latest =
                  yoyData[yoyData.length - 1]?.ratio ?? 0;
                const previous =
                  yoyData[yoyData.length - 2]?.ratio ?? 0;
                if (latest > previous) {
                  return `Liquidity improved by ${formatRatio(latest - previous)} from the prior year.`;
                } else if (latest < previous) {
                  return `Liquidity declined by ${formatRatio(previous - latest)} from the prior year.`;
                }
                return 'Liquidity remained stable from the prior year.';
              })()}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Get breakdown content and title for expanded card
  const getBreakdownContent = (id: MetricId) => {
    switch (id) {
      case 'fccr':
        return {
          title: 'Fixed Charge Coverage Ratio (FCCR)',
          subtitle: `Measures the ability to cover fixed charges with operating cash flow - FY ${latestYear}`,
          content: <FCCRBreakdownContent />,
        };
      case 'debtEbitda':
        return {
          title: 'Senior Debt / EBITDA',
          subtitle: `Measures leverage relative to earnings - FY ${latestYear}`,
          content: <DebtEbitdaBreakdownContent />,
        };
      case 'debtCapital':
        return {
          title: 'Total Debt / Total Capital',
          subtitle: `Measures the proportion of debt financing - FY ${latestYear}`,
          content: <DebtCapitalBreakdownContent />,
        };
      case 'currentRatio':
        return {
          title: 'Current Ratio',
          subtitle: `Measures short-term liquidity - FY ${latestYear}`,
          content: <CurrentRatioBreakdownContent />,
        };
    }
  };

  const handleExpand = (id: MetricId) => {
    setExpandedCard(id);
  };

  const handleCollapse = () => {
    setExpandedCard(null);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* FCCR Card */}
      <MetricCard
        id="fccr"
        title="FCCR"
        value={formatRatio(latestMetrics.fccr)}
        health={fccrHealth}
        target="Target: > 1.2x"
        tooltip="Fixed Charge Coverage Ratio measures the company's ability to cover fixed charges (interest + lease payments) with operating cash flow. Higher is better."
        sparklineData={calculateSparklineData(fccrValues, true)}
        trend={getTrendInfo('fccr')}
        isExpanded={expandedCard === 'fccr'}
        expandedCard={expandedCard}
        onExpand={() => handleExpand('fccr')}
        onCollapse={handleCollapse}
        breakdownTitle={getBreakdownContent('fccr').title}
        breakdownSubtitle={getBreakdownContent('fccr').subtitle}
        breakdownContent={getBreakdownContent('fccr').content}
      />

      {/* Senior Debt / EBITDA Card */}
      <MetricCard
        id="debtEbitda"
        title="Sr. Debt / EBITDA"
        value={formatRatio(latestMetrics.senior_debt_to_ebitda)}
        health={debtEbitdaHealth}
        target="Target: < 2.5x"
        tooltip="Senior Debt to EBITDA ratio measures leverage. Lower indicates less debt relative to earnings. Target varies by industry."
        sparklineData={calculateSparklineData(
          debtEbitdaValues,
          false,
        )}
        trend={getTrendInfo('senior leverage')}
        isExpanded={expandedCard === 'debtEbitda'}
        expandedCard={expandedCard}
        onExpand={() => handleExpand('debtEbitda')}
        onCollapse={handleCollapse}
        breakdownTitle={getBreakdownContent('debtEbitda').title}
        breakdownSubtitle={getBreakdownContent('debtEbitda').subtitle}
        breakdownContent={getBreakdownContent('debtEbitda').content}
      />

      {/* Debt / Capital Card */}
      <MetricCard
        id="debtCapital"
        title="Debt / Capital"
        value={formatPercent(latestMetrics.total_debt_to_capital)}
        health={debtCapitalHealth}
        target="Target: < 50%"
        tooltip="Total Debt to Total Capital ratio shows the proportion of debt financing. Lower indicates stronger equity position."
        sparklineData={calculateSparklineData(
          debtCapitalValues,
          false,
        )}
        trend={getTrendInfo('debt / capital')}
        isExpanded={expandedCard === 'debtCapital'}
        expandedCard={expandedCard}
        onExpand={() => handleExpand('debtCapital')}
        onCollapse={handleCollapse}
        breakdownTitle={getBreakdownContent('debtCapital').title}
        breakdownSubtitle={
          getBreakdownContent('debtCapital').subtitle
        }
        breakdownContent={getBreakdownContent('debtCapital').content}
      />

      {/* Current Ratio Card */}
      <MetricCard
        id="currentRatio"
        title="Current Ratio"
        value={formatRatio(latestMetrics.current_ratio ?? null)}
        health={currentRatioHealth}
        target="Target: > 1.5x"
        tooltip="Current Ratio measures short-term liquidity - the ability to pay current liabilities with current assets. Higher indicates better liquidity."
        sparklineData={calculateSparklineData(
          currentRatioValues,
          true,
        )}
        trend={getTrendInfo('current ratio')}
        isExpanded={expandedCard === 'currentRatio'}
        expandedCard={expandedCard}
        onExpand={() => handleExpand('currentRatio')}
        onCollapse={handleCollapse}
        breakdownTitle={getBreakdownContent('currentRatio').title}
        breakdownSubtitle={
          getBreakdownContent('currentRatio').subtitle
        }
        breakdownContent={getBreakdownContent('currentRatio').content}
      />
    </div>
  );
};

export default MetricCardGrid;

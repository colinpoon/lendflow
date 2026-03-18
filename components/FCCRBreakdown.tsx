'use client';

import React, { useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface CustomAdjustment {
  id: string;
  amount: number;
  description: string;
}

type CapexTreatmentMode = 'unfunded' | 'all' | 'none' | 'custom';

interface FCCRBreakdownData {
  calculation_type: string;
  capex_treatment: CapexTreatmentMode;
  capex_custom_percentage?: number;
  adjusted_ebitda: number;
  capital_expenditures: number;
  proceeds_from_lt_debt: number;
  unfunded_capex: number;
  capex_deduction: number;
  cash_taxes_paid: number;
  distributions_paid: number;
  numerator: number;
  ttm_principal_payments: number;
  ttm_interest_expense: number;
  lease_payments: number;
  operating_lease_payments?: number;
  operating_lease_treatment?: 'exclude' | 'include';
  denominator: number;
  // Source values for transparency
  sources?: {
    capital_expenditures_extracted: number | null;
    proceeds_from_lt_debt_extracted: number | null;
    cash_taxes_paid_extracted: number | null;
    distributions_paid_extracted: number | null;
    principal_source: string;
    principal_value: number | null;
    interest_source: string;
    interest_value: number | null;
    lease_source: string;
    lease_value: number | null;
    lease_interest_deducted?: number | null;
  };
}

interface DSCRBreakdownData {
  calculation_type: string;
  adjusted_ebitda: number;
  bank_principal_payments: number;
  bank_interest_expense: number;
  lease_payments: number;
  total_debt_service: number;
  dscr: number;
  funded_debt: number;
  funded_debt_to_ebitda: number | null;
}

interface YearMetrics {
  fccr?: number | null;
  fccr_breakdown?: FCCRBreakdownData | null;
  dscr?: number | null;
  dscr_breakdown?: DSCRBreakdownData | null;
  funded_debt?: number | null;
  funded_debt_to_ebitda?: number | null;
  capital_expenditures?: number | null;
  proceeds_from_long_term_debt?: number | null;
}

interface FCCRBreakdownProps {
  data: { metrics_by_year: Record<string, YearMetrics> } | null;
  capexTreatment?: 'all' | 'unfunded' | 'none' | 'custom';
  customCapexPercent?: number;
  onCapexTreatmentChange?: (treatment: 'all' | 'unfunded' | 'none' | 'custom') => void;
  onCustomPercentChange?: (percent: number) => void;
  // Props for lifted custom adjustments state
  customAdjustments?: CustomAdjustment[];
  onCustomAdjustmentsChange?: (adjustments: CustomAdjustment[]) => void;
}

const formatCurrency = (value: number | null | undefined): string => {
  if (value == null) return 'N/A';

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  return `${sign}$${absValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}K`;
};

const formatRatio = (value: number | null | undefined): string => {
  if (value == null) return 'N/A';
  return `${value.toFixed(2)}x`;
};

// Helper to show source info (extracted vs fallback)
const SourceInfo: React.FC<{
  extracted: number | null | undefined;
  fallback?: number | null | undefined;
  fallbackLabel?: string;
  fallback2?: number | null | undefined;
  fallback2Label?: string;
}> = ({ extracted, fallback, fallbackLabel, fallback2, fallback2Label }) => {
  const parts: string[] = [];

  if (extracted != null) {
    parts.push(`extracted: ${extracted.toLocaleString()}`);
  } else {
    parts.push('extracted: null');
    if (fallback != null) {
      parts.push(`${fallbackLabel || 'fallback'}: ${fallback.toLocaleString()}`);
    } else if (fallbackLabel) {
      parts.push(`${fallbackLabel}: null`);
    }
    if (fallback2 != null) {
      parts.push(`${fallback2Label || 'fallback2'}: ${fallback2.toLocaleString()}`);
    } else if (fallback2Label) {
      parts.push(`${fallback2Label}: null`);
    }
  }

  return (
    <span className="text-xs text-gray-400 ml-1">
      ({parts.join(', ')})
    </span>
  );
};

const getRatioColor = (ratio: number | null, thresholds: { good: number; ok: number; warning: number }): string => {
  if (ratio == null) return 'text-gray-500';
  if (ratio >= thresholds.good) return 'text-green-600';
  if (ratio >= thresholds.ok) return 'text-lime-600';
  if (ratio >= thresholds.warning) return 'text-yellow-600';
  return 'text-red-600';
};

const FCCRBreakdown: React.FC<FCCRBreakdownProps> = ({
  data,
  capexTreatment = 'unfunded',
  customCapexPercent = 100,
  onCapexTreatmentChange,
  onCustomPercentChange,
  customAdjustments: externalAdjustments,
  onCustomAdjustmentsChange,
}) => {
  // Custom adjustments - use external state if provided, otherwise local state
  const [localAdjustments, setLocalAdjustments] = useState<CustomAdjustment[]>([]);
  const customAdjustments = externalAdjustments ?? localAdjustments;
  const setCustomAdjustments = onCustomAdjustmentsChange ?? setLocalAdjustments;

  const [newAdjustmentAmount, setNewAdjustmentAmount] = useState<string>('');
  const [newAdjustmentDescription, setNewAdjustmentDescription] = useState<string>('');

  // Accordion open state - all open by default
  const [openAccordions, setOpenAccordions] = useState<string[]>(['fccr', 'dscr', 'guide']);

  if (!data?.metrics_by_year || Object.keys(data.metrics_by_year).length === 0) {
    return <p className="text-gray-500">No coverage ratio data available.</p>;
  }

  const years = Object.keys(data.metrics_by_year).sort().reverse();
  const latestYear = years[0];
  const metrics = data.metrics_by_year[latestYear];
  const fccrBreakdown = metrics.fccr_breakdown;
  const dscrBreakdown = metrics.dscr_breakdown;

  // Calculate total custom adjustments
  const totalCustomAdjustments = customAdjustments.reduce((sum, adj) => sum + adj.amount, 0);

  // Calculate adjusted numerator and FCCR
  const adjustedNumerator = fccrBreakdown
    ? fccrBreakdown.numerator + totalCustomAdjustments
    : null;
  // Use original FCCR when adjustments sum to zero to avoid floating point precision issues
  const adjustedFCCR =
    totalCustomAdjustments === 0
      ? metrics.fccr
      : (adjustedNumerator != null && fccrBreakdown && fccrBreakdown.denominator > 0
          ? parseFloat((adjustedNumerator / fccrBreakdown.denominator).toFixed(2))
          : metrics.fccr);

  // Handler to add a new adjustment
  const handleAddAdjustment = () => {
    const amount = parseFloat(newAdjustmentAmount);
    if (isNaN(amount) || !newAdjustmentDescription.trim()) return;

    const newAdjustment: CustomAdjustment = {
      id: Date.now().toString(),
      amount,
      description: newAdjustmentDescription.trim(),
    };

    setCustomAdjustments([...customAdjustments, newAdjustment]);
    setNewAdjustmentAmount('');
    setNewAdjustmentDescription('');
  };

  // Handler to remove an adjustment
  const handleRemoveAdjustment = (id: string) => {
    setCustomAdjustments(customAdjustments.filter(adj => adj.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-800">Debt Coverage Analysis</h3>
        <span className="text-sm text-gray-500">Fiscal Year {latestYear}</span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* FCCR Card */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 text-center border border-blue-200">
          <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Covenant FCCR</p>
          <p className={`text-2xl font-bold ${getRatioColor(adjustedFCCR ?? null, { good: 2.0, ok: 1.5, warning: 1.25 })}`}>
            {formatRatio(adjustedFCCR)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Cash Flow Coverage (Lender)</p>
          {totalCustomAdjustments !== 0 && (
            <p className="text-xs text-blue-500 mt-1">(adjusted)</p>
          )}
        </div>

        {/* DSCR Card */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 text-center border border-purple-200">
          <p className="text-xs text-purple-600 font-medium uppercase tracking-wide">DSCR</p>
          <p className={`text-2xl font-bold ${getRatioColor(metrics.dscr ?? null, { good: 2.0, ok: 1.5, warning: 1.25 })}`}>
            {formatRatio(metrics.dscr)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Debt Service Coverage</p>
        </div>

        {/* Funded Debt Card */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 text-center border border-gray-200">
          <p className="text-xs text-gray-600 font-medium uppercase tracking-wide">Funded Debt</p>
          <p className="text-2xl font-bold text-gray-800">
            {formatCurrency(metrics.funded_debt)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Bank Debt + Finance Leases</p>
        </div>

        {/* Funded Debt / EBITDA Card */}
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4 text-center border border-amber-200">
          <p className="text-xs text-amber-600 font-medium uppercase tracking-wide">Leverage</p>
          <p className={`text-2xl font-bold ${getRatioColor(metrics.funded_debt_to_ebitda ?? null, { good: 1.5, ok: 2.5, warning: 3.0 })}`}>
            {formatRatio(metrics.funded_debt_to_ebitda)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Funded Debt / EBITDA</p>
        </div>
      </div>

      {/* CapEx Treatment Selector (Option B) */}
      {onCapexTreatmentChange && (
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="font-semibold text-gray-800">CapEx Treatment</h4>
              <p className="text-xs text-gray-500">How should capital expenditures affect Covenant FCCR?</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <button
              onClick={() => onCapexTreatmentChange('unfunded')}
              className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                capexTreatment === 'unfunded'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium">Unfunded Only</div>
              <div className="text-xs opacity-75">Recommended</div>
            </button>
            <button
              onClick={() => onCapexTreatmentChange('all')}
              className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                capexTreatment === 'all'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium">Deduct All</div>
              <div className="text-xs opacity-75">Conservative</div>
            </button>
            <button
              onClick={() => onCapexTreatmentChange('none')}
              className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                capexTreatment === 'none'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium">No Deduction</div>
              <div className="text-xs opacity-75">Growth CapEx</div>
            </button>
            <button
              onClick={() => onCapexTreatmentChange('custom')}
              className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                capexTreatment === 'custom'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium">Custom %</div>
              <div className="text-xs opacity-75">Manual</div>
            </button>
          </div>
          {capexTreatment === 'custom' && onCustomPercentChange && (
            <div className="mt-3 flex items-center gap-3">
              <label className="text-sm text-gray-600">Deduct</label>
              <input
                type="number"
                min="0"
                max="100"
                value={customCapexPercent}
                onChange={(e) => onCustomPercentChange(Number(e.target.value))}
                className="w-20 px-2 py-1 border rounded text-center"
              />
              <span className="text-sm text-gray-600">% of CapEx</span>
            </div>
          )}
        </div>
      )}

      <Accordion type="multiple" value={openAccordions} onValueChange={setOpenAccordions} className="w-full">
        {/* FCCR Breakdown */}
        {fccrBreakdown && (
          <AccordionItem value="fccr" className="border rounded-lg px-4 mb-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-gray-800">Covenant FCCR Calculation Breakdown</span>
                <span className={`text-sm px-2 py-0.5 rounded ${getRatioColor(metrics.fccr ?? null, { good: 2.0, ok: 1.5, warning: 1.25 })} bg-opacity-20`}>
                  {formatRatio(metrics.fccr)}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 text-sm">
                {/* Methodology Disclosure */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-700 text-xs">
                  <strong>Covenant FCCR — Lendflow Methodology:</strong> This ratio uses a lender-defined cash flow formula, not the rating-agency (Moody&apos;s/S&amp;P) FCCR.
                  The numerator deducts unfunded CapEx and cash taxes from Adjusted EBITDA to represent true cash available for debt service.
                  Distributions are excluded — they are discretionary and typically restricted by the covenant, not included in the coverage calculation.
                </div>

                {/* Numerator Section */}
                <div className="bg-green-50 rounded-lg p-4">
                  <h5 className="font-semibold text-green-800 mb-3">
                    Numerator Components
                    {!fccrBreakdown.sources && (
                      <span className="text-xs text-amber-600 ml-2">(Re-upload document to see source values)</span>
                    )}
                  </h5>
                  <div className="space-y-2">
                    {/* Adjusted EBITDA */}
                    <div className="flex justify-between">
                      <span className="text-gray-700 font-medium">Adjusted EBITDA</span>
                      <span className="font-semibold">{formatCurrency(fccrBreakdown.adjusted_ebitda)}</span>
                    </div>

                    {/* CapEx Section */}
                    <div className="border-t border-green-200 pt-2 mt-2">
                      <div className="flex justify-between text-gray-600">
                        <span className="flex items-center flex-wrap">
                          Capital Expenditures
                          {fccrBreakdown.sources && (
                            <SourceInfo extracted={fccrBreakdown.sources.capital_expenditures_extracted} />
                          )}
                        </span>
                        <span>{formatCurrency(fccrBreakdown.capital_expenditures)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span className="flex items-center flex-wrap">
                          Proceeds from LT Debt
                          {fccrBreakdown.sources && (
                            <SourceInfo extracted={fccrBreakdown.sources.proceeds_from_lt_debt_extracted} />
                          )}
                        </span>
                        <span>{formatCurrency(fccrBreakdown.proceeds_from_lt_debt)}</span>
                      </div>
                      <div className="flex justify-between font-medium mt-1">
                        <span className="flex items-center gap-2">
                          Unfunded CapEx
                          <span className="px-1.5 py-0.5 bg-green-200 rounded text-xs text-green-700">
                            {fccrBreakdown.capex_treatment === 'unfunded' && 'CapEx - Proceeds'}
                            {fccrBreakdown.capex_treatment === 'all' && '100% CapEx'}
                            {fccrBreakdown.capex_treatment === 'none' && 'Excluded'}
                            {fccrBreakdown.capex_treatment === 'custom' && `${fccrBreakdown.capex_custom_percentage ?? 0}%`}
                          </span>
                        </span>
                        <span className="text-red-600">
                          {fccrBreakdown.unfunded_capex === 0 ? '$0K' : `- ${formatCurrency(fccrBreakdown.unfunded_capex)}`}
                        </span>
                      </div>
                    </div>

                    {/* Other Deductions */}
                    <div className="border-t border-green-200 pt-2 mt-2">
                      <div className="flex justify-between text-gray-600">
                        <span className="flex items-center flex-wrap">
                          Cash Taxes Paid
                          {fccrBreakdown.sources && (
                            <SourceInfo extracted={fccrBreakdown.sources.cash_taxes_paid_extracted} />
                          )}
                        </span>
                        <span className="text-red-600">- {formatCurrency(fccrBreakdown.cash_taxes_paid)}</span>
                      </div>
                    </div>

                    {/* Custom Adjustments Section */}
                    {customAdjustments.length > 0 && (
                      <div className="border-t border-green-200 pt-2 mt-2">
                        <div className="text-xs text-green-700 font-medium mb-2">Custom Adjustments:</div>
                        <div className="space-y-1">
                          {customAdjustments.map((adj) => (
                            <div key={adj.id} className="flex justify-between items-center text-gray-600 group">
                              <span className="flex items-center gap-2">
                                <button
                                  onClick={() => handleRemoveAdjustment(adj.id)}
                                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity text-xs"
                                  title="Remove adjustment"
                                >
                                  ×
                                </button>
                                {adj.description}
                              </span>
                              <span className={adj.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {adj.amount >= 0 ? '+ ' : '- '}{formatCurrency(Math.abs(adj.amount))}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add New Adjustment Input */}
                    <div className="border-t border-green-200 pt-3 mt-2">
                      <div className="text-xs text-green-700 font-medium mb-2">Add Adjustment:</div>
                      <div className="flex gap-2">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                          <input
                            type="number"
                            value={newAdjustmentAmount}
                            onChange={(e) => setNewAdjustmentAmount(e.target.value)}
                            placeholder="0"
                            className="w-24 pl-6 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                          />
                        </div>
                        <input
                          type="text"
                          value={newAdjustmentDescription}
                          onChange={(e) => setNewAdjustmentDescription(e.target.value)}
                          placeholder="Description..."
                          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddAdjustment();
                          }}
                        />
                        <button
                          onClick={handleAddAdjustment}
                          disabled={!newAdjustmentAmount || !newAdjustmentDescription.trim()}
                          className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                        >
                          Add
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Use negative values for deductions, positive for additions
                      </p>
                    </div>

                    {/* Numerator Total */}
                    <div className="flex justify-between font-bold border-t-2 border-green-400 pt-2 mt-2 bg-green-100 -mx-4 px-4 py-2 rounded-b">
                      <span>= Cash Available for Debt Service {totalCustomAdjustments !== 0 && '(Adjusted)'}</span>
                      <span className="text-green-700">
                        {formatCurrency(totalCustomAdjustments === 0 ? fccrBreakdown.numerator : (adjustedNumerator ?? fccrBreakdown.numerator))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Denominator Section */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h5 className="font-semibold text-blue-800 mb-3">
                    Denominator Components
                  </h5>
                  <div className="space-y-2">
                    <div className="flex justify-between text-gray-600">
                      <span className="flex items-center flex-wrap">
                        Principal Payments
                        {fccrBreakdown.sources && (
                          <span className="text-xs text-gray-400 ml-1">
                            (via {fccrBreakdown.sources.principal_source})
                          </span>
                        )}
                      </span>
                      <span>{formatCurrency(fccrBreakdown.ttm_principal_payments)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span className="flex items-center flex-wrap">
                        Interest Expense
                        {fccrBreakdown.sources && (
                          <span className="text-xs text-gray-400 ml-1">
                            (via {fccrBreakdown.sources.interest_source})
                          </span>
                        )}
                      </span>
                      <span>{formatCurrency(fccrBreakdown.ttm_interest_expense)}</span>
                    </div>
                    {fccrBreakdown.lease_payments > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span className="flex items-center flex-wrap">
                          Finance Lease Payments
                          {fccrBreakdown.sources && (
                            <span className="text-xs text-gray-400 ml-1">
                              (via {fccrBreakdown.sources.lease_source})
                            </span>
                          )}
                        </span>
                        <span>{formatCurrency(fccrBreakdown.lease_payments)}</span>
                      </div>
                    )}
                    {fccrBreakdown.operating_lease_payments != null && fccrBreakdown.operating_lease_payments > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span className="flex items-center flex-wrap">
                          Operating Lease Payments
                          <span className="text-xs text-blue-500 ml-1">(included per config)</span>
                        </span>
                        <span>{formatCurrency(fccrBreakdown.operating_lease_payments)}</span>
                      </div>
                    )}
                    {fccrBreakdown.sources?.lease_interest_deducted != null && fccrBreakdown.sources.lease_interest_deducted > 0 && (
                      <div className="flex justify-between text-gray-500 text-xs italic">
                        <span>Lease interest deducted from interest to avoid double-count</span>
                        <span>- {formatCurrency(fccrBreakdown.sources.lease_interest_deducted)}</span>
                      </div>
                    )}
                    {/* Denominator Total */}
                    <div className="flex justify-between font-bold border-t-2 border-blue-400 pt-2 mt-2 bg-blue-100 -mx-4 px-4 py-2 rounded-b">
                      <span>= Total Debt Service</span>
                      <span className="text-blue-700">{formatCurrency(fccrBreakdown.denominator)}</span>
                    </div>
                  </div>
                </div>

                {/* Final Calculation */}
                <div className="bg-gray-100 rounded-lg p-4">
                  <h5 className="font-semibold text-gray-700 mb-3 text-center">Covenant FCCR Calculation</h5>
                  <div className="space-y-2 font-mono text-xs text-gray-600">
                    <div>
                      <span className="text-gray-500">Numerator =</span> {fccrBreakdown.adjusted_ebitda.toLocaleString()} - {fccrBreakdown.unfunded_capex.toLocaleString()} - {fccrBreakdown.cash_taxes_paid.toLocaleString()} = <span className="font-semibold text-green-700">{fccrBreakdown.numerator.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Denominator =</span> {fccrBreakdown.ttm_principal_payments.toLocaleString()} + {fccrBreakdown.ttm_interest_expense.toLocaleString()}{fccrBreakdown.lease_payments > 0 ? ` + ${fccrBreakdown.lease_payments.toLocaleString()}` : ''} = <span className="font-semibold text-blue-700">{fccrBreakdown.denominator.toLocaleString()}</span>
                    </div>
                    <div className="pt-2 border-t border-gray-300 text-center">
                      <span className="text-gray-500">Covenant FCCR =</span> {(adjustedNumerator ?? fccrBreakdown.numerator).toLocaleString()} / {fccrBreakdown.denominator.toLocaleString()} = <span className={`font-bold text-lg ${getRatioColor(adjustedFCCR ?? null, { good: 2.0, ok: 1.5, warning: 1.25 })}`}>{formatRatio(adjustedFCCR)}</span>
                    </div>
                  </div>
                  {totalCustomAdjustments !== 0 && (
                    <div className="text-xs text-gray-500 mt-2 text-center">
                      Base Covenant FCCR: {formatRatio(metrics.fccr)} | Adjustments: {formatCurrency(totalCustomAdjustments)}
                    </div>
                  )}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* DSCR Breakdown (Banker's Method) */}
        {dscrBreakdown && (
          <AccordionItem value="dscr" className="border rounded-lg px-4 mb-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-gray-800">DSCR Calculation (Banker&apos;s Covenant)</span>
                <span className={`text-sm px-2 py-0.5 rounded ${getRatioColor(metrics.dscr ?? null, { good: 2.0, ok: 1.5, warning: 1.25 })} bg-opacity-20`}>
                  {formatRatio(metrics.dscr)}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 text-sm">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-purple-700 text-xs">
                  <strong>Banker&apos;s Method:</strong> Simpler formula used in loan covenants.
                  Does not deduct CapEx from numerator (assumes discretionary).
                  Typical covenant requirement: DSCR &ge; 1.25x
                </div>

                {/* Numerator */}
                <div className="bg-green-50 rounded-lg p-4">
                  <h5 className="font-semibold text-green-800 mb-3">Numerator</h5>
                  <div className="flex justify-between font-bold">
                    <span>Adjusted EBITDA</span>
                    <span className="text-green-700">{formatCurrency(dscrBreakdown.adjusted_ebitda)}</span>
                  </div>
                </div>

                {/* Denominator */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h5 className="font-semibold text-blue-800 mb-3">Denominator: Total Debt Service</h5>
                  <div className="space-y-2">
                    <div className="flex justify-between text-gray-600">
                      <span>Bank Principal Payments</span>
                      <span>{formatCurrency(dscrBreakdown.bank_principal_payments)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Cash Interest Paid</span>
                      <span>{formatCurrency(dscrBreakdown.bank_interest_expense)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Lease Payments</span>
                      <span>{formatCurrency(dscrBreakdown.lease_payments)}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t border-blue-300 pt-2">
                      <span>= Total Debt Service</span>
                      <span className="text-blue-700">{formatCurrency(dscrBreakdown.total_debt_service)}</span>
                    </div>
                  </div>
                </div>

                {/* Final Calculation */}
                <div className="bg-gray-100 rounded-lg p-4 text-center">
                  <div className="font-mono text-sm text-gray-700">
                    DSCR = {formatCurrency(dscrBreakdown.adjusted_ebitda)} / {formatCurrency(dscrBreakdown.total_debt_service)} = <span className="font-bold text-lg">{formatRatio(metrics.dscr)}</span>
                  </div>
                </div>

                {/* Funded Debt / EBITDA */}
                <div className="bg-amber-50 rounded-lg p-4">
                  <h5 className="font-semibold text-amber-800 mb-3">Funded Debt / EBITDA (Leverage Covenant)</h5>
                  <div className="space-y-2">
                    <div className="flex justify-between text-gray-600">
                      <span>Funded Debt (Bank Debt + Finance Leases)</span>
                      <span>{formatCurrency(dscrBreakdown.funded_debt)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Adjusted EBITDA</span>
                      <span>{formatCurrency(dscrBreakdown.adjusted_ebitda)}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t border-amber-300 pt-2">
                      <span>= Leverage Ratio</span>
                      <span className={getRatioColor(dscrBreakdown.funded_debt_to_ebitda, { good: 1.5, ok: 2.5, warning: 3.0 })}>
                        {formatRatio(dscrBreakdown.funded_debt_to_ebitda)}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Typical covenant: Funded Debt / EBITDA &le; 3.0x
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Interpretation Guide */}
        <AccordionItem value="guide" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <span className="font-semibold text-gray-800">Interpretation Guide</span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 text-sm">
              <div>
                <h5 className="font-semibold text-gray-700 mb-2">Covenant FCCR vs DSCR</h5>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1">Metric</th>
                      <th className="text-left py-1">Use Case</th>
                      <th className="text-left py-1">CapEx Treatment</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-1 font-medium">Covenant FCCR</td>
                      <td className="py-1">Conservative analysis</td>
                      <td className="py-1">Deducts unfunded CapEx</td>
                    </tr>
                    <tr>
                      <td className="py-1 font-medium">DSCR</td>
                      <td className="py-1">Bank covenants</td>
                      <td className="py-1">No CapEx deduction</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div>
                <h5 className="font-semibold text-gray-700 mb-2">Typical Covenant Thresholds</h5>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">DSCR / Covenant FCCR</div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-green-500"></span>
                      <span>&ge; 2.0x Excellent</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-lime-500"></span>
                      <span>&ge; 1.5x Good</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                      <span>&ge; 1.25x Adequate</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-500"></span>
                      <span>&lt; 1.25x Concern</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Funded Debt / EBITDA</div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-green-500"></span>
                      <span>&le; 1.5x Low leverage</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-lime-500"></span>
                      <span>&le; 2.5x Moderate</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                      <span>&le; 3.0x Covenant limit</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-500"></span>
                      <span>&gt; 3.0x High leverage</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default FCCRBreakdown;

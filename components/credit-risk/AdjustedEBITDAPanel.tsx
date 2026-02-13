'use client';

import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { FinancialData } from '@/types';
import { formatCurrency, getLatestYear } from './utils';

interface AdjustedEBITDAPanelProps {
  financialData: FinancialData;
}

/**
 * Format currency with sign for adjustments
 */
const formatSignedCurrency = (
  value: number | null | undefined,
  isSubtraction = false,
): string => {
  if (value == null || value === 0) return '$0K';
  const prefix = isSubtraction ? '- ' : '+ ';
  return prefix + formatCurrency(Math.abs(value)).replace('-', '');
};

interface AdjustmentLineProps {
  label: string;
  value: number | null | undefined;
  isSubtraction?: boolean;
}

const AdjustmentLine: React.FC<AdjustmentLineProps> = ({
  label,
  value,
  isSubtraction = false,
}) => {
  if (value == null || value === 0) return null;

  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-gray-600">{label}</span>
      <span
        className={`font-medium ${isSubtraction ? 'text-red-600' : 'text-green-600'}`}
      >
        {formatSignedCurrency(value, isSubtraction)}
      </span>
    </div>
  );
};

interface AdjustmentCategoryProps {
  title: string;
  items: { label: string; value: number | null | undefined }[];
  total: number;
  isSubtraction?: boolean;
}

const AdjustmentCategory: React.FC<AdjustmentCategoryProps> = ({
  title,
  items,
  total,
  isSubtraction = false,
}) => {
  const hasNonZeroItems = items.some(
    (item) => item.value != null && item.value !== 0,
  );

  if (!hasNonZeroItems && total === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <h5 className="text-sm font-semibold text-gray-700">
          {title}
        </h5>
        <span
          className={`text-sm font-bold ${isSubtraction ? 'text-red-600' : 'text-green-600'}`}
        >
          {formatSignedCurrency(total, isSubtraction)}
        </span>
      </div>
      <div className="pl-4 border-l-2 border-gray-200">
        {items.map(
          (item) =>
            item.value != null &&
            item.value !== 0 && (
              <AdjustmentLine
                key={item.label}
                label={item.label}
                value={item.value}
                isSubtraction={isSubtraction}
              />
            ),
        )}
      </div>
    </div>
  );
};

const AdjustedEBITDAPanel: React.FC<AdjustedEBITDAPanelProps> = ({
  financialData,
}) => {
  if (
    !financialData?.metrics_by_year ||
    Object.keys(financialData.metrics_by_year).length === 0
  ) {
    return null;
  }

  // Get the most recent year's data
  const years = Object.keys(financialData.metrics_by_year)
    .sort()
    .reverse();
  const latestYear = getLatestYear(financialData.metrics_by_year);
  const metrics = financialData.metrics_by_year[latestYear];

  if (metrics.ebitda == null) {
    return null;
  }

  const breakdown = metrics.adjusted_ebitda_breakdown;
  const components = metrics.adjusted_ebitda_components;
  const adjustedEBITDA = metrics.adjusted_ebitda;
  const reportedAdjustedEBITDA = metrics.reported_adjusted_ebitda;
  const calculatedAdjustedEBITDA = metrics.calculated_adjusted_ebitda;
  const usesReportedValue =
    breakdown?.uses_reported_value ?? reportedAdjustedEBITDA != null;

  // Check if there are any adjustments
  const hasAdjustments =
    breakdown &&
    (breakdown.non_cash_adjustments !== 0 ||
      breakdown.one_time_expenses !== 0 ||
      breakdown.one_time_gains !== 0 ||
      breakdown.owner_management_adjustments !== 0 ||
      breakdown.accounting_adjustments !== 0 ||
      breakdown.fx_adjustments !== 0 ||
      breakdown.pro_forma_adjustments !== 0 ||
      breakdown.capital_expenditures_not_in_calc !== 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        Adjusted EBITDA
      </h3>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">
            (Values in thousands)
          </span>
          <span className="text-sm text-gray-500">
            Fiscal Year {latestYear}
          </span>
        </div>

        {/* Reported vs Calculated indicator */}
        {usesReportedValue && (
          <div className="border border-gray-300 rounded-lg p-3">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">
                Company-Reported Value:
              </span>{' '}
              Using Adjusted EBITDA as reported by the company in
              their financial documents.
            </p>
            {calculatedAdjustedEBITDA != null &&
              calculatedAdjustedEBITDA !== adjustedEBITDA && (
                <p className="text-xs text-gray-500 mt-1">
                  Our calculated estimate:{' '}
                  {formatCurrency(calculatedAdjustedEBITDA)}
                </p>
              )}
          </div>
        )}

        {/* Main EBITDA values */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg p-4 text-center border border-gray-300">
            <p className="text-sm text-gray-600 font-medium">
              Reported EBITDA
            </p>
            <p className="text-2xl font-bold text-gray-800">
              {formatCurrency(metrics.ebitda)}
            </p>
          </div>
          <div className="rounded-lg p-4 text-center bg-green-50 border border-green-200">
            <p className="text-sm font-medium text-green-600">
              Adjusted EBITDA {usesReportedValue && '(Reported)'}
            </p>
            <p className="text-2xl font-bold text-green-700">
              {formatCurrency(adjustedEBITDA)}
            </p>
          </div>
        </div>

        {/* Formula */}
        <div className="rounded-lg p-3 text-center border border-gray-300">
          <span className="font-mono text-xs text-gray-600">
            Adjusted EBITDA = Reported EBITDA + Non-Cash + One-Time
            Expenses - One-Time Gains - CapEx
          </span>
        </div>

        {/* Accordion Sections */}
        <Accordion type="multiple" className="w-full">
          {/* Adjustment Breakdown Accordion */}
          {hasAdjustments && breakdown && components && (
            <AccordionItem
              value="breakdown"
              className="border rounded-lg px-4"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-800">
                    Adjustment Breakdown
                  </span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                    {formatCurrency(adjustedEBITDA)}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {/* Reported EBITDA */}
                <div className="flex justify-between items-center mb-4 pb-2 border-b">
                  <span className="font-medium text-gray-700">
                    Reported EBITDA
                  </span>
                  <span className="font-bold text-gray-900">
                    {formatCurrency(breakdown.reported_ebitda)}
                  </span>
                </div>

                {/* Non-Cash Adjustments */}
                <AdjustmentCategory
                  title="Non-Cash Adjustments"
                  total={breakdown.non_cash_adjustments}
                  items={[
                    {
                      label: 'Stock-Based Compensation',
                      value: components.stock_based_compensation,
                    },
                    {
                      label: 'Impairment Charges',
                      value: components.impairment_charges,
                    },
                    {
                      label: 'Goodwill Impairment',
                      value: components.goodwill_impairment,
                    },
                    {
                      label: 'Unrealized Gains/Losses',
                      value: components.unrealized_gains_losses,
                    },
                    {
                      label: 'Deferred Compensation',
                      value: components.deferred_compensation,
                    },
                    {
                      label: 'Loss on Disposal of Assets',
                      value: components.loss_on_disposal,
                    },
                    {
                      label: 'Other Non-Cash',
                      value: components.other_non_cash,
                    },
                  ]}
                />

                {/* One-Time Expenses */}
                <AdjustmentCategory
                  title="One-Time/Non-Recurring Expenses"
                  total={breakdown.one_time_expenses}
                  items={[
                    {
                      label: 'Restructuring Costs',
                      value: components.restructuring_costs,
                    },
                    {
                      label: 'Severance Costs',
                      value: components.severance_costs,
                    },
                    {
                      label: 'Transaction Costs',
                      value: components.transaction_costs,
                    },
                    {
                      label: 'Legal Settlements',
                      value: components.legal_settlements,
                    },
                    {
                      label: 'Professional Fees (One-Time)',
                      value: components.professional_fees_one_time,
                    },
                    {
                      label: 'Casualty Losses',
                      value: components.casualty_losses,
                    },
                    {
                      label: 'Other One-Time Expenses',
                      value: components.other_one_time_expenses,
                    },
                  ]}
                />

                {/* One-Time Gains (subtract) */}
                <AdjustmentCategory
                  title="One-Time Gains/Income (Subtracted)"
                  total={breakdown.one_time_gains}
                  isSubtraction
                  items={[
                    {
                      label: 'Gain on Disposal of Assets',
                      value: components.gain_on_disposal,
                    },
                    {
                      label: 'Gain on Asset Sale',
                      value: components.gain_on_asset_sale,
                    },
                    {
                      label: 'Other Income (Non-Operating)',
                      value: components.other_income_non_operating,
                    },
                    {
                      label: 'Insurance Proceeds',
                      value: components.insurance_proceeds,
                    },
                    {
                      label: 'Other One-Time Gains',
                      value: components.other_one_time_gains,
                    },
                  ]}
                />

                {/* Owner/Management Adjustments */}
                <AdjustmentCategory
                  title="Owner/Management Adjustments"
                  total={breakdown.owner_management_adjustments}
                  items={[
                    {
                      label: 'Owner Compensation Adjustment',
                      value: components.owner_compensation_adjustment,
                    },
                    {
                      label: 'Related Party Adjustments',
                      value: components.related_party_adjustments,
                    },
                    {
                      label: 'Management Fees Adjustment',
                      value: components.management_fees_adjustment,
                    },
                  ]}
                />

                {/* Accounting Policy Adjustments */}
                {breakdown.accounting_adjustments !== 0 && (
                  <AdjustmentCategory
                    title="Accounting Policy Adjustments"
                    total={breakdown.accounting_adjustments}
                    items={[
                      {
                        label: 'Accounting Policy Changes',
                        value:
                          components.accounting_policy_adjustments,
                      },
                    ]}
                  />
                )}

                {/* FX Adjustments */}
                {breakdown.fx_adjustments !== 0 && (
                  <AdjustmentCategory
                    title={
                      breakdown.fx_adjustments >= 0
                        ? 'Foreign Exchange Loss (Add Back)'
                        : 'Foreign Exchange Gain (Subtract)'
                    }
                    total={Math.abs(breakdown.fx_adjustments)}
                    isSubtraction={breakdown.fx_adjustments < 0}
                    items={[
                      {
                        label:
                          breakdown.fx_adjustments >= 0
                            ? 'FX Loss'
                            : 'FX Gain',
                        value: Math.abs(
                          components.foreign_exchange_adjustments ??
                            0,
                        ),
                      },
                    ]}
                  />
                )}

                {/* Pro Forma Adjustments */}
                <AdjustmentCategory
                  title="Pro Forma Adjustments"
                  total={breakdown.pro_forma_adjustments}
                  items={[
                    {
                      label: 'Cost Savings',
                      value: components.pro_forma_cost_savings,
                    },
                    {
                      label: 'Synergies',
                      value: components.pro_forma_synergies,
                    },
                  ]}
                />

                {/* Capital Expenditures (subtract) */}
                {breakdown.capital_expenditures_not_in_calc !== 0 && (
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <h5 className="text-sm font-semibold text-gray-700">
                        Capital Expenditures (Maintenance CapEx)
                      </h5>
                      <span className="text-sm font-bold text-red-600">
                        {formatSignedCurrency(
                          breakdown.capital_expenditures_not_in_calc,
                          true,
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 pl-4">
                      Cash required to maintain productive capacity of
                      the business
                    </p>
                  </div>
                )}

                {/* Total */}
                <div className="flex justify-between items-center mt-4 pt-4 border-t-2 border-gray-300">
                  <span className="font-bold text-gray-800">
                    Adjusted EBITDA
                  </span>
                  <span className="font-bold text-xl text-green-700">
                    {formatCurrency(adjustedEBITDA)}
                  </span>
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {!hasAdjustments && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-700">
                No EBITDA adjustments were identified in the financial
                documents. The Adjusted EBITDA equals the Reported
                EBITDA.
              </p>
            </div>
          )}

          {/* Historical Comparison Accordion */}
          {years.length > 1 && (
            <AccordionItem
              value="historical"
              className="border rounded-lg px-4 mt-4"
            >
              <AccordionTrigger className="hover:no-underline">
                <span className="font-semibold text-gray-800">
                  Historical EBITDA Comparison
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-4">
                          Metric
                        </th>
                        {years.map((yr) => (
                          <th
                            key={yr}
                            className="text-right py-2 px-2"
                          >
                            {yr}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-2 pr-4">Reported EBITDA</td>
                        {years.map((yr) => (
                          <td
                            key={yr}
                            className="text-right py-2 px-2"
                          >
                            {formatCurrency(
                              financialData.metrics_by_year[yr]
                                .ebitda,
                            )}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b bg-green-50">
                        <td className="py-2 pr-4 font-medium">
                          Adjusted EBITDA
                        </td>
                        {years.map((yr) => (
                          <td
                            key={yr}
                            className="text-right py-2 px-2 font-medium"
                          >
                            {formatCurrency(
                              financialData.metrics_by_year[yr]
                                .adjusted_ebitda,
                            )}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </div>
    </div>
  );
};

export default AdjustedEBITDAPanel;

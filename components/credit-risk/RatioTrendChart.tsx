'use client';

import React, { useState } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TrendDataPoint } from './types';
import { CHART_COLORS, formatRatio, formatPercent } from './utils';

interface RatioTrendChartProps {
  data: TrendDataPoint[];
  title?: string;
}

// Custom tooltip component
const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number;
    color: string;
    name: string;
  }>;
  label?: string;
}> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 shadow-lg rounded-lg p-3">
      <p className="text-sm font-semibold text-gray-700 mb-2">FY {label}</p>
      <div className="space-y-1">
        {payload.map((entry, index) => {
          const value = entry.value;
          const isDebtCapital = entry.dataKey === 'debtCapital';
          const formattedValue = isDebtCapital
            ? formatPercent(value)
            : formatRatio(value);

          return (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs text-gray-600">{entry.name}</span>
              </div>
              <span className="text-xs font-semibold text-gray-800">
                {formattedValue}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Legend toggle checkbox
const LegendCheckbox: React.FC<{
  label: string;
  color: string;
  checked: boolean;
  onChange: () => void;
}> = ({ label, color, checked, onChange }) => (
  <label className="flex items-center gap-2 cursor-pointer select-none">
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="sr-only"
    />
    <span
      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
        checked ? 'border-transparent' : 'border-gray-300 bg-white'
      }`}
      style={{ backgroundColor: checked ? color : undefined }}
    >
      {checked && (
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </span>
    <span className="text-sm text-gray-700">{label}</span>
  </label>
);

const RatioTrendChart: React.FC<RatioTrendChartProps> = ({
  data,
  title = 'Ratio Trends',
}) => {
  // Track which series are visible
  const [visibleSeries, setVisibleSeries] = useState({
    fccr: true,
    seniorDebtEbitda: true,
    debtCapital: true,
  });

  const toggleSeries = (key: keyof typeof visibleSeries) => {
    setVisibleSeries(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Transform data: convert debtCapital from decimal to percentage for display
  const chartData = data.map(d => ({
    ...d,
    // Keep original values for tooltip, chart will show as-is
  }));

  if (data.length === 0) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-gray-500">
            No trend data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="text-lg">{title}</CardTitle>
          {/* Series toggles */}
          <div className="flex flex-wrap gap-4">
            <LegendCheckbox
              label="FCCR"
              color={CHART_COLORS.fccr}
              checked={visibleSeries.fccr}
              onChange={() => toggleSeries('fccr')}
            />
            <LegendCheckbox
              label="Sr. Debt/EBITDA"
              color={CHART_COLORS.seniorDebtEbitda}
              checked={visibleSeries.seniorDebtEbitda}
              onChange={() => toggleSeries('seniorDebtEbitda')}
            />
            <LegendCheckbox
              label="Debt/Capital"
              color={CHART_COLORS.debtCapital}
              checked={visibleSeries.debtCapital}
              onChange={() => toggleSeries('debtCapital')}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={{ stroke: '#d1d5db' }}
                axisLine={{ stroke: '#d1d5db' }}
              />
              <YAxis
                yAxisId="ratio"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={{ stroke: '#d1d5db' }}
                axisLine={{ stroke: '#d1d5db' }}
                domain={[0, 'auto']}
                tickFormatter={(value) => `${value}x`}
              />
              <YAxis
                yAxisId="percent"
                orientation="right"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={{ stroke: '#d1d5db' }}
                axisLine={{ stroke: '#d1d5db' }}
                domain={[0, 1]}
                tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
              />
              <Tooltip content={<CustomTooltip />} />

              {/* Reference lines for targets */}
              <ReferenceLine
                yAxisId="ratio"
                y={1.2}
                stroke="#22c55e"
                strokeDasharray="5 5"
                strokeOpacity={0.5}
                label={{ value: 'FCCR Target', position: 'insideTopRight', fontSize: 10, fill: '#22c55e' }}
              />

              {/* FCCR bars */}
              {visibleSeries.fccr && (
                <Bar
                  yAxisId="ratio"
                  dataKey="fccr"
                  name="FCCR"
                  fill={CHART_COLORS.fccr}
                  radius={[4, 4, 0, 0]}
                  barSize={30}
                />
              )}

              {/* Sr. Debt/EBITDA line */}
              {visibleSeries.seniorDebtEbitda && (
                <Line
                  yAxisId="ratio"
                  type="monotone"
                  dataKey="seniorDebtEbitda"
                  name="Sr. Debt/EBITDA"
                  stroke={CHART_COLORS.seniorDebtEbitda}
                  strokeWidth={2}
                  dot={{ fill: CHART_COLORS.seniorDebtEbitda, strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              )}

              {/* Debt/Capital line (percentage axis) */}
              {visibleSeries.debtCapital && (
                <Line
                  yAxisId="percent"
                  type="monotone"
                  dataKey="debtCapital"
                  name="Debt/Capital"
                  stroke={CHART_COLORS.debtCapital}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: CHART_COLORS.debtCapital, strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legend explanation */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-500">
          <span>Bars: Coverage ratios (left axis)</span>
          <span>Lines: Leverage ratios (left/right axis)</span>
          <span>Dashed green: FCCR target (1.2x)</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default RatioTrendChart;

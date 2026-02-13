'use client';

import React, { useMemo } from 'react';
import { AlertCircle, FileText } from 'lucide-react';
import HeroRiskScore from './HeroRiskScore';
import RatioTrendChart from './RatioTrendChart';
import MetricCardGrid from './MetricCardGrid';
import AdjustedEBITDAPanel from './AdjustedEBITDAPanel';
import RiskFactorsPanel from './RiskFactorsPanel';
import type { CreditRiskDashboardProps, MainFinancialData } from './types';
import {
  getLatestYear,
  transformToTrendData,
} from './utils';

const CreditRiskDashboard: React.FC<CreditRiskDashboardProps> = ({
  financialData,
  quantitativeRiskAssessment,
  debtHealthAssessment,
  riskData,
  yearSourceInfo,
  showSourceBanner = false,
}) => {
  // Derived data
  const latestYear = useMemo(() => {
    if (!financialData?.metrics_by_year) return '';
    return getLatestYear(financialData.metrics_by_year);
  }, [financialData]);

  const latestMetrics = useMemo(() => {
    if (!financialData?.metrics_by_year || !latestYear) return null;
    return financialData.metrics_by_year[latestYear];
  }, [financialData, latestYear]);

  const trendData = useMemo(() => {
    if (!financialData?.metrics_by_year) return [];
    return transformToTrendData(financialData.metrics_by_year);
  }, [financialData]);

  // Empty state
  if (!financialData?.metrics_by_year || Object.keys(financialData.metrics_by_year).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <AlertCircle className="h-12 w-12 mb-4 text-gray-300" />
        <p className="text-lg font-medium">No financial data available</p>
        <p className="text-sm">Upload a financial document to see the credit risk analysis</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with year indicator */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Credit-Risk Snapshot</h2>
        <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          FY {latestYear}
        </span>
      </div>

      {/* Year Source Banner (shown when multiple documents) */}
      {showSourceBanner && yearSourceInfo && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-4 py-2 rounded-md">
          <FileText className="h-4 w-4" />
          <span>
            Risk metrics based on <span className="font-medium">{yearSourceInfo.year}</span> data
            from <span className="font-medium">{yearSourceInfo.fileName}</span>
          </span>
        </div>
      )}

      {/* Hero Section: Risk Score + Lending Decision */}
      <HeroRiskScore
        quantitativeRisk={quantitativeRiskAssessment}
        debtHealth={debtHealthAssessment}
        latestYear={latestYear}
      />

      {/* Ratio Trends Chart */}
      {trendData.length > 0 && (
        <RatioTrendChart data={trendData} title="Ratio Trends" />
      )}

      {/* Key Metrics Grid */}
      {latestMetrics && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Key Metrics</h3>
          <MetricCardGrid
            financialData={financialData}
            latestMetrics={latestMetrics}
            quantitativeMetrics={quantitativeRiskAssessment?.metrics}
            latestYear={latestYear}
          />
        </div>
      )}

      {/* Adjusted EBITDA Section */}
      {financialData && (
        <AdjustedEBITDAPanel financialData={financialData as MainFinancialData} />
      )}

      {/* Risk Factors & Recommendations */}
      <RiskFactorsPanel
        debtHealth={debtHealthAssessment}
        riskData={riskData}
      />
    </div>
  );
};

export default CreditRiskDashboard;

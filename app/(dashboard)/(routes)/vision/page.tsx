'use client';

import { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  BarChart4,
  Shield,
  Eye,
} from 'lucide-react';

import VisionFileUpload from '@/components/VisionFileUpload';
import FinancialTable from '@/components/FinancialTable';
import DebtHealthMeters from '@/components/DebtHealthMeters';
import WeightedRiskGauge from '@/components/WeightedRiskGauge';
import RiskAssessment from '@/components/RiskAssessment';
import type { RiskData, DebtHealthAssessment } from '@/types/risk';
import FCCRBreakdown from '@/components/FCCRBreakdown';
import QuantitativeRiskCard from '@/components/QuantitativeRiskCard';
import type { QuantitativeRiskAssessment } from '@/lib/quantitative-risk';
import type { UploadCompletePayload } from '@/components/FileUpload';
import type { ExtractionResult } from '@/utils/aiProcessor';
import type { ComputedMetrics } from '@/types';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { H1 } from '@/components/ui/typography';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';

interface CustomAdjustment {
  id: string;
  amount: number;
  description: string;
}

/** Financial data structure for display components */
interface FinancialDataState {
  metrics_by_year: Record<string, ComputedMetrics>;
}

const VisionUploadPage = () => {
  const [extractedData, setExtractedData] = useState<ExtractionResult | null>(null);

  // Year-agnostic map returned from visionProcessor
  const [financialData, setFinancialData] = useState<FinancialDataState | null>(null);
  const [activeTab, setActiveTab] = useState<string>('upload');
  const [riskData, setRiskData] = useState<RiskData | null>(null);
  const [debtHealthAssessment, setDebtHealthAssessment] =
    useState<DebtHealthAssessment | null>(null);
  const [quantitativeRiskAssessment, setQuantitativeRiskAssessment] =
    useState<QuantitativeRiskAssessment | null>(null);

  // Custom adjustments state (lifted from FCCRBreakdown for cross-component sharing)
  const [customAdjustments, setCustomAdjustments] = useState<CustomAdjustment[]>([]);

  // Calculate total custom adjustments
  const totalCustomAdjustments = useMemo(
    () => customAdjustments.reduce((sum, adj) => sum + adj.amount, 0),
    [customAdjustments]
  );

  /**
   * Handle extracted data from VisionFileUpload component.
   * The SSE complete payload wraps the extraction in `financialMetrics`.
   */
  const handleDataUpdate = (payload: UploadCompletePayload) => {
    const data = payload.financialMetrics;
    setExtractedData(data);

    if (data.metrics_by_year) {
      setFinancialData({ metrics_by_year: data.metrics_by_year });
    }

    if (data.riskAssessment) {
      setRiskData(data.riskAssessment);
    }

    if (data.debtHealthAssessment) {
      setDebtHealthAssessment(data.debtHealthAssessment);
    }

    if (data.quantitativeRiskAssessment) {
      setQuantitativeRiskAssessment(data.quantitativeRiskAssessment);
    }

    if (data.metrics_by_year) {
      setActiveTab('analysis');
    } else {
      setActiveTab('upload');
    }
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
      <H1 className="text-center text-primary mb-8">
        <Eye className="inline-block mr-2 h-8 w-8" />
        Vision Extraction (PoC)
      </H1>
      {!extractedData && (
        <Alert variant="default" className="mt-6">
          <AlertTitle>Claude Vision Extraction</AlertTitle>
          <AlertDescription>
            This uses Claude Vision to extract financial data directly from PDF images.
            Upload a PDF to test the vision extraction pipeline.
          </AlertDescription>
        </Alert>
      )}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="upload">
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Vision Upload
          </TabsTrigger>
          <TabsTrigger value="analysis" disabled={!financialData}>
            <BarChart4 className="mr-2 h-4 w-4" /> Financial Analysis
          </TabsTrigger>
          <TabsTrigger value="credit" disabled={!financialData}>
            <Shield className="mr-2 h-4 w-4" />
            Risk Assessment
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" key="upload">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Upload PDF for Vision Extraction</CardTitle>
            </CardHeader>
            <CardContent>
              <ErrorBoundary errorTitle="Upload Error">
                <VisionFileUpload onDataExtracted={handleDataUpdate} />
              </ErrorBoundary>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" key="analysis">
          {financialData && (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Financial Summary (Vision Extracted)</CardTitle>
              </CardHeader>
              <CardContent>
                <ErrorBoundary errorTitle="Error displaying financial data">
                  <FinancialTable data={financialData} />
                </ErrorBoundary>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="credit" key="credit">
          {riskData || financialData ? (
            <div className="space-y-6">
              {/* Weighted Risk Gauge - Primary Risk Assessment */}
              {financialData && (
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle>Debt Health Risk Assessment</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-8">
                      {/* Quantitative Risk Scorecard */}
                      <ErrorBoundary errorTitle="Error loading risk scorecard">
                        <QuantitativeRiskCard data={quantitativeRiskAssessment} />
                      </ErrorBoundary>

                      {/* Divider */}
                      {quantitativeRiskAssessment && (
                        <hr className="border-border" />
                      )}

                      {/* Existing Weighted Risk Gauge */}
                      <ErrorBoundary errorTitle="Error loading risk gauge">
                        <WeightedRiskGauge
                          data={financialData}
                          debtHealthAssessment={debtHealthAssessment}
                          customFccrAdjustment={totalCustomAdjustments}
                        />
                      </ErrorBoundary>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Credit Risk Assessment */}
              {riskData && (
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle>Credit-Risk Assessment</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ErrorBoundary errorTitle="Error loading credit risk assessment">
                      <RiskAssessment data={riskData} />
                    </ErrorBoundary>
                  </CardContent>
                </Card>
              )}

              {/* Debt Health Indicators with Gauges and Breakdowns */}
              {financialData && (
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle>Debt Health Indicators</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ErrorBoundary errorTitle="Error loading debt health indicators">
                      <DebtHealthMeters data={financialData} />
                    </ErrorBoundary>
                  </CardContent>
                </Card>
              )}

              {/* FCCR/DSCR Ratio Breakdowns */}
              {financialData && (
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle>Ratio Breakdowns</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ErrorBoundary errorTitle="Error loading ratio breakdowns">
                      <FCCRBreakdown
                        data={financialData}
                        customAdjustments={customAdjustments}
                        onCustomAdjustmentsChange={setCustomAdjustments}
                      />
                    </ErrorBoundary>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">
              No risk assessment available.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VisionUploadPage;

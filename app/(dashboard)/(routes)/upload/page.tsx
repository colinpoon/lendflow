'use client';

import { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  BarChart4,
  Shield,
  AlertTriangle,
  X,
} from 'lucide-react';

import FileUpload from '@/components/FileUpload';
import FinancialTable from '@/components/FinancialTable';
import DebtHealthMeters from '@/components/DebtHealthMeters';
import WeightedRiskGauge from '@/components/WeightedRiskGauge';
import RiskAssessment, {
  RiskData,
} from '@/components/RiskAssessment';
import AdjustedEBITDA from '@/components/AdjustedEBITDA';
import FCCRBreakdown from '@/components/FCCRBreakdown';
import QuantitativeRiskCard from '@/components/QuantitativeRiskCard';
import type { QuantitativeRiskAssessment } from '@/lib/quantitative-risk';
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

interface DebtHealthAssessment {
  weighted_score: number;
  risk_band: string;
  lending_decision: string;
  key_risk_factors: string[];
  positive_factors: string[];
  recommendations: string[];
  suggested_loan_structure: string;
}

interface CustomAdjustment {
  id: string;
  amount: number;
  description: string;
}

/** Financial data structure for display components */
interface FinancialDataState {
  metrics_by_year: Record<string, ComputedMetrics>;
}

const Home = () => {
  const [extractedData, setExtractedData] = useState<ExtractionResult | null>(null);

  // Year-agnostic map returned from aiProcessor
  const [financialData, setFinancialData] = useState<FinancialDataState | null>(null);
  const [activeTab, setActiveTab] = useState<string>('upload');
  const [riskData, setRiskData] = useState<RiskData | null>(null);
  const [debtHealthAssessment, setDebtHealthAssessment] =
    useState<DebtHealthAssessment | null>(null);
  const [quantitativeRiskAssessment, setQuantitativeRiskAssessment] =
    useState<QuantitativeRiskAssessment | null>(null);
  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  const [validationAlertDismissed, setValidationAlertDismissed] = useState(false);

  // Custom adjustments state (lifted from FCCRBreakdown for cross-component sharing)
  const [customAdjustments, setCustomAdjustments] = useState<CustomAdjustment[]>([]);

  // Calculate total custom adjustments
  const totalCustomAdjustments = useMemo(
    () => customAdjustments.reduce((sum, adj) => sum + adj.amount, 0),
    [customAdjustments]
  );

  /**
   * Handle extracted data from FileUpload component
   * Normalizes various response formats and updates state
   */
  const handleDataUpdate = (data: ExtractionResult & {
    financialMetrics?: FinancialDataState & {
      riskAssessment?: RiskData;
      debtHealthAssessment?: DebtHealthAssessment;
      quantitativeRiskAssessment?: QuantitativeRiskAssessment;
    };
  }) => {
    setExtractedData(data);
    setValidationAlertDismissed(false);

    // Collect validation issues from the extraction result (Record<string, string[]> shape)
    const rawIssues =
      (data as { validation_issues?: Record<string, string[]> }).validation_issues ??
      (data.financialMetrics as { validation_issues?: Record<string, string[]> } | undefined)?.validation_issues ??
      {};
    setValidationIssues(Object.values(rawIssues).flat());

    // Accept either data.financialMetrics or a root-level metrics_by_year
    if (data.financialMetrics) {
      setFinancialData(data.financialMetrics);
    } else if (data.metrics_by_year) {
      setFinancialData({ metrics_by_year: data.metrics_by_year });
    }

    // Risk assessment may appear at root, inside financialMetrics, or alongside metrics_by_year
    const nestedRisk =
      data.riskAssessment ??
      data.financialMetrics?.riskAssessment ??
      null;
    if (nestedRisk) {
      setRiskData(nestedRisk);
    }

    // Debt health assessment from AI
    const nestedDebtHealth =
      data.debtHealthAssessment ??
      data.financialMetrics?.debtHealthAssessment ??
      null;
    if (nestedDebtHealth) {
      setDebtHealthAssessment(nestedDebtHealth);
    }

    // Quantitative risk assessment
    const nestedQuantRisk =
      data.quantitativeRiskAssessment ??
      data.financialMetrics?.quantitativeRiskAssessment ??
      null;
    if (nestedQuantRisk) {
      setQuantitativeRiskAssessment(nestedQuantRisk);
    }

    // Navigate to analysis tab after successful extraction
    if (data.metrics_by_year || data.financialMetrics) {
      setActiveTab('analysis');
    } else {
      setActiveTab('upload');
    }
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
      <H1 className="text-center text-primary mb-8">
        Bank Loan Risk Analysis
      </H1>
      {!extractedData && (
        <Alert variant="default" className="mt-6">
          <AlertTitle>Get Started</AlertTitle>
          <AlertDescription>
            Upload a financial document to begin your bank loan risk
            analysis.
          </AlertDescription>
        </Alert>
      )}

      {validationIssues.length > 0 && !validationAlertDismissed && (
        <Alert variant="destructive" className="mt-4 relative pr-10">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Data Validation Warnings</AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              The following issues were detected during extraction. Review
              the figures below carefully before making a lending decision.
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {validationIssues.map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
          </AlertDescription>
          <button
            onClick={() => setValidationAlertDismissed(true)}
            aria-label="Dismiss validation warnings"
            className="absolute top-3 right-3 rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-1"
          >
            <X className="h-4 w-4" />
          </button>
        </Alert>
      )}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="upload">
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Upload Documents
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
              <CardTitle>Upload Financial Document</CardTitle>
            </CardHeader>
            <CardContent>
              <ErrorBoundary errorTitle="Upload Error">
                <FileUpload onDataExtracted={handleDataUpdate} />
              </ErrorBoundary>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" key="analysis">
          {financialData && (
            <div className="space-y-6">
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>Adjusted EBITDA</CardTitle>
                </CardHeader>
                <CardContent>
                  <ErrorBoundary errorTitle="Error displaying EBITDA data">
                    <AdjustedEBITDA data={financialData} />
                  </ErrorBoundary>
                </CardContent>
              </Card>

              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>Financial Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <ErrorBoundary errorTitle="Error displaying financial data">
                    <FinancialTable data={financialData} />
                  </ErrorBoundary>
                </CardContent>
              </Card>
            </div>
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

export default Home;

'use client';

import { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  BarChart4,
  Shield,
} from 'lucide-react';

import FileUpload from '@/components/FileUpload';
import FinancialTable from '@/components/FinancialTable';
import DebtHealthMeters from '@/components/DebtHealthMeters';
import WeightedRiskGauge from '@/components/WeightedRiskGauge';
import RiskAssessment, {
  RiskData,
} from '@/components/RiskAssessment';
import FCCRBreakdown from '@/components/FCCRBreakdown';
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

const Home = () => {
  const [extractedData, setExtractedData] = useState<any>(null);

  // year‑agnostic map returned from aiProcessor:
  const [financialData, setFinancialData] = useState<{
    metrics_by_year: Record<string, any>;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<string>('upload');
  const [riskData, setRiskData] = useState<RiskData | null>(null);
  const [debtHealthAssessment, setDebtHealthAssessment] =
    useState<DebtHealthAssessment | null>(null);

  // Custom adjustments state (lifted from FCCRBreakdown for cross-component sharing)
  const [customAdjustments, setCustomAdjustments] = useState<CustomAdjustment[]>([]);

  // Calculate total custom adjustments
  const totalCustomAdjustments = useMemo(
    () => customAdjustments.reduce((sum, adj) => sum + adj.amount, 0),
    [customAdjustments]
  );

  const handleDataUpdate = (data: any) => {
    console.log('🐞 page.tsx received payload:', data);

    setExtractedData(data);

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
      data.metrics_by_year?.riskAssessment ??
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

    // decide default tab - go to analysis after successful extraction
    if (data.metrics_by_year || data.financialMetrics) {
      setActiveTab('analysis');
    } else {
      setActiveTab('upload');
    }
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
      <h1 className="text-3xl font-extrabold text-center text-primary mb-8">
        Bank Loan Risk Analysis
      </h1>
      {!extractedData && (
        <Alert variant="default" className="mt-6">
          <AlertTitle>Get Started</AlertTitle>
          <AlertDescription>
            Upload a financial document to begin your bank loan risk
            analysis.
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
            <FileSpreadsheet className="mr-2 h-4 w-4" /> File Upload
          </TabsTrigger>
          <TabsTrigger value="analysis" disabled={!financialData}>
            <BarChart4 className="mr-2 h-4 w-4" /> Financial Analysis
          </TabsTrigger>
          <TabsTrigger value="credit" disabled={!financialData}>
            <Shield className="mr-2 h-4 w-4" />
            Credit‑Risk Snapshot
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" key="upload">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Upload Financial Document</CardTitle>
            </CardHeader>
            <CardContent>
              <FileUpload onDataExtracted={handleDataUpdate} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" key="analysis">
          {financialData && (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Financial Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <FinancialTable data={financialData} />
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
                    <WeightedRiskGauge
                      data={financialData}
                      debtHealthAssessment={debtHealthAssessment}
                      customFccrAdjustment={totalCustomAdjustments}
                    />
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
                    <RiskAssessment data={riskData} />
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
                    <DebtHealthMeters data={financialData} />
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
                    <FCCRBreakdown
                      data={financialData}
                      customAdjustments={customAdjustments}
                      onCustomAdjustmentsChange={setCustomAdjustments}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <p className="text-gray-500">
              No risk assessment available.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Home;

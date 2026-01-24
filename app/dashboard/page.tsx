'use client';

import { useState } from 'react';
import {
  FileSpreadsheet,
  BarChart4,
  Shield,
} from 'lucide-react';

import FileUpload from '@/components/FileUpload';
import FinancialTable from '@/components/FinancialTable';
import DebtHealthMeters from '@/components/DebtHealthMeters';
import WeightedRiskGauge from '@/components/WeightedRiskGauge';
import { RiskData } from '@/components/RiskAssessment';
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

export default function DashboardPage() {
  const [extractedData, setExtractedData] = useState<any>(null);
  const [financialData, setFinancialData] = useState<{
    metrics_by_year: Record<string, any>;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<string>('upload');
  const [riskData, setRiskData] = useState<RiskData | null>(null);
  const [debtHealthAssessment, setDebtHealthAssessment] =
    useState<DebtHealthAssessment | null>(null);

  const handleDataUpdate = (data: any) => {
    console.log('Dashboard received payload:', data);

    setExtractedData(data);

    if (data.financialMetrics) {
      setFinancialData(data.financialMetrics);
    } else if (data.metrics_by_year) {
      setFinancialData({ metrics_by_year: data.metrics_by_year });
    }

    const nestedRisk =
      data.riskAssessment ??
      data.financialMetrics?.riskAssessment ??
      data.metrics_by_year?.riskAssessment ??
      null;
    if (nestedRisk) {
      setRiskData(nestedRisk);
    }

    const nestedDebtHealth =
      data.debtHealthAssessment ??
      data.financialMetrics?.debtHealthAssessment ??
      null;
    if (nestedDebtHealth) {
      setDebtHealthAssessment(nestedDebtHealth);
    }

    if (data.metrics_by_year || data.financialMetrics) {
      setActiveTab('analysis');
    } else {
      setActiveTab('upload');
    }
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
      {!extractedData && (
        <Alert variant="default">
          <AlertTitle>Get Started</AlertTitle>
          <AlertDescription>
            Upload a financial document to begin your bank loan risk analysis.
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
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Upload
          </TabsTrigger>
          <TabsTrigger value="analysis" disabled={!financialData}>
            <BarChart4 className="mr-2 h-4 w-4" /> Analysis
          </TabsTrigger>
          <TabsTrigger value="credit" disabled={!financialData}>
            <Shield className="mr-2 h-4 w-4" /> Risk
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>Upload Financial Document</CardTitle>
            </CardHeader>
            <CardContent>
              <FileUpload onDataExtracted={handleDataUpdate} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis">
          {financialData && (
            <Card>
              <CardHeader>
                <CardTitle>Financial Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <FinancialTable data={financialData} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="credit">
          {(riskData || financialData) ? (
            <div className="space-y-6">
              {financialData && (
                <Card>
                  <CardHeader>
                    <CardTitle>Risk Assessment</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <WeightedRiskGauge
                      data={financialData}
                      debtHealthAssessment={debtHealthAssessment}
                      riskData={riskData}
                    />
                  </CardContent>
                </Card>
              )}

              {financialData && (
                <Card>
                  <CardHeader>
                    <CardTitle>Debt Health Indicators</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DebtHealthMeters data={financialData} />
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
}

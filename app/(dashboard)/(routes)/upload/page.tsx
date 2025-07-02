'use client';

import { useState } from 'react';
import {
  FileSpreadsheet,
  ArrowDownToLine,
  BarChart4,
  Shield,
} from 'lucide-react';

import FileUpload from '@/components/FileUpload';
import ExtractedData from '@/components/ExtractedData';
import FinancialTable from '@/components/FinancialTable';
import EBITDA from '@/components/EBITDA';
import RiskAssessment, {
  RiskData,
} from '@/components/RiskAssessment';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

const Home = () => {
  const [extractedData, setExtractedData] = useState<any>(null);

  // year‑agnostic map returned from aiProcessor:
  const [financialData, setFinancialData] = useState<{
    metrics_by_year: Record<string, any>;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<string>('upload');
  const [riskData, setRiskData] = useState<RiskData | null>(null);

  const handleDataUpdate = (data: any) => {
    console.log('🐞 page.tsx received payload:', data);

    setExtractedData(data);

    // Accept either data.financialMetrics or a root-level metrics_by_year
    if (data.financialMetrics) {
      setFinancialData(data.financialMetrics);
    } else if (data.metrics_by_year) {
      setFinancialData({ metrics_by_year: data.metrics_by_year });
    }

    if (data.riskAssessment) {
      setRiskData(data.riskAssessment);
    }

    // decide default tab
    if (
      data.riskAssessment &&
      !data.financialMetrics &&
      !data.metrics_by_year
    ) {
      setActiveTab('credit');
    } else if (data.financialMetrics || data.metrics_by_year) {
      setActiveTab('analysis');
    } else if (data.extracted) {
      setActiveTab('extracted');
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
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="upload">
            <FileSpreadsheet className="mr-2 h-4 w-4" /> File Upload
          </TabsTrigger>
          <TabsTrigger value="extracted" disabled={!extractedData}>
            <ArrowDownToLine className="mr-2 h-4 w-4" /> Extracted
            Data
          </TabsTrigger>
          <TabsTrigger value="analysis" disabled={!financialData}>
            <BarChart4 className="mr-2 h-4 w-4" /> Financial Analysis
          </TabsTrigger>
          <TabsTrigger value="credit" disabled={!riskData}>
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

        <TabsContent value="extracted" key="extracted">
          {extractedData && (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Extracted Document Data</CardTitle>
              </CardHeader>
              <CardContent>
                <ExtractedData data={extractedData} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analysis" key="analysis">
          {financialData && (
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>Financial Table</CardTitle>
                </CardHeader>
                <CardContent>
                  <FinancialTable data={financialData} />
                </CardContent>
              </Card>

              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>EBITDA Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <EBITDA data={financialData} />
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="credit" key="credit">
          {riskData ? (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Credit‑Risk Snapshot</CardTitle>
              </CardHeader>
              <CardContent>
                <RiskAssessment data={riskData} />
              </CardContent>
            </Card>
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

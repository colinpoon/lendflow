'use client';

import { useState } from 'react';
import {
  FileSpreadsheet,
  ArrowDownToLine,
  BarChart4,
} from 'lucide-react';

import FileUpload from '@/components/FileUpload';
import ExtractedData from '@/components/ExtractedData';
import FinancialTable from '@/components/FinancialTable';
import EBITDA from '@/components/EBITDA';
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
  const [financialData, setFinancialData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUploadStart = () => {
    setLoading(true);
    setError(null);
  };

  const handleDataUpdate = (data: any) => {
    setLoading(false);
    if (data?.financialMetrics) {
      setExtractedData(data);
      setFinancialData(data.financialMetrics);
      setActiveTab('extracted');
    } else {
      setError('Error extracting data. Please try again.');
    }
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
      <h1 className="text-3xl font-extrabold text-center text-primary mb-8">
        Lendflow
      </h1>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="upload">
            <FileSpreadsheet className="mr-2 h-4 w-4" /> File Upload
          </TabsTrigger>
          <TabsTrigger
            value="extracted"
            disabled={!extractedData || loading}
          >
            <ArrowDownToLine className="mr-2 h-4 w-4" /> Extracted
            Data
          </TabsTrigger>
          <TabsTrigger
            value="analysis"
            disabled={!financialData || loading}
          >
            <BarChart4 className="mr-2 h-4 w-4" /> Financial Analysis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" key="upload">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Upload Financial Document</CardTitle>
            </CardHeader>
            <CardContent>
              <FileUpload
                onDataExtracted={handleDataUpdate}
                onUploadStart={handleUploadStart}
              />
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
      </Tabs>

      {loading && (
        <p className="text-blue-500 text-center mt-4">
          Processing file...
        </p>
      )}
      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {!extractedData && !loading && (
        <Alert variant="default" className="mt-6">
          <AlertTitle>Get Started</AlertTitle>
          <AlertDescription>
            Upload a financial document to begin your bank loan risk
            analysis.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default Home;

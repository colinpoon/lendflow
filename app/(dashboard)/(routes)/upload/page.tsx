'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
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
import { TechnicalLabel } from '@/components/TechnicalLabel';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { fadeInUp, staggerContainer, staggerItem } from '@/lib/animations';

interface DebtHealthAssessment {
  weighted_score: number;
  risk_band: string;
  lending_decision: string;
  key_risk_factors: string[];
  positive_factors: string[];
  recommendations: string[];
  suggested_loan_structure: string;
}

const Home = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [extractedData, setExtractedData] = useState<any>(null);

  // year-agnostic map returned from aiProcessor:
  const [financialData, setFinancialData] = useState<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metrics_by_year: Record<string, any>;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<string>('upload');
  const [riskData, setRiskData] = useState<RiskData | null>(null);
  const [debtHealthAssessment, setDebtHealthAssessment] =
    useState<DebtHealthAssessment | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDataUpdate = (data: any) => {
    console.log('page.tsx received payload:', data);

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
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="container mx-auto max-w-6xl px-4 py-8 space-y-8"
    >
      <motion.div variants={fadeInUp} className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-widest uppercase font-display text-primary">
          Bank Loan Risk Analysis
        </h1>
        <p className="text-xs tracking-wider text-muted-foreground uppercase">
          AI-Powered Financial Document Processing
        </p>
      </motion.div>

      {!extractedData && (
        <motion.div
          variants={fadeInUp}
          className="hud-panel p-4"
        >
          <div className="flex items-center gap-3">
            <span className="text-primary">[!]</span>
            <div>
              <p className="text-xs font-medium tracking-wide uppercase">System Ready</p>
              <p className="text-xs text-muted-foreground">
                Upload a financial document to begin risk analysis
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <motion.div variants={fadeInUp}>
          <TabsList className="w-full justify-start mb-6">
            <TabsTrigger value="upload">
              <FileSpreadsheet className="h-4 w-4" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="analysis" disabled={!financialData}>
              <BarChart4 className="h-4 w-4" />
              Financial Analysis
            </TabsTrigger>
            <TabsTrigger value="credit" disabled={!financialData}>
              <Shield className="h-4 w-4" />
              Credit-Risk
            </TabsTrigger>
          </TabsList>
        </motion.div>

        <TabsContent value="upload" key="upload">
          <motion.div variants={staggerItem}>
            <Card>
              <CardHeader className="border-b border-border">
                <TechnicalLabel prefix="arrow">Upload Interface</TechnicalLabel>
              </CardHeader>
              <CardContent className="pt-6">
                <FileUpload onDataExtracted={handleDataUpdate} />
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="analysis" key="analysis">
          {financialData && (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
            >
              <motion.div variants={staggerItem}>
                <Card>
                  <CardHeader className="border-b border-border">
                    <TechnicalLabel prefix="data">Financial Summary</TechnicalLabel>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <FinancialTable data={financialData} />
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          )}
        </TabsContent>

        <TabsContent value="credit" key="credit">
          {riskData || financialData ? (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
              className="space-y-6"
            >
              {/* Weighted Risk Gauge - Primary Risk Assessment */}
              {financialData && (
                <motion.div variants={staggerItem}>
                  <Card>
                    <CardHeader className="border-b border-border">
                      <TechnicalLabel prefix="alert">Debt Health Risk Assessment</TechnicalLabel>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <WeightedRiskGauge
                        data={financialData}
                        debtHealthAssessment={debtHealthAssessment}
                      />
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Credit Risk Assessment */}
              {riskData && (
                <motion.div variants={staggerItem}>
                  <Card>
                    <CardHeader className="border-b border-border">
                      <TechnicalLabel prefix="system">Credit-Risk Assessment</TechnicalLabel>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <RiskAssessment data={riskData} />
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Debt Health Indicators with Gauges and Breakdowns */}
              {financialData && (
                <motion.div variants={staggerItem}>
                  <Card>
                    <CardHeader className="border-b border-border">
                      <TechnicalLabel prefix="data">Debt Health Indicators</TechnicalLabel>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <DebtHealthMeters data={financialData} />
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <div className="hud-panel p-6 text-center">
              <p className="text-xs text-muted-foreground tracking-wider uppercase">
                No risk assessment data available
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default Home;

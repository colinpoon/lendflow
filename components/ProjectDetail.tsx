'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  FileSpreadsheet,
  BarChart4,
  Shield,
  ChevronRight,
  Home,
  FolderOpen,
  Upload,
  FileText,
  Info,
  Pencil,
  Check,
  X,
  Trash2,
  Loader2,
} from 'lucide-react';

import FileUpload from '@/components/FileUpload';
import FinancialTable from '@/components/FinancialTable';
import ExtractionWarnings from '@/components/ExtractionWarnings';
import { RiskData } from '@/components/RiskAssessment';
import { CreditRiskDashboard } from '@/components/credit-risk';
import type { QuantitativeRiskAssessment } from '@/lib/quantitative-risk';
import type { YearMetrics } from '@/types';
import { Project } from '@/lib/supabase/types';
import { MergedExtraction } from '@/lib/extraction-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

interface DebtHealthAssessment {
  weighted_score: number;
  risk_band: string;
  lending_decision: string;
  key_risk_factors: string[];
  positive_factors: string[];
  recommendations: string[];
  suggested_loan_structure: string;
}

interface DocumentCoverage {
  document_id: string;
  file_name: string;
  years: string[];
  uploaded_at: string;
}

interface ProjectDetailProps {
  project: Project;
  mergedData: MergedExtraction | null;
  documentCoverage: DocumentCoverage[];
  extractionCount: number;
}

export default function ProjectDetail({
  project,
  mergedData,
  documentCoverage,
  extractionCount,
}: ProjectDetailProps) {
  const [financialData, setFinancialData] = useState<{
    metrics_by_year: Record<string, YearMetrics>;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<string>('upload');
  const [riskData, setRiskData] = useState<RiskData | null>(null);
  const [debtHealthAssessment, setDebtHealthAssessment] =
    useState<DebtHealthAssessment | null>(null);
  const [quantitativeRiskAssessment, setQuantitativeRiskAssessment] =
    useState<QuantitativeRiskAssessment | null>(null);
  const [yearSources, setYearSources] = useState<MergedExtraction['year_sources']>({});
  const [mostRecentYear, setMostRecentYear] = useState<string | undefined>();
  const [mostRecentYearSource, setMostRecentYearSource] = useState<MergedExtraction['most_recent_year_source']>();
  const [validationIssues, setValidationIssues] = useState<Record<string, string[]> | undefined>();
  const [extractionWarnings, setExtractionWarnings] = useState<string[] | undefined>();
  const [chunkStats, setChunkStats] = useState<{ total: number; successful: number; failed: number } | undefined>();

  // Project name editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [projectName, setProjectName] = useState(project.name);
  const [isSaving, setIsSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Document deletion
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleSaveName = async () => {
    if (!projectName.trim() || projectName === project.name) {
      setProjectName(project.name);
      setIsEditingName(false);
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName.trim() }),
      });

      if (response.ok) {
        setIsEditingName(false);
        // Update the page to reflect the new name
        window.location.reload();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update project name');
        setProjectName(project.name);
      }
    } catch (error) {
      console.error('Error updating project name:', error);
      alert('Failed to update project name');
      setProjectName(project.name);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setProjectName(project.name);
    setIsEditingName(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleDeleteDocument = async (documentId: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"? This will remove its data from the analysis.`)) {
      return;
    }

    setDeletingDocId(documentId);
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Reload to get updated merged data
        window.location.reload();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete document');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document');
    } finally {
      setDeletingDocId(null);
    }
  };

  // Load merged data on mount
  useEffect(() => {
    if (mergedData) {
      if (mergedData.metrics_by_year && Object.keys(mergedData.metrics_by_year).length > 0) {
        setFinancialData({ metrics_by_year: mergedData.metrics_by_year });
      }

      if (mergedData.riskAssessment) {
        setRiskData(mergedData.riskAssessment);
      }

      if (mergedData.debtHealthAssessment) {
        setDebtHealthAssessment(mergedData.debtHealthAssessment);
      }

      if (mergedData.quantitativeRiskAssessment) {
        setQuantitativeRiskAssessment(mergedData.quantitativeRiskAssessment);
      }

      if (mergedData.year_sources) {
        setYearSources(mergedData.year_sources);
      }

      if (mergedData.most_recent_year) {
        setMostRecentYear(mergedData.most_recent_year);
      }

      if (mergedData.most_recent_year_source) {
        setMostRecentYearSource(mergedData.most_recent_year_source);
      }

      if (mergedData.validation_issues) {
        setValidationIssues(mergedData.validation_issues);
      }

      if (mergedData.extraction_warnings) {
        setExtractionWarnings(mergedData.extraction_warnings);
      }

      if (mergedData.chunk_stats) {
        setChunkStats(mergedData.chunk_stats);
      }

      setActiveTab('analysis');
    }
  }, [mergedData]);

  const handleDataUpdate = (data: unknown) => {
    console.log('Project received payload:', data);

    // After new upload, refresh the page to get merged data
    window.location.reload();
  };

  const hasData = financialData !== null;
  const years = financialData ? Object.keys(financialData.metrics_by_year).sort() : [];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/" className="flex items-center gap-1">
                <Home className="h-3.5 w-3.5" />
                Home
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="h-3.5 w-3.5" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard" className="flex items-center gap-1">
                <FolderOpen className="h-3.5 w-3.5" />
                Projects
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="h-3.5 w-3.5" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>{project.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Project Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
          <FolderOpen className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <Input
                ref={nameInputRef}
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onKeyDown={handleKeyDown}
                className="text-2xl font-bold h-10 max-w-md"
                disabled={isSaving}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={handleSaveName}
                disabled={isSaving}
                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="h-8 w-8 text-gray-500 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              <Button
                size="icon"
                variant="outline"
                onClick={() => setIsEditingName(true)}
                className="h-7 w-7"
                title="Edit project name"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <p className="text-gray-500 text-sm">
            {project.company_name || project.description || 'Financial Analysis Project'}
          </p>
        </div>
      </div>

      {/* Document Coverage Info */}
      {extractionCount > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-blue-900">
                  {extractionCount} document{extractionCount > 1 ? 's' : ''} analyzed
                  {years.length > 0 && ` • Years: ${years.join(', ')}`}
                </p>
                {extractionCount > 1 && (
                  <p className="text-xs text-blue-700">
                    Data merged from multiple documents. For overlapping years, the most recent document takes priority.
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  {documentCoverage.map((doc) => (
                    <div
                      key={doc.document_id}
                      className="text-xs bg-white px-2 py-1 rounded border border-blue-200 flex items-center gap-1.5 group"
                    >
                      <FileText className="h-3 w-3" />
                      <span className="font-medium">{doc.file_name}</span>
                      <span className="text-blue-600">({doc.years.join(', ')})</span>
                      <button
                        onClick={() => handleDeleteDocument(doc.document_id, doc.file_name)}
                        disabled={deletingDocId === doc.document_id}
                        className="ml-1 p-0.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                        title="Remove document"
                      >
                        {deletingDocId === doc.document_id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Extraction Warnings */}
      {hasData && (
        <ExtractionWarnings
          validationIssues={validationIssues}
          extractionWarnings={extractionWarnings}
          chunkStats={chunkStats}
        />
      )}

      {!hasData && (
        <Alert variant="default">
          <Upload className="h-4 w-4" />
          <AlertTitle>Get Started</AlertTitle>
          <AlertDescription>
            Upload a financial document to begin your bank loan risk analysis.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="upload">
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Upload
          </TabsTrigger>
          <TabsTrigger value="analysis" disabled={!hasData}>
            <BarChart4 className="mr-2 h-4 w-4" /> Analysis
          </TabsTrigger>
          <TabsTrigger value="credit" disabled={!hasData}>
            <Shield className="mr-2 h-4 w-4" /> Risk
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>Upload Financial Document</CardTitle>
              <CardDescription>
                Upload additional documents to expand year coverage. For overlapping years, the newest document will take priority.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUpload
                onDataExtracted={handleDataUpdate}
                projectId={project.id}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis">
          {financialData && (
            <div className="space-y-4">
              {/* Year source indicators */}
              {Object.keys(yearSources).length > 1 && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {years.map((year) => (
                    <div
                      key={year}
                      className="bg-gray-100 px-2 py-1 rounded flex items-center gap-1"
                    >
                      <span className="font-medium">{year}</span>
                      <span className="text-gray-500">
                        from {yearSources[year]?.file_name || 'Unknown'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <Card>
                <CardHeader>
                  <CardTitle>Financial Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <FinancialTable data={financialData} />
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="credit">
          {(riskData || financialData) ? (
            <CreditRiskDashboard
              financialData={financialData}
              quantitativeRiskAssessment={quantitativeRiskAssessment}
              debtHealthAssessment={debtHealthAssessment}
              riskData={riskData}
              yearSourceInfo={mostRecentYear && mostRecentYearSource ? {
                year: mostRecentYear,
                fileName: mostRecentYearSource.file_name,
              } : undefined}
              showSourceBanner={extractionCount > 1}
            />
          ) : (
            <p className="text-muted-foreground">No risk assessment available.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

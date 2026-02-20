'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
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
import DebtHealthMeters from '@/components/DebtHealthMeters';
import WeightedRiskGauge from '@/components/WeightedRiskGauge';
import AdjustedEBITDA from '@/components/AdjustedEBITDA';
import QuantitativeRiskCard from '@/components/QuantitativeRiskCard';
import ExtractionWarnings from '@/components/ExtractionWarnings';
import { RiskData } from '@/components/RiskAssessment';
import type { QuantitativeRiskAssessment } from '@/lib/quantitative-risk';
import type { ComputedMetrics } from '@/types';
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
import { Badge } from '@/components/ui/badge';
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

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Section nav config
// ─────────────────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'upload', label: 'Upload' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'risk', label: 'Risk' },
  { id: 'decision', label: 'Decision' },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Hero Metric helpers
// ─────────────────────────────────────────────────────────────────────────────

function getRiskBand(score: number): { label: string; color: string } {
  if (score <= 30) return { label: 'Low Risk', color: 'text-success' };
  if (score <= 50) return { label: 'Moderate', color: 'text-warning' };
  if (score <= 70) return { label: 'Elevated', color: 'text-warning' };
  return { label: 'High Risk', color: 'text-error' };
}

function getRatioStatus(value: number | null, thresholds: { good: number; fair: number; direction: 'above' | 'below' }): string {
  if (value === null) return 'text-muted-foreground';
  if (thresholds.direction === 'above') {
    if (value >= thresholds.good) return 'text-success';
    if (value >= thresholds.fair) return 'text-warning';
    return 'text-error';
  }
  if (value <= thresholds.good) return 'text-success';
  if (value <= thresholds.fair) return 'text-warning';
  return 'text-error';
}

function formatRatio(value: number | null, suffix = 'x'): string {
  if (value === null || isNaN(value) || !isFinite(value)) return '--';
  return `${value.toFixed(2)}${suffix}`;
}

function formatPercent(value: number | null): string {
  if (value === null || isNaN(value) || !isFinite(value)) return '--';
  return `${(value * 100).toFixed(1)}%`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero Metric Card
// ─────────────────────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  subtitle,
  colorClass,
}: {
  label: string;
  value: string;
  subtitle?: string;
  colorClass?: string;
}) {
  return (
    <div className="border border-border rounded-lg p-4 space-y-1">
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
        {label}
      </p>
      <p className={`text-2xl font-bold tabular-nums ${colorClass || 'text-foreground'}`}>
        {value}
      </p>
      {subtitle && (
        <p className={`text-xs ${colorClass || 'text-muted-foreground'}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ProjectDetail({
  project,
  mergedData,
  documentCoverage,
  extractionCount,
}: ProjectDetailProps) {
  const [financialData, setFinancialData] = useState<{
    metrics_by_year: Record<string, ComputedMetrics>;
  } | null>(null);
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

  // Scrollspy
  const [activeSection, setActiveSection] = useState<string>('upload');
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Project name editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [projectName, setProjectName] = useState(project.name);
  const [isSaving, setIsSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Document deletion
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Scrollspy via IntersectionObserver
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
    );

    for (const section of SECTIONS) {
      const el = sectionRefs.current[section.id];
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [financialData]);

  const scrollToSection = useCallback((sectionId: string) => {
    const el = sectionRefs.current[sectionId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const setSectionRef = useCallback((id: string) => (el: HTMLElement | null) => {
    sectionRefs.current[id] = el;
  }, []);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  // ─────────────────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────────────────

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

  // ─────────────────────────────────────────────────────────────────────────
  // Load merged data
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (mergedData) {
      if (mergedData.metrics_by_year && Object.keys(mergedData.metrics_by_year).length > 0) {
        setFinancialData({ metrics_by_year: mergedData.metrics_by_year });
      }

      if (mergedData.riskAssessment) setRiskData(mergedData.riskAssessment);
      if (mergedData.debtHealthAssessment) setDebtHealthAssessment(mergedData.debtHealthAssessment);
      if (mergedData.quantitativeRiskAssessment) setQuantitativeRiskAssessment(mergedData.quantitativeRiskAssessment);
      if (mergedData.year_sources) setYearSources(mergedData.year_sources);
      if (mergedData.most_recent_year) setMostRecentYear(mergedData.most_recent_year);
      if (mergedData.most_recent_year_source) setMostRecentYearSource(mergedData.most_recent_year_source);
      if (mergedData.validation_issues) setValidationIssues(mergedData.validation_issues);
      if (mergedData.extraction_warnings) setExtractionWarnings(mergedData.extraction_warnings);
      if (mergedData.chunk_stats) setChunkStats(mergedData.chunk_stats);
    }
  }, [mergedData]);

  const handleDataUpdate = () => {
    window.location.reload();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Derived state
  // ─────────────────────────────────────────────────────────────────────────

  const hasData = financialData !== null;
  const years = financialData ? Object.keys(financialData.metrics_by_year).sort() : [];
  const latestYear = mostRecentYear || years[years.length - 1];
  const latestMetrics = financialData && latestYear ? financialData.metrics_by_year[latestYear] : null;

  // Hero metric values
  const riskScore = debtHealthAssessment?.weighted_score ?? null;
  const fccr = latestMetrics?.fccr ?? null;
  const seniorDebtToEbitda = latestMetrics?.senior_debt_to_ebitda ?? null;
  const totalDebtToCapital = latestMetrics?.total_debt_to_capital ?? null;

  return (
    <article className="container mx-auto max-w-5xl px-6 py-6 space-y-6 text-sm">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb">
        <Breadcrumb>
          <BreadcrumbList className="text-xs">
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/" className="flex items-center gap-1">
                  <Home className="h-3 w-3" />
                  Home
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="h-3 w-3" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/dashboard" className="flex items-center gap-1">
                  <FolderOpen className="h-3 w-3" />
                  Projects
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="h-3 w-3" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage>{project.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </nav>

      {/* Project Header */}
      <header className="flex items-center gap-3">
        <div className="flex-1">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <Input
                ref={nameInputRef}
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onKeyDown={handleKeyDown}
                className="text-2xl font-bold tracking-tight h-9 max-w-md"
                disabled={isSaving}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={handleSaveName}
                disabled={isSaving}
                className="h-7 w-7 text-success hover:text-success hover:bg-success/10"
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{project.name}</h1>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setIsEditingName(true)}
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                title="Edit project name"
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          )}
          <p className="text-muted-foreground text-xs mt-0.5">
            {project.company_name || project.description || 'Financial Analysis Project'}
          </p>
        </div>
      </header>

      {/* Hero Metric Cards */}
      {hasData && (
        <section aria-label="Key metrics" className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            label="Risk Score"
            value={riskScore !== null ? `${riskScore.toFixed(0)}/100` : '--'}
            subtitle={riskScore !== null ? getRiskBand(riskScore).label : undefined}
            colorClass={riskScore !== null ? getRiskBand(riskScore).color : undefined}
          />
          <MetricCard
            label="FCCR"
            value={formatRatio(fccr)}
            subtitle={fccr !== null ? (fccr >= 1.2 ? 'Adequate' : 'Below threshold') : undefined}
            colorClass={getRatioStatus(fccr, { good: 1.2, fair: 1.0, direction: 'above' })}
          />
          <MetricCard
            label="Sr. Debt / EBITDA"
            value={formatRatio(seniorDebtToEbitda)}
            subtitle={seniorDebtToEbitda !== null ? (seniorDebtToEbitda <= 3.0 ? 'Healthy' : 'Elevated') : undefined}
            colorClass={getRatioStatus(seniorDebtToEbitda, { good: 3.0, fair: 4.5, direction: 'below' })}
          />
          <MetricCard
            label="Debt / Capital"
            value={formatPercent(totalDebtToCapital)}
            subtitle={totalDebtToCapital !== null ? (totalDebtToCapital <= 0.5 ? 'Conservative' : 'Leveraged') : undefined}
            colorClass={getRatioStatus(totalDebtToCapital, { good: 0.5, fair: 0.65, direction: 'below' })}
          />
        </section>
      )}

      {/* Document Coverage */}
      {extractionCount > 0 && (
        <section aria-label="Document coverage">
          <div className="flex items-start gap-2.5 text-xs">
            <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-1.5">
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">{extractionCount} document{extractionCount > 1 ? 's' : ''}</span> analyzed
                {years.length > 0 && <> &middot; <span className="tabular-nums">{years.join(', ')}</span></>}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {documentCoverage.map((doc) => (
                  <Badge
                    key={doc.document_id}
                    variant="outline"
                    className="text-[11px] gap-1 font-normal"
                  >
                    <FileText className="h-2.5 w-2.5" />
                    <span className="font-medium">{doc.file_name}</span>
                    <span className="text-muted-foreground tabular-nums">({doc.years.join(', ')})</span>
                    <button
                      onClick={() => handleDeleteDocument(doc.document_id, doc.file_name)}
                      disabled={deletingDocId === doc.document_id}
                      className="ml-0.5 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                      title="Remove document"
                    >
                      {deletingDocId === doc.document_id ? (
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-2.5 w-2.5" />
                      )}
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </section>
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
          <Upload className="h-3.5 w-3.5" />
          <AlertTitle className="text-sm">Get Started</AlertTitle>
          <AlertDescription className="text-xs">
            Upload a financial document to begin your bank loan risk analysis.
          </AlertDescription>
        </Alert>
      )}

      {/* ─────────────────────────────────────────────────────────────────────
       * Sticky Section Nav
       * ───────────────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-10 -mx-6 px-6 py-2.5 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="flex gap-1">
          {SECTIONS.map((section) => {
            const isActive = activeSection === section.id;
            const isDisabled = section.id !== 'upload' && !hasData;
            return (
              <button
                key={section.id}
                onClick={() => !isDisabled && scrollToSection(section.id)}
                disabled={isDisabled}
                className={`
                  px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                  ${isActive
                    ? 'bg-primary text-primary-foreground'
                    : isDisabled
                      ? 'text-muted-foreground/50 cursor-not-allowed'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }
                `}
              >
                {section.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ─────────────────────────────────────────────────────────────────────
       * Scroll Sections
       * ───────────────────────────────────────────────────────────────────── */}

      {/* Upload Section */}
      <section id="upload" ref={setSectionRef('upload')} className="scroll-mt-16 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold tracking-tight">Upload Financial Document</CardTitle>
            <CardDescription className="text-xs">
              Upload documents to extract financial metrics. For overlapping years, the newest document takes priority.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FileUpload
              onDataExtracted={handleDataUpdate}
              projectId={project.id}
            />
          </CardContent>
        </Card>
      </section>

      {/* Analysis Section */}
      {hasData && (
        <section id="analysis" ref={setSectionRef('analysis')} className="scroll-mt-16 space-y-4">
          {/* Year source indicators */}
          {Object.keys(yearSources).length > 1 && (
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {years.map((year) => (
                <Badge
                  key={year}
                  variant="default"
                  className="font-normal gap-1"
                >
                  <span className="font-medium">{year}</span>
                  <span className="text-primary-foreground/70">
                    from {yearSources[year]?.file_name || 'Unknown'}
                  </span>
                </Badge>
              ))}
            </div>
          )}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold tracking-tight">Financial Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <FinancialTable data={financialData as unknown as Parameters<typeof FinancialTable>[0]['data']} />
            </CardContent>
          </Card>
        </section>
      )}

      {/* Risk Section */}
      {hasData && (
        <section id="risk" ref={setSectionRef('risk')} className="scroll-mt-16 space-y-5">
          {/* Risk assessment source info */}
          {mostRecentYear && extractionCount > 1 && (
            <p className="text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md">
              Risk metrics based on <span className="font-medium text-foreground">{mostRecentYear}</span> data
              {mostRecentYearSource && (
                <> from <span className="font-medium text-foreground">{mostRecentYearSource.file_name}</span></>
              )}
            </p>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold tracking-tight">Quantitative Risk Scorecard</CardTitle>
            </CardHeader>
            <CardContent>
              <QuantitativeRiskCard data={quantitativeRiskAssessment} />
            </CardContent>
          </Card>

          {financialData && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold tracking-tight">Risk Assessment</CardTitle>
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
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold tracking-tight">Adjusted EBITDA</CardTitle>
              </CardHeader>
              <CardContent>
                <AdjustedEBITDA data={financialData} />
              </CardContent>
            </Card>
          )}

          {financialData && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold tracking-tight">Debt Health Indicators</CardTitle>
              </CardHeader>
              <CardContent>
                <DebtHealthMeters data={financialData} />
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* Decision Section */}
      <section id="decision" ref={setSectionRef('decision')} className="scroll-mt-16">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold tracking-tight">Loan Decision</CardTitle>
            <CardDescription className="text-xs">
              Consolidated lending recommendation based on extracted financial data and risk assessment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-xs">
              Coming soon — this panel will surface a consolidated lending
              recommendation, suggested loan structure, and key conditions.
            </p>
          </CardContent>
        </Card>
      </section>
    </article>
  );
}

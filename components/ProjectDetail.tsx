'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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


import CovenantParametersPanel from '@/components/CovenantParametersPanel';
import { CompactErrorBoundary } from '@/components/ErrorBoundary';
import FileUpload from '@/components/FileUpload';
import FinancialTable from '@/components/FinancialTable';
import DebtHealthMeters from '@/components/DebtHealthMeters';
import WeightedRiskGauge from '@/components/WeightedRiskGauge';
import AdjustedEBITDA from '@/components/AdjustedEBITDA';
import SensitivityPanel from '@/components/SensitivityPanel';
import QuantitativeRiskCard from '@/components/QuantitativeRiskCard';
import ExtractionWarnings from '@/components/ExtractionWarnings';
import MetricCard, { getRatioStatus, formatRatio, formatPercent } from '@/components/MetricCard';
import LoanDecisionCard from '@/components/LoanDecisionCard';
import {
  FinancialTableSkeleton,
  RiskScorecardSkeleton,
  RiskAssessmentSkeleton,
} from '@/components/skeletons/ProjectDetailSkeletons';
import type { QuantitativeRiskAssessment } from '@/lib/quantitative-risk';
import { getRiskConfig } from '@/lib/risk-scoring';
import type { ComputedMetrics } from '@/types';
import {
  recalculateWithCovenantConfig,
  DEFAULT_COVENANT_CONFIG,
  type CovenantConfig,
} from '@/lib/calculations/recalculate';
import { Project } from '@/lib/supabase/types';
import { MergedExtraction } from '@/lib/extraction-utils';
import { FCCR_THRESHOLDS, DEBT_EBITDA_THRESHOLDS, DEBT_CAPITAL_THRESHOLDS } from '@/lib/constants';
import { toast } from 'sonner';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

import type { DebtHealthAssessment } from '@/types/risk';

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
  { id: 'risk', label: 'Risk Score' },
  { id: 'ebitda', label: 'EBITDA' },
  { id: 'covenants', label: 'Covenants' },
  { id: 'decision', label: 'Decision' },
] as const;

// Shared fade-up animation classes (tw-animate-css).
// Short duration and small y-offset keep it professional for a financial app.
const FADE_UP = 'animate-in fade-in slide-in-from-bottom-5 duration-300 fill-mode-both';


// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ProjectDetail({
  project,
  mergedData,
  documentCoverage,
  extractionCount,
}: ProjectDetailProps) {
  const router = useRouter();
  const [financialData, setFinancialData] = useState<{
    metrics_by_year: Record<string, ComputedMetrics>;
  } | null>(null);
  const [debtHealthAssessment, setDebtHealthAssessment] =
    useState<DebtHealthAssessment | null>(null);
  const [quantitativeRiskAssessment, setQuantitativeRiskAssessment] =
    useState<QuantitativeRiskAssessment | null>(null);
  const [yearSources, setYearSources] = useState<MergedExtraction['year_sources']>({});
  const [mostRecentYear, setMostRecentYear] = useState<string | undefined>();
  const [mostRecentYearSource, setMostRecentYearSource] = useState<MergedExtraction['most_recent_year_source']>();
  const [validationIssues, setValidationIssues] = useState<Record<string, string[]> | undefined>();
  const [extractionWarnings, setExtractionWarnings] = useState<string[] | undefined>();
  const [chunkStats, setChunkStats] = useState<{ total: number; successful: number; failed: number; skipped?: number } | undefined>();
  const [tokenUsage, setTokenUsage] = useState<{ input_tokens: number; output_tokens: number; model: string; cost_usd?: number } | undefined>();

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
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);

  // Covenant parameter configuration — drives client-side recalculation
  const [covenantConfig, setCovenantConfig] = useState<CovenantConfig>(DEFAULT_COVENANT_CONFIG);

  // Tracks whether a router.refresh() is in flight after a document upload.
  // During this window the analysis/risk/decision sections show skeletons
  // rather than stale or missing data.
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Recalculate covenant-sensitive metrics whenever the user changes
  // a covenant parameter or new financial data arrives from the server.
  // The original financialData is never mutated; displayData is the derived
  // view used for all downstream display components.
  // ─────────────────────────────────────────────────────────────────────────

  const displayData = useMemo(() => {
    if (!financialData) return null;
    return {
      ...financialData,
      metrics_by_year: recalculateWithCovenantConfig(
        financialData.metrics_by_year,
        covenantConfig
      ),
    };
  }, [financialData, covenantConfig]);

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
        router.refresh();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to update project name');
        setProjectName(project.name);
      }
    } catch (error) {
      console.error('Error updating project name:', error);
      toast.error('Failed to update project name');
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

  const handleDeleteDocument = async (documentId: string) => {
    setDeletingDocId(documentId);
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.refresh();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to delete document');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
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

      if (mergedData.debtHealthAssessment) setDebtHealthAssessment(mergedData.debtHealthAssessment);
      if (mergedData.quantitativeRiskAssessment) setQuantitativeRiskAssessment(mergedData.quantitativeRiskAssessment);
      if (mergedData.year_sources) setYearSources(mergedData.year_sources);
      if (mergedData.most_recent_year) setMostRecentYear(mergedData.most_recent_year);
      if (mergedData.most_recent_year_source) setMostRecentYearSource(mergedData.most_recent_year_source);
      if (mergedData.validation_issues) setValidationIssues(mergedData.validation_issues);
      if (mergedData.extraction_warnings) setExtractionWarnings(mergedData.extraction_warnings);
      if (mergedData.chunk_stats) setChunkStats(mergedData.chunk_stats);
      if (mergedData.token_usage) setTokenUsage(mergedData.token_usage);
    }

    // Clear the refreshing flag whenever the server delivers updated mergedData,
    // whether it is null (no documents) or populated (new extraction available).
    setIsRefreshing(false);
  }, [mergedData]);

  // The SSE payload contains a single-document extraction, but ProjectDetail
  // displays merged multi-document data from the server. Use router.refresh()
  // to re-fetch the authoritative merged view rather than optimistically
  // patching state from one document's extraction.
  const handleDataUpdate = () => {
    setIsRefreshing(true);
    router.refresh();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Derived state
  // ─────────────────────────────────────────────────────────────────────────

  const hasData = financialData !== null;
  const years = financialData ? Object.keys(financialData.metrics_by_year).sort() : [];
  const latestYear = mostRecentYear || years[years.length - 1];
  // Use displayData for all display-facing derived values so covenant config changes
  // are reflected in the hero metric cards and all downstream components.
  const latestMetrics = displayData && latestYear ? displayData.metrics_by_year[latestYear] : null;

  // Hero metric values — System 2 (Weighted Debt Health) is the authoritative lending score
  const riskScore = debtHealthAssessment?.weighted_score ?? null;
  const riskConfig = riskScore !== null ? getRiskConfig(riskScore) : null;
  const riskSemanticColor = riskConfig
    ? (riskConfig.level === 'very-low' || riskConfig.level === 'low') ? 'text-success'
      : riskConfig.level === 'high' ? 'text-error'
      : 'text-warning'
    : undefined;
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
        <section aria-label="Key metrics" className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-in fade-in duration-300">
          <MetricCard
            label="Lending Risk"
            value={riskScore !== null ? `${riskScore.toFixed(1)}/10` : '--'}
            subtitle={riskConfig?.label}
            colorClass={riskSemanticColor}
          />
          <MetricCard
            label="Covenant FCCR"
            value={formatRatio(fccr)}
            subtitle={fccr !== null ? (fccr >= FCCR_THRESHOLDS.ADEQUATE ? 'Adequate' : 'Below threshold') : undefined}
            colorClass={getRatioStatus(fccr, { good: FCCR_THRESHOLDS.ADEQUATE, fair: FCCR_THRESHOLDS.WEAK, direction: 'above' })}
          />
          <MetricCard
            label="Sr. Debt / Adj. EBITDA"
            value={formatRatio(seniorDebtToEbitda)}
            subtitle={seniorDebtToEbitda !== null ? (seniorDebtToEbitda <= DEBT_EBITDA_THRESHOLDS.GOOD ? 'Healthy' : 'Elevated') : undefined}
            colorClass={getRatioStatus(seniorDebtToEbitda, { good: DEBT_EBITDA_THRESHOLDS.GOOD, fair: DEBT_EBITDA_THRESHOLDS.WEAK, direction: 'below' })}
          />
          <MetricCard
            label="Debt / Capital"
            value={formatPercent(totalDebtToCapital)}
            subtitle={totalDebtToCapital !== null ? (totalDebtToCapital <= DEBT_CAPITAL_THRESHOLDS.GOOD ? 'Conservative' : 'Leveraged') : undefined}
            colorClass={getRatioStatus(totalDebtToCapital, { good: DEBT_CAPITAL_THRESHOLDS.GOOD, fair: DEBT_CAPITAL_THRESHOLDS.ADEQUATE, direction: 'below' })}
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
                      onClick={() => setDeleteDocId(doc.document_id)}
                      disabled={deletingDocId === doc.document_id}
                      className="ml-0.5 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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

      {/* Token Usage Summary — dev/admin only */}
      {hasData && tokenUsage && process.env.NEXT_PUBLIC_SHOW_DEV_INFO === 'true' && (
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground px-1">
          <span title="AI model used for extraction" className="flex items-center gap-1">
            <span className="font-medium text-foreground">Model:</span> {tokenUsage.model}
          </span>
          <span className="text-border">·</span>
          <span title="Tokens consumed by this extraction">
            <span className="font-medium text-foreground">{(tokenUsage.input_tokens + tokenUsage.output_tokens).toLocaleString()}</span> tokens
            ({tokenUsage.input_tokens.toLocaleString()} in / {tokenUsage.output_tokens.toLocaleString()} out)
          </span>
          {tokenUsage.cost_usd !== undefined && (
            <>
              <span className="text-border">·</span>
              <span title="Estimated API cost for this extraction">
                <span className="font-medium text-foreground">${tokenUsage.cost_usd.toFixed(4)}</span> est. cost
              </span>
            </>
          )}
        </div>
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
                  px-3 py-1.5 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
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
      {(hasData || isRefreshing) && (
        <section id="analysis" ref={setSectionRef('analysis')} className="scroll-mt-16 space-y-4">
          {/* Year source indicators */}
          {!isRefreshing && Object.keys(yearSources).length > 1 && (
            <div className={`flex flex-wrap gap-1.5 text-[11px] ${FADE_UP}`}>
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

          {/* Covenant Parameters — controls client-side recalculation of ratios below */}
          {!isRefreshing && (
            <div className={`${FADE_UP} delay-[50ms]`}>
              <CovenantParametersPanel
                config={covenantConfig}
                onConfigChange={setCovenantConfig}
              />
            </div>
          )}

          <div className={`${FADE_UP} delay-100`}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold tracking-tight">Financial Summary</CardTitle>
              </CardHeader>
              <CardContent>
                {isRefreshing ? (
                  <FinancialTableSkeleton />
                ) : (
                  <CompactErrorBoundary errorTitle="Failed to render financial table">
                    <FinancialTable data={displayData} />
                  </CompactErrorBoundary>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* Risk Section */}
      {(hasData || isRefreshing) && (
        <section id="risk" ref={setSectionRef('risk')} className="scroll-mt-16 space-y-5">
          {/* Risk assessment source info */}
          {!isRefreshing && mostRecentYear && extractionCount > 1 && (
            <p className={`text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md ${FADE_UP}`}>
              Risk metrics based on <span className="font-medium text-foreground">{mostRecentYear}</span> data
              {mostRecentYearSource && (
                <> from <span className="font-medium text-foreground">{mostRecentYearSource.file_name}</span></>
              )}
            </p>
          )}

          {(displayData || isRefreshing) && (
            <div className={`${FADE_UP} delay-[50ms]`}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold tracking-tight">Lending Risk Score</CardTitle>
                  <CardDescription className="text-xs">Authoritative lending score — FCCR (50%), Sr. Debt / Adj. EBITDA (35%), Debt/Capital (15%)</CardDescription>
                </CardHeader>
                <CardContent>
                  {isRefreshing ? (
                    <RiskAssessmentSkeleton />
                  ) : (
                    <CompactErrorBoundary errorTitle="Failed to render risk assessment">
                      <WeightedRiskGauge
                        data={displayData!}
                        debtHealthAssessment={debtHealthAssessment}
                      />
                    </CompactErrorBoundary>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <div className={`${FADE_UP} delay-100`}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold tracking-tight">Quantitative Risk Scorecard</CardTitle>
                <CardDescription className="text-xs">Supplementary trend analysis — 5-metric scorecard, not used for lending decisions</CardDescription>
              </CardHeader>
              <CardContent>
                {isRefreshing ? (
                  <RiskScorecardSkeleton />
                ) : (
                  <CompactErrorBoundary errorTitle="Failed to render risk scorecard">
                    <QuantitativeRiskCard data={quantitativeRiskAssessment} />
                  </CompactErrorBoundary>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* EBITDA Section */}
      {(hasData || isRefreshing) && (
        <section id="ebitda" ref={setSectionRef('ebitda')} className="scroll-mt-16 space-y-5">
          {(displayData || isRefreshing) && (
            <div className={`${FADE_UP} delay-150`}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold tracking-tight">Adjusted EBITDA</CardTitle>
                </CardHeader>
                <CardContent>
                  {isRefreshing ? (
                    <FinancialTableSkeleton />
                  ) : (
                    <CompactErrorBoundary errorTitle="Failed to render EBITDA breakdown">
                      <AdjustedEBITDA data={displayData!} />
                    </CompactErrorBoundary>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </section>
      )}

      {/* Covenants Section */}
      {(hasData || isRefreshing) && (
        <section id="covenants" ref={setSectionRef('covenants')} className="scroll-mt-16 space-y-5">
          {(displayData || isRefreshing) && (
            <div className={`${FADE_UP} delay-200`}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold tracking-tight">Covenant Health</CardTitle>
                  <CardDescription className="text-xs">Individual covenant ratio assessment</CardDescription>
                </CardHeader>
                <CardContent>
                  {isRefreshing ? (
                    <FinancialTableSkeleton />
                  ) : (
                    <CompactErrorBoundary errorTitle="Failed to render debt health meters">
                      <DebtHealthMeters data={displayData!} />
                    </CompactErrorBoundary>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* EBITDA Sensitivity Analysis */}
          {displayData && !isRefreshing && (
            <div className={`${FADE_UP} delay-[250ms]`}>
              <CompactErrorBoundary errorTitle="Failed to render sensitivity analysis">
                <SensitivityPanel data={displayData} />
              </CompactErrorBoundary>
            </div>
          )}
        </section>
      )}

      {/* Document Delete Confirmation Dialog */}
      <AlertDialog open={deleteDocId !== null} onOpenChange={(open) => !open && setDeleteDocId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the document and its extracted data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-error hover:bg-error/90 text-white"
              onClick={() => {
                if (deleteDocId) {
                  handleDeleteDocument(deleteDocId);
                  setDeleteDocId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Decision Section */}
      <section id="decision" ref={setSectionRef('decision')} className="scroll-mt-16">
        <div className={FADE_UP}>
        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="text-lg font-semibold tracking-tight">Loan Decision</CardTitle>
            <CardDescription className="text-xs">
              Consolidated lending recommendation based on extracted financial data and risk assessment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoanDecisionCard
              debtHealthAssessment={debtHealthAssessment}
              isRefreshing={isRefreshing}
              onScrollToUpload={() => scrollToSection('upload')}
            />
          </CardContent>
        </Card>
        </div>
      </section>
    </article>
  );
}

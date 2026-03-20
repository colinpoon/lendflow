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
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  AlertTriangle,
  ThumbsUp,
  ListChecks,
  Building2,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

import { motion, type Transition } from 'framer-motion';
import CovenantParametersPanel from '@/components/CovenantParametersPanel';
import { CompactErrorBoundary } from '@/components/ErrorBoundary';
import FileUpload from '@/components/FileUpload';
import FinancialTable from '@/components/FinancialTable';
import DebtHealthMeters from '@/components/DebtHealthMeters';
import WeightedRiskGauge from '@/components/WeightedRiskGauge';
import AdjustedEBITDA from '@/components/AdjustedEBITDA';
import QuantitativeRiskCard from '@/components/QuantitativeRiskCard';
import ExtractionWarnings from '@/components/ExtractionWarnings';
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
  { id: 'risk', label: 'Risk' },
  { id: 'decision', label: 'Decision' },
] as const;

// Shared fade-up animation config used across content sections.
// Short duration and small y-offset keep it professional for a financial app.
const SECTION_ENTER = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: (delay = 0): Transition => ({ duration: 0.35, ease: 'easeOut', delay }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Hero Metric helpers
// ─────────────────────────────────────────────────────────────────────────────


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
  // Dark mode: tinted gradient per status; Light mode: neutral white card
  const darkGradientMap: Record<string, string> = {
    'text-success': 'dark:from-emerald-950 dark:via-emerald-900/80 dark:to-zinc-950',
    'text-warning': 'dark:from-amber-950 dark:via-amber-900/80 dark:to-zinc-950',
    'text-error': 'dark:from-red-950 dark:via-red-900/80 dark:to-zinc-950',
  };
  const darkGradient = (colorClass && darkGradientMap[colorClass]) || 'dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-950';

  // Subtitle color: semantic tints for dark, muted gray for light
  const darkSubtitleMap: Record<string, string> = {
    'text-success': 'dark:text-emerald-300',
    'text-warning': 'dark:text-amber-300',
    'text-error': 'dark:text-red-300',
  };
  const subtitleColor = [
    'text-muted-foreground',
    (colorClass && darkSubtitleMap[colorClass]) || 'dark:text-zinc-400',
  ].join(' ');

  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-5 flex flex-col justify-between min-h-[140px] shadow-sm
        bg-card border border-border
        dark:bg-gradient-to-br dark:shadow-lg
        ${darkGradient}`}
    >
      {/* Noise texture overlay — visible only in dark mode where it adds texture without muddying light surfaces */}
      <div className="absolute inset-0 opacity-0 dark:opacity-[0.03] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNhKSIgb3BhY2l0eT0iMSIvPjwvc3ZnPg==')]" />
      {/* Glow orb — dark mode only */}
      <div className="absolute -top-12 -left-12 h-32 w-32 rounded-full opacity-0 dark:opacity-100 bg-foreground/[0.07] blur-2xl" />

      <p className="relative text-[11px] uppercase tracking-[0.15em] font-medium text-muted-foreground">
        {label}
      </p>
      <div className="relative mt-auto">
        <p className="text-3xl font-bold tabular-nums tracking-tight text-foreground">
          {value}
        </p>
        {subtitle && (
          <p className={`text-xs font-medium mt-1 ${subtitleColor}`}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading Skeleton Components
//
// These are rendered inside the real sections while a router.refresh() is in
// flight after a new document is uploaded. They mirror the actual content
// dimensions so the layout does not shift when real data arrives.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Skeleton for the Financial Summary table.
 * Mirrors: header row + 10 alternating data rows, each with label + 3 year columns.
 */
function FinancialTableSkeleton() {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-4 px-4 py-3 border-b border-border bg-muted/30">
        <Skeleton className="h-3 w-36" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-14 ml-auto" />
        ))}
      </div>
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className={`flex items-center gap-4 px-4 py-3 border-b border-border last:border-b-0 ${
            i % 2 === 0 ? 'bg-transparent' : 'bg-muted/20'
          }`}
        >
          <Skeleton className={`h-3 ${i % 3 === 0 ? 'w-40' : 'w-32'}`} />
          {Array.from({ length: 3 }).map((_, j) => (
            <Skeleton key={j} className="h-3 w-14 ml-auto" />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for the Quantitative Risk Scorecard.
 * Mirrors: title, semi-circular gauge, 5-row metrics table, scoring legend.
 */
function RiskScorecardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-3 w-64" />
      </div>
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="h-24 w-48 rounded-xl" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <div className="flex justify-center">
        <Skeleton className="h-3 w-72" />
      </div>
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-3 border-b border-border bg-muted/30">
          {['w-24', 'w-12', 'w-12', 'w-12', 'w-16', 'w-12'].map((w, i) => (
            <Skeleton key={i} className={`h-3 ${w} ${i > 0 ? 'ml-auto' : ''}`} />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-b-0"
          >
            <Skeleton className="h-3 w-28" />
            {Array.from({ length: 5 }).map((_, j) => (
              <Skeleton key={j} className={`h-6 ${j === 2 ? 'w-8 rounded-full' : 'w-12'} ml-auto`} />
            ))}
          </div>
        ))}
      </div>
      <div className="bg-muted rounded-lg p-4 space-y-3">
        <Skeleton className="h-4 w-24" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-full shrink-0" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for the Risk Assessment pillar cards + overall verdict.
 * Mirrors: 5 pillar cards with label, score badge, progress bar, and observation text.
 */
function RiskAssessmentSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-48" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-40" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Skeleton className="h-2 w-8" />
              <Skeleton className="h-2 w-8" />
            </div>
            <Skeleton className="h-1 w-full rounded-full" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
      <div className="rounded-lg border border-border p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for the Loan Decision card.
 * Mirrors: verdict banner, risk/positive factor grid, recommendations, loan structure block.
 */
function DecisionSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 rounded-xl border border-border px-5 py-4">
        <Skeleton className="h-8 w-8 rounded-full shrink-0" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="space-y-1.5 text-right">
          <Skeleton className="h-3 w-16 ml-auto" />
          <Skeleton className="h-4 w-24 ml-auto" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, col) => (
          <div key={col} className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="space-y-1.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Skeleton className="h-1.5 w-1.5 rounded-full mt-1 shrink-0" />
                  <Skeleton className={`h-3 ${i === 1 ? 'w-4/5' : 'w-full'}`} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="space-y-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-2">
              <Skeleton className="h-1.5 w-1.5 rounded-full mt-1 shrink-0" />
              <Skeleton className={`h-3 ${i % 2 === 0 ? 'w-full' : 'w-3/4'}`} />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </div>
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
            label="Sr. Debt / EBITDA"
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
      {(hasData || isRefreshing) && (
        <section id="analysis" ref={setSectionRef('analysis')} className="scroll-mt-16 space-y-4">
          {/* Year source indicators */}
          {!isRefreshing && Object.keys(yearSources).length > 1 && (
            <motion.div
              className="flex flex-wrap gap-1.5 text-[11px]"
              initial={SECTION_ENTER.initial}
              animate={SECTION_ENTER.animate}
              transition={SECTION_ENTER.transition(0)}
            >
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
            </motion.div>
          )}

          <motion.div
            initial={SECTION_ENTER.initial}
            animate={SECTION_ENTER.animate}
            transition={SECTION_ENTER.transition(0.1)}
          >
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
          </motion.div>
        </section>
      )}

      {/* Risk Section */}
      {(hasData || isRefreshing) && (
        <section id="risk" ref={setSectionRef('risk')} className="scroll-mt-16 space-y-5">
          {/* Risk assessment source info */}
          {!isRefreshing && mostRecentYear && extractionCount > 1 && (
            <motion.p
              className="text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md"
              initial={SECTION_ENTER.initial}
              animate={SECTION_ENTER.animate}
              transition={SECTION_ENTER.transition(0)}
            >
              Risk metrics based on <span className="font-medium text-foreground">{mostRecentYear}</span> data
              {mostRecentYearSource && (
                <> from <span className="font-medium text-foreground">{mostRecentYearSource.file_name}</span></>
              )}
            </motion.p>
          )}

          {(displayData || isRefreshing) && (
            <motion.div
              initial={SECTION_ENTER.initial}
              animate={SECTION_ENTER.animate}
              transition={SECTION_ENTER.transition(0.05)}
            >
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold tracking-tight">Lending Risk Score</CardTitle>
                  <CardDescription className="text-xs">Authoritative lending score — FCCR (50%), Sr. Debt/EBITDA (35%), Debt/Capital (15%)</CardDescription>
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
            </motion.div>
          )}

          <motion.div
            initial={SECTION_ENTER.initial}
            animate={SECTION_ENTER.animate}
            transition={SECTION_ENTER.transition(0.1)}
          >
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
          </motion.div>

          {(displayData || isRefreshing) && (
            <motion.div
              initial={SECTION_ENTER.initial}
              animate={SECTION_ENTER.animate}
              transition={SECTION_ENTER.transition(0.15)}
            >
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
            </motion.div>
          )}

          {/* Covenant Parameters — controls client-side recalculation */}
          {!isRefreshing && (
            <motion.div
              initial={SECTION_ENTER.initial}
              animate={SECTION_ENTER.animate}
              transition={SECTION_ENTER.transition(0.15)}
            >
              <CovenantParametersPanel
                config={covenantConfig}
                onConfigChange={setCovenantConfig}
              />
            </motion.div>
          )}

          {(displayData || isRefreshing) && (
            <motion.div
              initial={SECTION_ENTER.initial}
              animate={SECTION_ENTER.animate}
              transition={SECTION_ENTER.transition(0.2)}
            >
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
            </motion.div>
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
        <motion.div
          initial={SECTION_ENTER.initial}
          animate={SECTION_ENTER.animate}
          transition={SECTION_ENTER.transition(0)}
        >
        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="text-lg font-semibold tracking-tight">Loan Decision</CardTitle>
            <CardDescription className="text-xs">
              Consolidated lending recommendation based on extracted financial data and risk assessment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isRefreshing ? (
              <DecisionSkeleton />
            ) : debtHealthAssessment ? (() => {
              const lowerDecision = debtHealthAssessment.lending_decision.toLowerCase();
              const isApprove = lowerDecision.includes('approve') && !lowerDecision.includes('conditional');
              const isConditional = lowerDecision.includes('conditional');
              const bannerClasses = isApprove
                ? 'bg-success/15 border-success/40 text-success'
                : isConditional
                  ? 'bg-warning/15 border-warning/40 text-warning'
                  : 'bg-error/15 border-error/40 text-error';
              const DecisionIcon = isApprove ? ShieldCheck : isConditional ? ShieldAlert : ShieldX;

              return (
                <div className="space-y-5">
                  {/* Verdict Banner — largest, most visible element in this section */}
                  <div className={`flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border-2 px-6 py-5 ${bannerClasses}`}>
                    <DecisionIcon className="h-12 w-12 shrink-0 opacity-90" aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground mb-0.5">
                        Lending Decision
                      </p>
                      <p className="text-2xl font-extrabold tracking-tight leading-tight break-words">
                        {debtHealthAssessment.lending_decision}
                      </p>
                    </div>
                    <div className="sm:ml-auto sm:text-right shrink-0">
                      <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground mb-0.5">
                        Risk Band
                      </p>
                      <p className="text-base font-bold">{debtHealthAssessment.risk_band}</p>
                    </div>
                  </div>

                  {/* Risk Factors + Positive Factors — distinct semantic panel treatments */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {debtHealthAssessment.key_risk_factors.length > 0 && (
                      <div className="rounded-lg border border-warning/25 bg-warning/5 p-4 space-y-2.5">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                          Key Risk Factors
                          <span className="ml-auto text-[11px] font-medium bg-warning/15 text-warning px-2 py-0.5 rounded-full tabular-nums">
                            {debtHealthAssessment.key_risk_factors.length}
                          </span>
                        </div>
                        <ul className="space-y-2">
                          {debtHealthAssessment.key_risk_factors.map((factor, i) => (
                            <li key={i} className="text-xs text-muted-foreground leading-relaxed flex items-start gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-warning shrink-0" />
                              {factor}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {debtHealthAssessment.positive_factors.length > 0 && (
                      <div className="rounded-lg border border-success/25 bg-success/5 p-4 space-y-2.5">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <ThumbsUp className="h-4 w-4 text-success shrink-0" />
                          Positive Factors
                          <span className="ml-auto text-[11px] font-medium bg-success/15 text-success px-2 py-0.5 rounded-full tabular-nums">
                            {debtHealthAssessment.positive_factors.length}
                          </span>
                        </div>
                        <ul className="space-y-2">
                          {debtHealthAssessment.positive_factors.map((factor, i) => (
                            <li key={i} className="text-xs text-muted-foreground leading-relaxed flex items-start gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-success shrink-0" />
                              {factor}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Recommendations — numbered list; action-oriented framing */}
                  {debtHealthAssessment.recommendations.length > 0 && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2.5">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <ListChecks className="h-4 w-4 text-primary shrink-0" />
                        Recommendations
                        <span className="ml-auto text-[11px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full tabular-nums">
                          {debtHealthAssessment.recommendations.length}
                        </span>
                      </div>
                      <ol className="space-y-2">
                        {debtHealthAssessment.recommendations.map((rec, i) => (
                          <li key={i} className="text-xs text-muted-foreground leading-relaxed flex items-start gap-2.5">
                            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary font-bold text-[9px]">
                              {i + 1}
                            </span>
                            {rec}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Suggested Loan Structure */}
                  {debtHealthAssessment.suggested_loan_structure && (
                    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Building2 className="h-4 w-4 text-primary shrink-0" />
                        Suggested Loan Structure
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                        {debtHealthAssessment.suggested_loan_structure}
                      </p>
                    </div>
                  )}
                </div>
              );
            })() : (
              <p className="text-muted-foreground text-xs">
                Upload financial documents to generate a lending recommendation.
              </p>
            )}
          </CardContent>
        </Card>
        </motion.div>
      </section>
    </article>
  );
}

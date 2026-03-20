import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { createClient } from '@/utils/supabase/server';
import type { Extraction, Project } from '@/lib/supabase/types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ProjectWithExtraction {
  project: Project;
  extraction: Extraction | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(value: number | null, decimals = 2): string {
  if (value === null || value === undefined) return '—';
  return value.toFixed(decimals);
}

function fmtCurrency(value: number | null): string {
  if (value === null || value === undefined) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}B`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}M`;
  return `$${value.toFixed(0)}K`;
}

function fmtPct(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

function getRiskBadgeVariant(
  band: string | null
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (!band) return 'outline';
  const b = band.toLowerCase();
  if (b.includes('excellent') || b.includes('strong')) return 'default';
  if (b.includes('good') || b.includes('adequate')) return 'secondary';
  if (b.includes('weak') || b.includes('poor') || b.includes('high')) return 'destructive';
  return 'outline';
}

function getRiskColor(band: string | null): string {
  if (!band) return 'text-muted-foreground';
  const b = band.toLowerCase();
  if (b.includes('excellent') || b.includes('strong')) return 'text-green-600 dark:text-green-400';
  if (b.includes('good')) return 'text-emerald-600 dark:text-emerald-400';
  if (b.includes('adequate') || b.includes('medium')) return 'text-amber-600 dark:text-amber-400';
  if (b.includes('weak') || b.includes('poor') || b.includes('high')) return 'text-red-600 dark:text-red-400';
  return 'text-muted-foreground';
}

function fccrIcon(fccr: number | null) {
  if (fccr === null) return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  if (fccr >= 1.5) return <TrendingUp className="h-3.5 w-3.5 text-green-500" />;
  if (fccr >= 1.25) return <Minus className="h-3.5 w-3.5 text-amber-500" />;
  return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default async function InstrumentsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const supabase = await createClient();

  // Fetch all completed projects
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['completed', 'in_progress'])
    .order('updated_at', { ascending: false });

  // Fetch all extractions for these projects in a single query, then pick the
  // most recent per project client-side. Avoids N+1 round-trips.
  const projectIds = (projects ?? []).map((p) => p.id);
  const { data: allExtractions } = projectIds.length > 0
    ? await supabase
        .from('extractions')
        .select('*')
        .in('project_id', projectIds)
        .order('created_at', { ascending: false })
    : { data: [] as Extraction[] };

  // Group by project_id — first occurrence is most recent (ordered desc above)
  const latestByProject = new Map<string, Extraction>();
  for (const ext of allExtractions ?? []) {
    if (!latestByProject.has(ext.project_id)) {
      latestByProject.set(ext.project_id, ext);
    }
  }

  const projectsWithExtractions: ProjectWithExtraction[] = (projects ?? []).map((project) => ({
    project,
    extraction: latestByProject.get(project.id) ?? null,
  }));

  // Only rows that have at least one extraction
  const analyzed = projectsWithExtractions.filter((r) => r.extraction !== null);

  // ── Portfolio summary stats ────────────────────────────────────────────────
  const fccrValues = analyzed
    .map((r) => r.extraction!.latest_fccr)
    .filter((v): v is number => v !== null);
  const leverageValues = analyzed
    .map((r) => r.extraction!.latest_senior_debt_to_ebitda)
    .filter((v): v is number => v !== null);
  const debtCapValues = analyzed
    .map((r) => r.extraction!.latest_debt_to_capital)
    .filter((v): v is number => v !== null);

  const avgFccr =
    fccrValues.length > 0
      ? fccrValues.reduce((a, b) => a + b, 0) / fccrValues.length
      : null;
  const avgLeverage =
    leverageValues.length > 0
      ? leverageValues.reduce((a, b) => a + b, 0) / leverageValues.length
      : null;
  const avgDebtCap =
    debtCapValues.length > 0
      ? debtCapValues.reduce((a, b) => a + b, 0) / debtCapValues.length
      : null;

  const belowCovenant = fccrValues.filter((v) => v < 1.25).length;
  const adequateCoverage = fccrValues.filter((v) => v >= 1.25 && v < 1.5).length;
  const strongCoverage = fccrValues.filter((v) => v >= 1.5).length;

  const hasData = analyzed.length > 0;

  return (
    <div className="container mx-auto max-w-6xl py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          Portfolio Analytics
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Aggregated view of all analyzed companies and their key credit metrics.
        </p>
      </div>

      {!hasData && (
        <Card>
          <CardContent className="py-16 text-center">
            <BarChart3 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              No analyzed documents yet. Upload financial reports from your{' '}
              <Link href="/dashboard" className="underline underline-offset-2 text-primary">
                dashboard
              </Link>{' '}
              to see portfolio analytics here.
            </p>
          </CardContent>
        </Card>
      )}

      {hasData && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Companies Analyzed
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <span className="text-3xl font-bold">{analyzed.length}</span>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Avg FCCR
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <span
                  className={`text-3xl font-bold ${
                    avgFccr === null
                      ? 'text-muted-foreground'
                      : avgFccr >= 1.5
                        ? 'text-green-600 dark:text-green-400'
                        : avgFccr >= 1.25
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {fmt(avgFccr)}x
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Covenant threshold: 1.25x
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Avg Sr Debt / Adj. EBITDA
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <span
                  className={`text-3xl font-bold ${
                    avgLeverage === null
                      ? 'text-muted-foreground'
                      : avgLeverage <= 3
                        ? 'text-green-600 dark:text-green-400'
                        : avgLeverage <= 5
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {fmt(avgLeverage)}x
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Typical limit: 4–5x
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Avg Debt / Capital
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <span className="text-3xl font-bold">{fmtPct(avgDebtCap)}</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Typical limit: &lt;60%
                </p>
              </CardContent>
            </Card>
          </div>

          {/* FCCR distribution */}
          {fccrValues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">FCCR Coverage Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-6 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <span className="text-sm">
                      <span className="font-medium text-red-600 dark:text-red-400">{belowCovenant}</span>{' '}
                      <span className="text-muted-foreground">below covenant (&lt;1.25x)</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-amber-500" />
                    <span className="text-sm">
                      <span className="font-medium text-amber-600 dark:text-amber-400">{adequateCoverage}</span>{' '}
                      <span className="text-muted-foreground">adequate (1.25–1.50x)</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                    <span className="text-sm">
                      <span className="font-medium text-green-600 dark:text-green-400">{strongCoverage}</span>{' '}
                      <span className="text-muted-foreground">strong (&gt;1.50x)</span>
                    </span>
                  </div>
                </div>

                {/* Bar chart */}
                <div className="mt-4 flex gap-1.5 items-end h-32">
                  {analyzed.map(({ project, extraction }) => {
                    const fccr = extraction?.latest_fccr ?? null;
                    const color =
                      fccr === null
                        ? 'bg-muted'
                        : fccr >= 1.5
                          ? 'bg-green-500'
                          : fccr >= 1.25
                            ? 'bg-amber-500'
                            : 'bg-red-500';
                    // Normalize bar height: cap at 3x for visual clarity
                    const pct = fccr === null ? 15 : Math.max(Math.min((fccr / 3) * 100, 100), 10);
                    return (
                      <div
                        key={project.id}
                        className="flex-1 h-full flex flex-col justify-end group relative cursor-pointer"
                      >
                        <div
                          className={`${color} rounded-t transition-opacity group-hover:opacity-80`}
                          style={{ height: `${pct}%`, minHeight: '12px' }}
                        />
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-md bg-popover text-popover-foreground text-xs shadow-md border border-border whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                          <span className="font-medium">{project.name}</span>
                          <span className="text-muted-foreground ml-1.5">
                            {fccr !== null ? `${fccr.toFixed(2)}x` : 'N/A'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Each bar represents one company. Height proportional to FCCR (capped at 3x).
                </p>
              </CardContent>
            </Card>
          )}

          {/* Portfolio table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Company Comparison</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Company</TableHead>
                      <TableHead className="text-right">Adj EBITDA</TableHead>
                      <TableHead className="text-right">FCCR</TableHead>
                      <TableHead className="text-right">DSCR</TableHead>
                      <TableHead className="text-right">Sr Debt / Adj. EBITDA</TableHead>
                      <TableHead className="text-right">Debt / Capital</TableHead>
                      <TableHead className="text-center">Risk</TableHead>
                      <TableHead className="pr-6" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analyzed.map(({ project, extraction }) => {
                      const fccr = extraction?.latest_fccr ?? null;
                      const flagLowCoverage = fccr !== null && fccr < 1.25;
                      return (
                        <TableRow key={project.id}>
                          <TableCell className="pl-6">
                            <div className="flex items-center gap-1.5">
                              {flagLowCoverage && (
                                <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                              )}
                              <div>
                                <p className="font-medium text-sm leading-tight">{project.name}</p>
                                {project.company_name && (
                                  <p className="text-xs text-muted-foreground">{project.company_name}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {fmtCurrency(extraction?.latest_adjusted_ebitda ?? null)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            <span className="inline-flex items-center gap-1 text-sm">
                              {fccrIcon(fccr)}
                              <span
                                className={
                                  fccr === null
                                    ? 'text-muted-foreground'
                                    : fccr >= 1.5
                                      ? 'text-green-600 dark:text-green-400 font-medium'
                                      : fccr >= 1.25
                                        ? 'text-amber-600 dark:text-amber-400 font-medium'
                                        : 'text-red-600 dark:text-red-400 font-medium'
                                }
                              >
                                {fmt(fccr)}x
                              </span>
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {fmt(extraction?.latest_dscr ?? null)}x
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {fmt(extraction?.latest_senior_debt_to_ebitda ?? null)}x
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {fmtPct(extraction?.latest_debt_to_capital ?? null)}
                          </TableCell>
                          <TableCell className="text-center">
                            {project.risk_band ? (() => {
                              const variant = getRiskBadgeVariant(project.risk_band);
                              return (
                                <Badge
                                  variant={variant}
                                  className={`text-xs ${variant === 'destructive' ? '' : getRiskColor(project.risk_band)}`}
                                >
                                  {project.risk_band}
                                </Badge>
                              );
                            })() : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="pr-6">
                            <Link
                              href={`/dashboard/${project.id}`}
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              View
                              <ArrowRight className="h-3 w-3" />
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

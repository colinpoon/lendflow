'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronDown, ChevronRight, Download, Upload, RotateCcw, Sparkles, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useGroundTruth } from '@/lib/benchmarks/use-ground-truth';
import {
  calculateExtractionAccuracy,
  calculateVariance,
  getStatus,
  getMetricCategories,
  getMetricsByCategory,
  resolveMetricValue,
  type MetricCategory,
  type AccuracyStatus,
} from '@/lib/benchmarks/accuracy';
import type { ComputedMetrics } from '@/types';

interface GroundTruthDebuggerProps {
  filename: string;
  metrics: ComputedMetrics | null;
  selectedYear: string;
}

const STATUS_COLORS: Record<AccuracyStatus, string> = {
  green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  missing: 'bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400',
};

const STATUS_LABELS: Record<AccuracyStatus, string> = {
  green: '<5%',
  amber: '5-20%',
  red: '>20%',
  missing: 'N/A',
};

// Categories expanded by default
const DEFAULT_EXPANDED: MetricCategory[] = ['Computed Ratios', 'Income Statement'];

function formatValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  if (Math.abs(value) >= 1000) return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (Math.abs(value) < 10) return value.toFixed(4);
  return value.toFixed(2);
}

function formatDelta(extracted: number | null, truth: number | undefined): string {
  if (extracted === null || truth === undefined) return '-';
  const delta = extracted - truth;
  const sign = delta >= 0 ? '+' : '';
  if (Math.abs(delta) >= 1000) return `${sign}${delta.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (Math.abs(delta) < 10) return `${sign}${delta.toFixed(4)}`;
  return `${sign}${delta.toFixed(2)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Editable Cell
// ─────────────────────────────────────────────────────────────────────────────

function EditableCell({
  value,
  onSave,
}: {
  value: number | undefined;
  onSave: (val: number | undefined) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const startEdit = () => {
    setDraft(value !== undefined ? String(value) : '');
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed === '') {
      onSave(undefined);
    } else {
      const num = parseFloat(trimmed);
      if (!isNaN(num)) onSave(num);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commit();
    } else if (e.key === 'Escape') {
      setEditing(false);
    } else if (e.key === 'Tab') {
      commit();
      // Let default tab behavior continue
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className="w-full bg-background border border-primary rounded px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
      />
    );
  }

  return (
    <button
      onClick={startEdit}
      className="w-full text-left px-2 py-1 rounded cursor-pointer hover:bg-muted/80 font-mono text-sm transition-colors"
      title="Click to edit"
    >
      {value !== undefined ? formatValue(value) : <span className="text-muted-foreground italic">click to set</span>}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Category Section
// ─────────────────────────────────────────────────────────────────────────────

function CategorySection({
  category,
  metrics,
  groundTruth,
  onUpdateField,
  hideEmpty,
  defaultExpanded,
}: {
  category: MetricCategory;
  metrics: ComputedMetrics | null;
  groundTruth: Record<string, unknown>;
  onUpdateField: (key: string, value: number | undefined) => void;
  hideEmpty: boolean;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const categoryMetrics = getMetricsByCategory(category);

  // Filter out empty rows if toggle is on
  const visibleMetrics = hideEmpty
    ? categoryMetrics.filter(({ key }) => {
        const gt = groundTruth[key] as number | undefined;
        const extracted = metrics ? resolveMetricValue(metrics, key) : null;
        return gt !== undefined || extracted !== null;
      })
    : categoryMetrics;

  if (visibleMetrics.length === 0) return null;

  // Calculate category-level stats
  const categoryAccuracy = calculateExtractionAccuracy(
    Object.fromEntries(
      visibleMetrics
        .filter(({ key }) => (groundTruth[key] as number | undefined) !== undefined)
        .map(({ key }) => [key, groundTruth[key]])
    ),
    metrics,
  );

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-medium">{category}</span>
          <span className="text-xs text-muted-foreground">
            ({visibleMetrics.length} fields)
          </span>
        </div>
        {categoryAccuracy.metrics_compared > 0 && (
          <div className="flex items-center gap-2 text-xs">
            {categoryAccuracy.green_count > 0 && (
              <span className={`px-1.5 py-0.5 rounded ${STATUS_COLORS.green}`}>
                {categoryAccuracy.green_count}
              </span>
            )}
            {categoryAccuracy.amber_count > 0 && (
              <span className={`px-1.5 py-0.5 rounded ${STATUS_COLORS.amber}`}>
                {categoryAccuracy.amber_count}
              </span>
            )}
            {categoryAccuracy.red_count > 0 && (
              <span className={`px-1.5 py-0.5 rounded ${STATUS_COLORS.red}`}>
                {categoryAccuracy.red_count}
              </span>
            )}
            {categoryAccuracy.missing_count > 0 && (
              <span className={`px-1.5 py-0.5 rounded ${STATUS_COLORS.missing}`}>
                {categoryAccuracy.missing_count}
              </span>
            )}
          </div>
        )}
      </button>

      {expanded && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Field</TableHead>
              <TableHead className="w-[150px]">Ground Truth</TableHead>
              <TableHead className="w-[150px]">Extracted</TableHead>
              <TableHead className="w-[120px]">Delta</TableHead>
              <TableHead className="w-[80px] text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleMetrics.map(({ key, def }) => {
              const gt = groundTruth[key] as number | undefined;
              const extracted = metrics ? resolveMetricValue(metrics, key) : null;
              const variance =
                gt !== undefined ? calculateVariance(extracted, gt) : null;
              const status: AccuracyStatus =
                gt === undefined ? 'missing' : getStatus(variance);

              return (
                <TableRow key={key}>
                  <TableCell className="font-medium text-sm">{def.label}</TableCell>
                  <TableCell>
                    <EditableCell
                      value={gt}
                      onSave={(val) => onUpdateField(key, val)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {formatValue(extracted)}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {formatDelta(extracted, gt)}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[status]}`}>
                      {variance !== null && status !== 'missing'
                        ? `${variance.toFixed(1)}%`
                        : STATUS_LABELS[status]}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function GroundTruthDebugger({
  filename,
  metrics,
  selectedYear,
}: GroundTruthDebuggerProps) {
  const {
    groundTruth,
    updateField,
    resetToSeed,
    populateFromExtracted,
    isDirty,
    exportJSON,
    importJSON,
  } = useGroundTruth(filename, selectedYear);

  const [hideEmpty, setHideEmpty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = getMetricCategories();

  // Overall accuracy
  const summary = calculateExtractionAccuracy(groundTruth, metrics);

  const handleExport = useCallback(() => {
    const json = exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ground-truth_${filename}_${selectedYear}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportJSON, filename, selectedYear]);

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        const ok = importJSON(text);
        if (!ok) {
          alert('Invalid JSON file. Expected an object with numeric values.');
        }
      };
      reader.readAsText(file);
      // Reset input so re-importing the same file works
      e.target.value = '';
    },
    [importJSON],
  );

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CardTitle>Ground Truth Debugger</CardTitle>
            {summary.metrics_compared > 0 && (
              <span
                className={`px-3 py-1 rounded-full text-sm font-bold ${
                  summary.accuracy_pct >= 80
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : summary.accuracy_pct >= 50
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                }`}
              >
                {summary.accuracy_pct.toFixed(0)}% accurate
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHideEmpty(!hideEmpty)}
              title={hideEmpty ? 'Show all fields' : 'Hide empty fields'}
            >
              {hideEmpty ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
              {hideEmpty ? 'Show all' : 'Hide empty'}
            </Button>

            {metrics && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => populateFromExtracted(metrics)}
                title="Fill empty ground truth fields with extracted values"
              >
                <Sparkles className="h-4 w-4 mr-1" />
                Populate
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={resetToSeed}
              disabled={!isDirty}
              title="Reset to seed data"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>

            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-1" />
              Import
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </div>
        </div>

        {summary.metrics_compared > 0 && (
          <div className="flex gap-4 text-xs text-muted-foreground mt-2">
            <span>Compared: {summary.metrics_compared}</span>
            <span className="text-green-600">{summary.green_count} green</span>
            <span className="text-amber-600">{summary.amber_count} amber</span>
            <span className="text-red-600">{summary.red_count} red</span>
            <span className="text-gray-400">{summary.missing_count} missing</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {categories.map((category) => (
          <CategorySection
            key={category}
            category={category}
            metrics={metrics}
            groundTruth={groundTruth as unknown as Record<string, unknown>}
            onUpdateField={updateField}
            hideEmpty={hideEmpty}
            defaultExpanded={DEFAULT_EXPANDED.includes(category)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

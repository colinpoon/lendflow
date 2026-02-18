'use client';

import { useState, useCallback, useEffect } from 'react';
import { GitCompare, Upload, Loader2 } from 'lucide-react';
import { H1 } from '@/components/ui/typography';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ComparisonTable } from '@/components/ComparisonTable';
import { AccuracyReport } from '@/components/AccuracyReport';
import { CostReport } from '@/components/CostReport';
import { calculateAccuracy, type AccuracySummary } from '@/lib/benchmarks/accuracy';
import { getGroundTruth } from '@/lib/benchmarks/ground-truth';
import type { ExtractionResult } from '@/utils/aiProcessor';

interface CompareResult {
  filename: string;
  text: ExtractionResult | null;
  text_error: string | null;
  vision: ExtractionResult | null;
  vision_error: string | null;
}

interface CompareErrorResponse {
  error: string;
}

const ComparePage = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [accuracySummary, setAccuracySummary] = useState<AccuracySummary | null>(null);
  const [activeTab, setActiveTab] = useState<string>('comparison');

  // Get available years from results
  const availableYears = results
    ? [...new Set([
        ...Object.keys(results.text?.metrics_by_year ?? {}),
        ...Object.keys(results.vision?.metrics_by_year ?? {}),
      ])].sort().reverse()
    : [];

  // Update accuracy summary when year changes
  useEffect(() => {
    if (!results || !selectedYear) {
      setAccuracySummary(null);
      return;
    }

    // getGroundTruth uses partial case-insensitive matching
    const groundTruth = getGroundTruth(results.filename, selectedYear);
    if (groundTruth) {
      const accuracy = calculateAccuracy(
        groundTruth,
        results.text?.metrics_by_year?.[selectedYear] ?? null,
        results.vision?.metrics_by_year?.[selectedYear] ?? null
      );
      setAccuracySummary(accuracy);
    } else {
      setAccuracySummary(null);
    }
  }, [results, selectedYear]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
        setError('Only PDF files are supported for comparison');
        return;
      }
      setFile(selectedFile);
      setError(null);
      setResults(null);
      setSelectedYear('');
      setAccuracySummary(null);
    }
  };

  const handleUpload = useCallback(async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/compare', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        const errorData = data as CompareErrorResponse;
        throw new Error(errorData.error || 'Comparison failed');
      }

      const resultData = data as CompareResult;

      setResults(resultData);

      // Set default year to most recent available
      const years = new Set([
        ...Object.keys(resultData.text?.metrics_by_year ?? {}),
        ...Object.keys(resultData.vision?.metrics_by_year ?? {}),
      ]);
      if (years.size > 0) {
        const sortedYears = [...years].sort().reverse();
        setSelectedYear(sortedYears[0]);
      }

      // Navigate to comparison tab after results
      setActiveTab('comparison');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [file]);

  const hasResults = results && (results.text || results.vision);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
      <H1 className="text-center text-primary mb-8">
        <GitCompare className="inline-block mr-2 h-8 w-8" />
        Text vs Vision Comparison
      </H1>

      <Alert variant="default" className="mb-6">
        <AlertTitle>Pipeline Comparison</AlertTitle>
        <AlertDescription>
          Upload a PDF to compare text extraction (GPT-4 Turbo) vs vision extraction (Claude Sonnet 4).
          See side-by-side results, accuracy against ground truth, and cost comparison.
        </AlertDescription>
      </Alert>

      {/* Upload Section */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Upload PDF for Comparison</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="block w-full text-sm text-muted-foreground
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-medium
                file:bg-primary file:text-primary-foreground
                hover:file:bg-primary/90
                cursor-pointer"
              disabled={loading}
            />
            <Button
              onClick={handleUpload}
              disabled={!file || loading}
              className="min-w-[120px]"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Compare
                </>
              )}
            </Button>
          </div>

          {file && !loading && !results && (
            <p className="text-sm text-muted-foreground">
              Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}

          {loading && (
            <Alert variant="default">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <AlertDescription>
                Running both text and vision extractions... This may take 2-3 minutes.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {results && (
            <div className="flex flex-wrap gap-2 text-sm">
              {results.text && (
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  Text: {Object.keys(results.text.metrics_by_year ?? {}).length} year(s)
                </span>
              )}
              {results.text_error && (
                <span className="bg-red-100 text-red-800 px-2 py-1 rounded">
                  Text error: {results.text_error}
                </span>
              )}
              {results.vision && (
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                  Vision: {Object.keys(results.vision.metrics_by_year ?? {}).length} year(s)
                </span>
              )}
              {results.vision_error && (
                <span className="bg-red-100 text-red-800 px-2 py-1 rounded">
                  Vision error: {results.vision_error}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Section */}
      {hasResults && (
        <div className="space-y-4">
          {/* Year Selector */}
          {availableYears.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Fiscal Year:</span>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="comparison">Side-by-Side</TabsTrigger>
              <TabsTrigger value="accuracy">Accuracy</TabsTrigger>
              <TabsTrigger value="cost">Cost</TabsTrigger>
            </TabsList>

            <TabsContent value="comparison">
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>
                    Metric Comparison {selectedYear && `(${selectedYear})`}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedYear ? (
                    <ComparisonTable
                      textMetrics={results.text?.metrics_by_year ?? null}
                      visionMetrics={results.vision?.metrics_by_year ?? null}
                      selectedYear={selectedYear}
                    />
                  ) : (
                    <p className="text-muted-foreground">Select a fiscal year to view comparison.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="accuracy">
              <AccuracyReport summary={accuracySummary} />
            </TabsContent>

            <TabsContent value="cost">
              <CostReport
                textUsage={results.text?.token_usage ?? null}
                visionUsage={results.vision?.token_usage ?? null}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
};

export default ComparePage;

'use client';

import { useState, useCallback } from 'react';
import { Bug, Upload, Loader2, RefreshCw } from 'lucide-react';
import { H1 } from '@/components/ui/typography';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GroundTruthDebugger } from '@/components/GroundTruthDebugger';
import type { ExtractionResult } from '@/utils/aiProcessor';

interface CompareResult {
  filename: string;
  extracted: ExtractionResult | null;
  extracted_error: string | null;
}

function getSortedYears(extracted: ExtractionResult | null): string[] {
  return Object.keys(extracted?.metrics_by_year ?? {}).sort().reverse();
}

const ComparePage = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>('');

  const availableYears = results?.extracted
    ? getSortedYears(results.extracted)
    : [];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
        setError('Only PDF files are supported');
        return;
      }
      setFile(selectedFile);
      setError(null);
      setResults(null);
      setSelectedYear('');
    }
  };

  const handleUpload = useCallback(async () => {
    if (!file || loading) return;

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
        throw new Error(data.error || 'Extraction failed');
      }

      const resultData = data as CompareResult;
      setResults(resultData);

      const years = getSortedYears(resultData.extracted);
      if (years.length > 0) {
        setSelectedYear(years[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [file, loading]);

  const currentMetrics =
    results?.extracted && selectedYear
      ? results.extracted.metrics_by_year?.[selectedYear] ?? null
      : null;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
      <H1 className="text-center text-primary mb-8">
        <Bug className="inline-block mr-2 h-8 w-8" />
        Extraction Debugger
      </H1>

      {/* Upload Section */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Upload PDF for Extraction</CardTitle>
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
                  Extract
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
                Running text extraction... This may take 1-2 minutes.
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
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {results.extracted && (
                <span className="bg-info/10 text-info px-2 py-1 rounded">
                  Extracted: {Object.keys(results.extracted.metrics_by_year ?? {}).length} year(s)
                </span>
              )}
              {results.extracted_error && (
                <span className="bg-error/10 text-error px-2 py-1 rounded">
                  Error: {results.extracted_error}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleUpload}
                disabled={loading}
                title="Re-run extraction on the same file"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Re-extract
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Year Selector + Debugger */}
      {results?.extracted && availableYears.length > 0 && (
        <div className="space-y-4">
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

          {selectedYear && (
            <GroundTruthDebugger
              filename={results.filename}
              metrics={currentMetrics}
              selectedYear={selectedYear}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default ComparePage;

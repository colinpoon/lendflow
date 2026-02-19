'use client';

import { useState } from 'react';
import { AlertTriangle, ClipboardList, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface ExtractionWarningsProps {
  validationIssues?: Record<string, string[]>;
  extractionWarnings?: string[];
  chunkStats?: { total: number; successful: number; failed: number };
}

/**
 * Sanitize developer-facing language from warning messages before display.
 * Replaces internal field references with user-friendly equivalents.
 */
const sanitizeWarningText = (warning: string): string => {
  return warning
    .replace(/\(see merge_conflicts for details\)/gi, '')
    .replace(/merge_conflicts/gi, 'data conflicts')
    .trim();
};

/**
 * Determine whether a warning is purely informational (resolved automatically)
 * versus an actionable issue that requires user attention.
 */
const isInformationalWarning = (warning: string): boolean => {
  const lower = warning.toLowerCase();
  return (
    lower.includes('detected and resolved') ||
    lower.includes('automatically resolved') ||
    lower.includes('conflicts detected and resolved')
  );
};

export default function ExtractionWarnings({
  validationIssues,
  extractionWarnings,
  chunkStats,
}: ExtractionWarningsProps) {
  const [showDetails, setShowDetails] = useState(false);

  const hasPartialExtraction = chunkStats && chunkStats.failed > 0;
  const hasValidationIssues =
    validationIssues && Object.keys(validationIssues).length > 0;

  // Don't render if there's nothing to show
  if (!hasPartialExtraction && !hasValidationIssues && !extractionWarnings?.length) {
    return null;
  }

  // Split extraction warnings into informational vs. actionable
  const informationalWarnings = (extractionWarnings ?? []).filter(isInformationalWarning);
  const actionableWarnings = (extractionWarnings ?? []).filter(
    (w) => !isInformationalWarning(w)
  );
  const hasInformational = informationalWarnings.length > 0;
  const hasActionable = actionableWarnings.length > 0 && !hasPartialExtraction;

  return (
    <div className="space-y-3">
      {/* Partial Extraction Warning — amber, actionable */}
      {hasPartialExtraction && (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">Partial Extraction</AlertTitle>
          <AlertDescription className="text-amber-700">
            {chunkStats.failed} of {chunkStats.total} document sections could not
            be fully processed. The analysis below is based on successfully
            extracted data.
          </AlertDescription>
        </Alert>
      )}

      {/* Informational Warnings — blue, resolved automatically */}
      {hasInformational && (
        <Alert className="bg-sky-50 border-sky-200">
          <Info className="h-4 w-4 text-sky-600" />
          <AlertTitle className="text-sky-800">Data Processing Notice</AlertTitle>
          <AlertDescription className="text-sky-700">
            <ul className="list-disc list-inside mt-1 space-y-1">
              {informationalWarnings.map((warning, index) => {
                const sanitized = sanitizeWarningText(warning);
                if (!sanitized) return null;
                return <li key={index}>{sanitized}</li>;
              })}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Actionable Extraction Warnings — amber */}
      {hasActionable && (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">Extraction Notice</AlertTitle>
          <AlertDescription className="text-amber-700">
            <ul className="list-disc list-inside mt-1 space-y-1">
              {actionableWarnings.map((warning, index) => {
                const sanitized = sanitizeWarningText(warning);
                if (!sanitized) return null;
                return <li key={index}>{sanitized}</li>;
              })}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Validation Issues */}
      {hasValidationIssues && (
        <Alert className="bg-yellow-50 border-yellow-200">
          <ClipboardList className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800 flex items-center gap-2">
            Data Quality Notes
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-yellow-700 hover:text-yellow-900 hover:bg-yellow-100"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? (
                <>
                  Hide details <ChevronUp className="h-3 w-3 ml-1" />
                </>
              ) : (
                <>
                  Show details <ChevronDown className="h-3 w-3 ml-1" />
                </>
              )}
            </Button>
          </AlertTitle>
          <AlertDescription className="text-yellow-700">
            {/* Summary line */}
            <p className="mb-2">
              {Object.keys(validationIssues).length} year
              {Object.keys(validationIssues).length > 1 ? 's have' : ' has'} data
              quality notes that may affect accuracy.
            </p>

            {/* Detailed issues per year */}
            {showDetails && (
              <ul className="space-y-2 mt-3 pt-3 border-t border-yellow-200">
                {Object.entries(validationIssues)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([year, issues]) => (
                    <li key={year}>
                      <span className="font-medium">{year}:</span>
                      <ul className="list-disc list-inside ml-4 text-sm">
                        {issues.map((issue, idx) => (
                          <li key={idx}>{issue}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { AlertTriangle, ClipboardList, ChevronDown, ChevronUp } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';

interface ExtractionWarningsProps {
  validationIssues?: Record<string, string[]>;
  extractionWarnings?: string[];
  chunkStats?: { total: number; successful: number; failed: number; skipped?: number };
}

export default function ExtractionWarnings({
  validationIssues,
  extractionWarnings,
  chunkStats,
}: ExtractionWarningsProps) {
  const [showDetails, setShowDetails] = useState(false);

  const hasPartialExtraction = chunkStats && (chunkStats.failed > 0 || (chunkStats.skipped ?? 0) > 0);
  const hasValidationIssues =
    validationIssues && Object.keys(validationIssues).length > 0;

  // Don't render if there's nothing to show
  if (!hasPartialExtraction && !hasValidationIssues && !extractionWarnings?.length) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Partial Extraction Warning */}
      {hasPartialExtraction && (
        <Alert className="bg-card border-border">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertTitle className="text-foreground">Partial Extraction</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            {chunkStats.failed > 0 && `${chunkStats.failed} of ${chunkStats.total} document sections failed to process.`}
            {(chunkStats.skipped ?? 0) > 0 && `${chunkStats.failed > 0 ? ' ' : ''}${chunkStats.skipped} sections were skipped due to an earlier fatal error.`}
            {' '}The analysis below is based on successfully extracted data.
          </AlertDescription>
        </Alert>
      )}

      {/* Extraction Warnings */}
      {extractionWarnings && extractionWarnings.length > 0 && (
        <Accordion type="single" collapsible className="bg-card border border-border rounded-lg px-4">
          <AccordionItem value="extraction-warnings" className="border-b-0">
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span className="font-medium text-foreground">Extraction Notice</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              <ul className="list-disc list-inside space-y-1">
                {extractionWarnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {/* Validation Issues */}
      {hasValidationIssues && (
        <Alert className="bg-card border-border">
          <ClipboardList className="h-4 w-4 text-warning" />
          <AlertTitle className="text-foreground flex items-center gap-2">
            Data Quality Notes
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-muted-foreground hover:text-foreground hover:bg-muted"
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
          <AlertDescription className="text-muted-foreground">
            {/* Summary line */}
            <p className="mb-2">
              {Object.keys(validationIssues).length} year
              {Object.keys(validationIssues).length > 1 ? 's have' : ' has'} data
              quality notes that may affect accuracy.
            </p>

            {/* Detailed issues per year */}
            {showDetails && (
              <ul className="space-y-2 mt-3 pt-3 border-t border-border">
                {Object.entries(validationIssues)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([year, issues]) => (
                    <li key={year}>
                      <span className="font-medium text-foreground">{year}:</span>
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

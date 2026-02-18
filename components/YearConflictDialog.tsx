'use client';

import { useState } from 'react';
import { Calendar, FileText, AlertTriangle } from 'lucide-react';
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
import type {
  YearConflict,
  ConflictResolution,
} from '@/lib/extraction-utils';

interface YearConflictDialogProps {
  open: boolean;
  conflicts: YearConflict[];
  onResolve: (resolutions: ConflictResolution) => void;
  onCancel: () => void;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Not available';

  // Handle YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  // Handle YYYY-MM format
  if (/^\d{4}-\d{2}$/.test(dateStr)) {
    const [year, month] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
    });
  }

  return dateStr;
}

export function YearConflictDialog({
  open,
  conflicts,
  onResolve,
  onCancel,
}: YearConflictDialogProps) {
  // Track user selections for each year
  const [selections, setSelections] = useState<ConflictResolution>(
    () => {
      // Default to recommendations
      const initial: ConflictResolution = {};
      for (const conflict of conflicts) {
        initial[conflict.year] =
          conflict.recommendation === 'use_new'
            ? 'overwrite'
            : 'keep';
      }
      return initial;
    },
  );

  const handleSelectionChange = (
    year: string,
    value: 'keep' | 'overwrite',
  ) => {
    setSelections((prev) => ({ ...prev, [year]: value }));
  };

  const handleApply = () => {
    onResolve(selections);
  };

  // Count how many are set to overwrite vs keep
  const overwriteCount = Object.values(selections).filter(
    (v) => v === 'overwrite',
  ).length;
  const keepCount = Object.values(selections).filter(
    (v) => v === 'keep',
  ).length;

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-amber-500" />
            Fiscal Year Conflict Detected
          </AlertDialogTitle>
          <AlertDialogDescription>
            The uploaded document contains data for years that already
            exist in this project. Choose which data to keep for each
            overlapping year.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 my-4 max-h-100 overflow-y-auto">
          {conflicts.map((conflict) => {
            const isNewRecommended =
              conflict.recommendation === 'use_new';
            const selection = selections[conflict.year];

            return (
              <div
                key={conflict.year}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-lg">
                    Fiscal Year {conflict.year}
                  </h4>
                  {isNewRecommended ? (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      New document recommended
                    </span>
                  ) : (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">
                      Keep existing recommended
                    </span>
                  )}
                </div>

                <p className="text-sm text-muted-foreground">
                  {conflict.reason}
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {/* Existing Document Option */}
                  <button
                    type="button"
                    onClick={() =>
                      handleSelectionChange(conflict.year, 'keep')
                    }
                    className={`p-3 rounded-lg border-2 text-left transition-colors ${
                      selection === 'keep'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 mt-0.5 text-gray-500" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {conflict.existingSource.file_name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          FY End:{' '}
                          {formatDate(
                            conflict.existingSource
                              .fiscal_year_end_date,
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Uploaded:{' '}
                          {new Date(
                            conflict.existingSource.extracted_at,
                          ).toLocaleDateString()}
                        </p>
                        {selection === 'keep' && (
                          <span className="inline-block mt-2 text-xs font-medium text-blue-600">
                            Selected
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* New Document Option */}
                  <button
                    type="button"
                    onClick={() =>
                      handleSelectionChange(
                        conflict.year,
                        'overwrite',
                      )
                    }
                    className={`p-3 rounded-lg border-2 text-left transition-colors ${
                      selection === 'overwrite'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 mt-0.5 text-gray-500" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {conflict.newSource.file_name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          FY End:{' '}
                          {formatDate(
                            conflict.newSource.fiscal_year_end_date,
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Uploaded:{' '}
                          {new Date(
                            conflict.newSource.extracted_at,
                          ).toLocaleDateString()}
                        </p>
                        {selection === 'overwrite' && (
                          <span className="inline-block mt-2 text-xs font-medium text-blue-600">
                            Selected
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground border-t pt-3">
          <AlertTriangle className="h-4 w-4" />
          <span>
            {overwriteCount > 0 && (
              <span className="text-blue-600 font-medium">
                {overwriteCount} year(s) will use new data
              </span>
            )}
            {overwriteCount > 0 && keepCount > 0 && ' • '}
            {keepCount > 0 && (
              <span className="text-amber-600 font-medium">
                {keepCount} year(s) will keep existing data
              </span>
            )}
          </span>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            Cancel Upload
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleApply}>
            Apply Selections
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  GROUND_TRUTH_STORAGE_KEY,
  getGroundTruth,
  type GroundTruthValues,
} from './ground-truth';
import {
  getAllMetricKeys,
  resolveMetricValue,
} from './accuracy';
import type { ComputedMetrics } from '@/types';

function storageKey(filename: string, year: string): string {
  return `${GROUND_TRUTH_STORAGE_KEY}_${filename}_${year}`;
}

function loadFromStorage(key: string): GroundTruthValues | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as GroundTruthValues;
  } catch {
    return null;
  }
}

function saveToStorage(key: string, values: GroundTruthValues): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(values));
}

export interface UseGroundTruthReturn {
  /** Current ground truth values */
  groundTruth: GroundTruthValues;
  /** Update a single field (dot-notation key) */
  updateField: (key: string, value: number | undefined) => void;
  /** Reset to seed data (from GROUND_TRUTH constant) */
  resetToSeed: () => void;
  /** Pre-fill undefined ground truth fields with extracted values */
  populateFromExtracted: (metrics: ComputedMetrics) => void;
  /** Whether ground truth has been modified from seed */
  isDirty: boolean;
  /** Export ground truth as JSON string */
  exportJSON: () => string;
  /** Import ground truth from JSON string. Returns true on success. */
  importJSON: (json: string) => boolean;
}

/**
 * React hook for managing ground truth values with localStorage persistence.
 *
 * On mount: checks localStorage for saved values, falls back to seed data from GROUND_TRUTH.
 * All mutations immediately write-through to localStorage.
 */
export function useGroundTruth(
  filename: string,
  fiscalYear: string,
): UseGroundTruthReturn {
  const key = storageKey(filename, fiscalYear);
  const seedEntry = getGroundTruth(filename, fiscalYear);
  const seedValues = seedEntry?.values ?? {};

  const [groundTruth, setGroundTruth] = useState<GroundTruthValues>(() => {
    return loadFromStorage(key) ?? { ...seedValues };
  });
  const [isDirty, setIsDirty] = useState<boolean>(() => {
    return loadFromStorage(key) !== null;
  });

  // Track key changes to reload
  const prevKeyRef = useRef(key);
  useEffect(() => {
    if (prevKeyRef.current !== key) {
      prevKeyRef.current = key;
      const stored = loadFromStorage(key);
      if (stored) {
        setGroundTruth(stored);
        setIsDirty(true);
      } else {
        const seed = getGroundTruth(filename, fiscalYear);
        setGroundTruth(seed?.values ?? {});
        setIsDirty(false);
      }
    }
  }, [key, filename, fiscalYear]);

  const updateField = useCallback(
    (fieldKey: string, value: number | undefined) => {
      setGroundTruth((prev) => {
        const next = { ...prev };
        if (value === undefined) {
          delete (next as Record<string, unknown>)[fieldKey];
        } else {
          (next as Record<string, unknown>)[fieldKey] = value;
        }
        saveToStorage(key, next);
        return next;
      });
      setIsDirty(true);
    },
    [key],
  );

  const resetToSeed = useCallback(() => {
    const seed = getGroundTruth(filename, fiscalYear);
    const values = seed?.values ?? {};
    setGroundTruth({ ...values });
    saveToStorage(key, values);
    setIsDirty(false);
  }, [filename, fiscalYear, key]);

  const populateFromExtracted = useCallback(
    (metrics: ComputedMetrics) => {
      setGroundTruth((prev) => {
        const next = { ...prev };
        const allKeys = getAllMetricKeys();

        for (const metricKey of allKeys) {
          // Only fill fields that are currently undefined/null
          if ((next as Record<string, unknown>)[metricKey] !== undefined) continue;

          const extracted = resolveMetricValue(metrics, metricKey);
          if (extracted !== null) {
            (next as Record<string, unknown>)[metricKey] = extracted;
          }
        }

        saveToStorage(key, next);
        return next;
      });
      setIsDirty(true);
    },
    [key],
  );

  const exportJSON = useCallback(() => {
    return JSON.stringify(groundTruth, null, 2);
  }, [groundTruth]);

  const importJSON = useCallback(
    (json: string): boolean => {
      try {
        const parsed = JSON.parse(json);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          return false;
        }
        // Validate: all values should be numbers or undefined
        const cleaned: GroundTruthValues = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'number') {
            (cleaned as Record<string, unknown>)[k] = v;
          }
        }
        setGroundTruth(cleaned);
        saveToStorage(key, cleaned);
        setIsDirty(true);
        return true;
      } catch {
        return false;
      }
    },
    [key],
  );

  return {
    groundTruth,
    updateField,
    resetToSeed,
    populateFromExtracted,
    isDirty,
    exportJSON,
    importJSON,
  };
}

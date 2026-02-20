'use client';

import { useReducer, useCallback, useEffect, useRef } from 'react';
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

// ─────────────────────────────────────────────────────────────────────────────
// Reducer
// ─────────────────────────────────────────────────────────────────────────────

interface State {
  groundTruth: GroundTruthValues;
  isDirty: boolean;
}

type Action =
  | { type: 'UPDATE_FIELD'; fieldKey: string; value: number | undefined; storageKey: string }
  | { type: 'RESET'; values: GroundTruthValues; storageKey: string }
  | { type: 'POPULATE'; metrics: ComputedMetrics; storageKey: string }
  | { type: 'IMPORT'; values: GroundTruthValues; storageKey: string }
  | { type: 'LOAD'; groundTruth: GroundTruthValues; isDirty: boolean };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'UPDATE_FIELD': {
      const next = { ...state.groundTruth };
      if (action.value === undefined) {
        delete (next as Record<string, unknown>)[action.fieldKey];
      } else {
        (next as Record<string, unknown>)[action.fieldKey] = action.value;
      }
      saveToStorage(action.storageKey, next);
      return { groundTruth: next, isDirty: true };
    }
    case 'RESET': {
      saveToStorage(action.storageKey, action.values);
      return { groundTruth: { ...action.values }, isDirty: false };
    }
    case 'POPULATE': {
      const next = { ...state.groundTruth };
      const allKeys = getAllMetricKeys();
      for (const metricKey of allKeys) {
        if ((next as Record<string, unknown>)[metricKey] !== undefined) continue;
        const extracted = resolveMetricValue(action.metrics, metricKey);
        if (extracted !== null) {
          (next as Record<string, unknown>)[metricKey] = extracted;
        }
      }
      saveToStorage(action.storageKey, next);
      return { groundTruth: next, isDirty: true };
    }
    case 'IMPORT': {
      saveToStorage(action.storageKey, action.values);
      return { groundTruth: action.values, isDirty: true };
    }
    case 'LOAD': {
      return { groundTruth: action.groundTruth, isDirty: action.isDirty };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export interface UseGroundTruthReturn {
  groundTruth: GroundTruthValues;
  updateField: (key: string, value: number | undefined) => void;
  resetToSeed: () => void;
  populateFromExtracted: (metrics: ComputedMetrics) => void;
  isDirty: boolean;
  exportJSON: () => string;
  importJSON: (json: string) => boolean;
}

export function useGroundTruth(
  filename: string,
  fiscalYear: string,
): UseGroundTruthReturn {
  const key = storageKey(filename, fiscalYear);
  const seedEntry = getGroundTruth(filename, fiscalYear);
  const seedValues = seedEntry?.values ?? {};

  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const stored = loadFromStorage(key);
    return {
      groundTruth: stored ?? { ...seedValues },
      isDirty: stored !== null,
    };
  });

  // Reload when key changes (different document or year)
  const prevKeyRef = useRef(key);
  useEffect(() => {
    if (prevKeyRef.current !== key) {
      prevKeyRef.current = key;
      const stored = loadFromStorage(key);
      if (stored) {
        dispatch({ type: 'LOAD', groundTruth: stored, isDirty: true });
      } else {
        const seed = getGroundTruth(filename, fiscalYear);
        dispatch({ type: 'LOAD', groundTruth: seed?.values ?? {}, isDirty: false });
      }
    }
  }, [key, filename, fiscalYear]);

  const updateField = useCallback(
    (fieldKey: string, value: number | undefined) => {
      dispatch({ type: 'UPDATE_FIELD', fieldKey, value, storageKey: key });
    },
    [key],
  );

  const resetToSeed = useCallback(() => {
    const seed = getGroundTruth(filename, fiscalYear);
    dispatch({ type: 'RESET', values: seed?.values ?? {}, storageKey: key });
  }, [filename, fiscalYear, key]);

  const populateFromExtracted = useCallback(
    (metrics: ComputedMetrics) => {
      dispatch({ type: 'POPULATE', metrics, storageKey: key });
    },
    [key],
  );

  const exportJSON = useCallback(() => {
    return JSON.stringify(state.groundTruth, null, 2);
  }, [state.groundTruth]);

  const importJSON = useCallback(
    (json: string): boolean => {
      try {
        const parsed = JSON.parse(json);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          return false;
        }
        const cleaned: GroundTruthValues = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'number') {
            (cleaned as Record<string, unknown>)[k] = v;
          }
        }
        dispatch({ type: 'IMPORT', values: cleaned, storageKey: key });
        return true;
      } catch {
        return false;
      }
    },
    [key],
  );

  return {
    groundTruth: state.groundTruth,
    updateField,
    resetToSeed,
    populateFromExtracted,
    isDirty: state.isDirty,
    exportJSON,
    importJSON,
  };
}

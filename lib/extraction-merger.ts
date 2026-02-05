/**
 * Extraction merger utilities
 * Consolidates partial JSON extractions from multiple chunks
 *
 * Uses "first non-null wins" merge strategy. Combined with sequential
 * chunk processing (processChunksSequentially), this produces deterministic
 * results since chunk order is guaranteed.
 */

/**
 * Merge multiple extraction results into a single consolidated object
 * Handles nested objects (debt_components, fixed_charges, adjusted_ebitda_components)
 * @param extractions - Array of extraction results from AI
 * @returns Merged metrics by year
 */
export function mergeExtractions(
  extractions: any[]
): Record<string, any> {
  const merged: Record<string, any> = {};

  for (const obj of extractions) {
    if (obj && typeof obj === 'object' && obj.metrics_by_year) {
      for (const [yr, metrics] of Object.entries<any>(obj.metrics_by_year)) {
        if (!merged[yr]) {
          // First occurrence of this year - copy all metrics
          merged[yr] = { ...metrics };

          // Deep copy nested objects if present
          if (metrics.adjusted_ebitda_components) {
            merged[yr].adjusted_ebitda_components = {
              ...metrics.adjusted_ebitda_components,
            };
          }
          if (metrics.debt_components) {
            merged[yr].debt_components = { ...metrics.debt_components };
          }
          if (metrics.fixed_charges) {
            merged[yr].fixed_charges = { ...metrics.fixed_charges };
          }
        } else {
          // Merge with existing year data
          for (const key of Object.keys(metrics)) {
            if (key === 'adjusted_ebitda_components' && metrics[key] != null) {
              // Merge adjusted_ebitda_components
              merged[yr].adjusted_ebitda_components = mergeNestedObject(
                merged[yr].adjusted_ebitda_components,
                metrics[key]
              );
            } else if (key === 'debt_components' && metrics[key] != null) {
              // Merge debt_components
              merged[yr].debt_components = mergeNestedObject(
                merged[yr].debt_components,
                metrics[key]
              );
            } else if (key === 'fixed_charges' && metrics[key] != null) {
              // Merge fixed_charges
              merged[yr].fixed_charges = mergeNestedObject(
                merged[yr].fixed_charges,
                metrics[key]
              );
            } else if (merged[yr][key] == null && metrics[key] != null) {
              // Only overwrite if current value is null and new value exists
              merged[yr][key] = metrics[key];
            }
          }
        }
      }
    }
  }

  return merged;
}

/**
 * Merge two nested objects, keeping non-null values
 * @param existing - Existing object (may be null/undefined)
 * @param incoming - Incoming object to merge
 * @returns Merged object
 */
function mergeNestedObject(
  existing: Record<string, any> | null | undefined,
  incoming: Record<string, any>
): Record<string, any> {
  if (!existing) {
    return { ...incoming };
  }

  const merged = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    if (merged[key] == null && value != null) {
      merged[key] = value;
    }
  }

  return merged;
}

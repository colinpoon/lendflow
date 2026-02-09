/**
 * Extraction merger utilities
 * Consolidates partial JSON extractions from multiple chunks
 *
 * Uses "first non-null wins" merge strategy. Combined with sequential
 * chunk processing (processChunksSequentially), this produces deterministic
 * results since chunk order is guaranteed.
 */

// Currency metrics that should be in thousands (not raw dollars)
const CURRENCY_METRICS = [
  'revenue',
  'net_income',
  'expenses',
  'interest',
  'taxes',
  'depreciation_amortization',
  'depreciation_equipment',
  'depreciation_rou',
  'depreciation_other',
  'ebitda',
  'reported_adjusted_ebitda',
  'shareholders_equity',
  'capital_expenditures',
  'proceeds_from_long_term_debt',
  'cash_taxes_paid',
  'distributions_paid',
  'ttm_principal_payments',
  'ttm_interest_expense',
  'repayment_of_debt',
  'payment_of_lease_liability',
  'cash_interest_paid',
  'non_cash_interest_expense',
  'total_debt',
  'senior_debt',
  'current_assets',
  'current_liabilities',
];

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

/**
 * Normalize scale mismatches across years
 * Detects when one year's value is ~1000x larger than others (raw dollars vs thousands)
 * and corrects by dividing by 1000
 *
 * @param merged - Merged metrics by year
 * @returns Normalized metrics with consistent scaling
 */
export function normalizeScaleMismatch(
  merged: Record<string, any>
): Record<string, any> {
  const years = Object.keys(merged);
  if (years.length < 2) return merged; // Need 2+ years to detect mismatch

  const normalized = JSON.parse(JSON.stringify(merged)); // Deep clone

  for (const metric of CURRENCY_METRICS) {
    // Collect non-null values for this metric across years
    const values: { year: string; value: number }[] = [];
    for (const yr of years) {
      const val = normalized[yr]?.[metric];
      if (typeof val === 'number' && val !== 0) {
        values.push({ year: yr, value: val });
      }
    }

    if (values.length < 2) continue; // Need 2+ values to compare

    // Sort by absolute value to find min and max
    const sorted = [...values].sort((a, b) => Math.abs(a.value) - Math.abs(b.value));
    const minAbs = Math.abs(sorted[0].value);
    const maxAbs = Math.abs(sorted[sorted.length - 1].value);

    // If max is 500-2000x larger than min, the max values are likely in raw dollars
    const ratio = maxAbs / minAbs;
    if (ratio >= 500 && ratio <= 2000) {
      // Find all values that are close to the max (within 10x) and divide them by 1000
      for (const { year, value } of values) {
        const absValue = Math.abs(value);
        if (absValue > minAbs * 100) {
          // This value is an outlier (much larger than the min)
          const corrected = value / 1000;
          console.log(
            `⚠️ Scale mismatch detected: ${metric} in ${year} is ~${(absValue / minAbs).toFixed(0)}x larger than smallest value. ` +
              `Correcting ${value.toLocaleString()} → ${corrected.toLocaleString()} (÷1000)`
          );
          normalized[year][metric] = corrected;
        }
      }
    }
  }

  return normalized;
}

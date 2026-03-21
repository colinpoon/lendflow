/**
 * Formatting utilities for financial data display
 * Centralized formatting functions with consistent null handling
 */

// ─────────────────────────────────────────────────────────────────────────────
// Currency Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format currency values displayed in thousands — always shows K suffix
 * @param value - The value in thousands (e.g., 24889 = $24,889K)
 * @returns Formatted string like "$500K", "$24,889K" or "—" for null/undefined
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value == null || (typeof value === 'number' && isNaN(value))) {
    return '—';
  }

  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  return `${sign}$${Math.round(abs).toLocaleString('en-US')}K`;
}

/**
 * Format signed currency with + or - prefix for adjustments
 * @param value - The value in thousands
 * @param isSubtraction - Whether this represents a subtraction
 * @returns Formatted string like "+ $1,234K" or "- $500K"
 */
export function formatSignedCurrency(
  value: number | null | undefined,
  isSubtraction = false
): string {
  if (value == null || value === 0) return '$0K';
  const prefix = isSubtraction ? '- ' : '+ ';
  return prefix + formatCurrency(Math.abs(value));
}

// ─────────────────────────────────────────────────────────────────────────────
// Ratio & Percentage Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format ratio values with 'x' suffix
 * @param value - The ratio value
 * @returns Formatted string like "2.50x" or "N/A"
 */
export function formatRatio(value: number | null | undefined): string {
  if (value == null || (typeof value === 'number' && isNaN(value))) {
    return 'N/A';
  }
  return `${value.toFixed(2)}x`;
}

/**
 * Format percentage values (expects decimal input)
 * @param value - The decimal value (0.5 = 50%)
 * @returns Formatted string like "50%" or "N/A"
 */
export function formatPercent(value: number | null | undefined): string {
  if (value == null || (typeof value === 'number' && isNaN(value))) {
    return 'N/A';
  }
  return `${(value * 100).toFixed(0)}%`;
}

/**
 * Format profit margin (handles both decimal and percentage inputs)
 * @param value - The margin value
 * @returns Formatted string like "25.5%" or "N/A"
 */
export function formatMargin(value: number | null | undefined): string {
  if (value == null || (typeof value === 'number' && isNaN(value))) {
    return 'N/A';
  }
  // If value is between -1 and 1, treat as decimal
  if (value <= 1 && value >= -1) {
    return `${(value * 100).toFixed(1)}%`;
  }
  // Otherwise, treat as percentage
  return `${value.toFixed(1)}%`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Text Sanitization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sanitize AI-generated observation text
 * Fixes common formatting issues with years being formatted as currency
 * @param text - The text to sanitize
 * @returns Cleaned text
 */
export function sanitizeObservationText(text: string): string {
  if (!text) return text;

  return text
    // Revert common misformatting: "$2,023.00" → "2023"
    .replace(/\$2,0(2[0-9]|1[0-9]|0[0-9])\.00/g, (_, yr) => `20${yr}`)
    .replace(/\$1,9(9[0-9])\.00/g, (_, yr) => `19${yr}`)
    // Remove any stray $ before 4-digit years
    .replace(/\$?(\b(19|20)\d{2})\.00/g, '$1');
}


/**
 * Format currency values displayed in thousands (as commonly reported in financial statements)
 * @param value - The value in thousands
 * @returns Formatted string like "$1,234K" or "—" for null/undefined
 */
export function fmtCurrency(
  value: number | null | undefined
): string {
  if (typeof value !== 'number' || isNaN(value)) return '—';
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}K`;
}
export function sanitizeObservationText(text: string): string {
  if (!text) return text;

  return (
    text
      // Revert common misformatting: "$2,023.00" → "2023"
      .replace(
        /\$2,0(2[0-9]|1[0-9]|0[0-9])\.00/g,
        (_, yr) => `20${yr}`
      )
      .replace(/\$1,9(9[0-9])\.00/g, (_, yr) => `19${yr}`)
      // Remove any stray $ before 4-digit years
      .replace(/\$?(\b(19|20)\d{2})\.00/g, '$1')
  );
}

export function fmtCurrency(
  value: number | null | undefined
): string {
  if (typeof value !== 'number' || isNaN(value)) return '—';
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

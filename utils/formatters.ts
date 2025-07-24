export const fmtCurrency = (n: number | null | undefined): string =>
  typeof n === 'number'
    ? `$${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    : '—';

export const fmtPercent = (n: number | null | undefined): string =>
  typeof n === 'number' ? `${n.toFixed(2)}%` : '—';

export const fmtScore = (n: number | null | undefined): string =>
  typeof n === 'number'
    ? n > 100
      ? (n / 100).toFixed(1)
      : n > 10
      ? (n / 10).toFixed(1)
      : n.toFixed(1)
    : '—';

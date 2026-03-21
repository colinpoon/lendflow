// ─────────────────────────────────────────────────────────────────────────────
// Hero Metric helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getRatioStatus(value: number | null, thresholds: { good: number; fair: number; direction: 'above' | 'below' }): string {
  if (value === null) return 'text-muted-foreground';
  if (thresholds.direction === 'above') {
    if (value >= thresholds.good) return 'text-success';
    if (value >= thresholds.fair) return 'text-warning';
    return 'text-error';
  }
  if (value <= thresholds.good) return 'text-success';
  if (value <= thresholds.fair) return 'text-warning';
  return 'text-error';
}

export function formatRatio(value: number | null, suffix = 'x'): string {
  if (value === null || isNaN(value) || !isFinite(value)) return '--';
  return `${value.toFixed(2)}${suffix}`;
}

export function formatPercent(value: number | null): string {
  if (value === null || isNaN(value) || !isFinite(value)) return '--';
  return `${(value * 100).toFixed(1)}%`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero Metric Card
// ─────────────────────────────────────────────────────────────────────────────

export default function MetricCard({
  label,
  value,
  subtitle,
  colorClass,
}: {
  label: string;
  value: string;
  subtitle?: string;
  colorClass?: string;
}) {
  // Dark mode: tinted gradient per status; Light mode: neutral white card
  const darkGradientMap: Record<string, string> = {
    'text-success': 'dark:from-emerald-950 dark:via-emerald-900/80 dark:to-zinc-950',
    'text-warning': 'dark:from-amber-950 dark:via-amber-900/80 dark:to-zinc-950',
    'text-error': 'dark:from-red-950 dark:via-red-900/80 dark:to-zinc-950',
  };
  const darkGradient = (colorClass && darkGradientMap[colorClass]) || 'dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-950';

  // Subtitle color: semantic tints for dark, muted gray for light
  const darkSubtitleMap: Record<string, string> = {
    'text-success': 'dark:text-emerald-300',
    'text-warning': 'dark:text-amber-300',
    'text-error': 'dark:text-red-300',
  };
  const subtitleColor = [
    'text-muted-foreground',
    (colorClass && darkSubtitleMap[colorClass]) || 'dark:text-zinc-400',
  ].join(' ');

  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-5 flex flex-col justify-between min-h-[140px] shadow-sm
        bg-card border border-border
        dark:bg-gradient-to-br dark:shadow-lg
        ${darkGradient}`}
    >
      {/* Noise texture overlay — visible only in dark mode where it adds texture without muddying light surfaces */}
      <div className="absolute inset-0 opacity-0 dark:opacity-[0.03] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNhKSIgb3BhY2l0eT0iMSIvPjwvc3ZnPg==')]" />
      {/* Glow orb — dark mode only */}
      <div className="absolute -top-12 -left-12 h-32 w-32 rounded-full opacity-0 dark:opacity-100 bg-foreground/[0.07] blur-2xl" />

      <p className="relative text-[11px] uppercase tracking-normal font-medium text-muted-foreground">
        {label}
      </p>
      <div className="relative mt-auto">
        <p className="text-3xl font-bold tabular-nums tracking-tight text-foreground">
          {value}
        </p>
        {subtitle && (
          <p className={`text-xs font-medium mt-1 ${subtitleColor}`}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

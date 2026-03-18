/**
 * Design Tokens - Lendflow Design System
 *
 * Centralized design tokens for colors, typography, spacing, and shadows.
 * These tokens ensure visual consistency across the application and provide
 * a single source of truth for the design system.
 *
 * Usage:
 * - Import tokens directly: `import { colors, typography } from '@/lib/design-tokens'`
 * - Use CSS variables in components: `className="text-primary bg-primary/10"`
 * - Use utility functions: `getRiskColor('excellent')`
 */

// ─────────────────────────────────────────────────────────────────────────────
// Brand Colors
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Primary brand color - Professional blue conveying trust and stability
 * Used for primary actions, links, and brand elements
 */
export const brand = {
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af', // Main brand color
    900: '#1e3a8a',
    950: '#172554',
  },
  /** Accent color - Teal for data visualization and secondary actions */
  accent: {
    50: '#ecfeff',
    100: '#cffafe',
    200: '#a5f3fc',
    300: '#67e8f9',
    400: '#22d3ee',
    500: '#06b6d4',
    600: '#0891b2', // Main accent
    700: '#0e7490',
    800: '#155e75',
    900: '#164e63',
    950: '#083344',
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Semantic Colors - Risk & Status
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Semantic colors for risk levels and status indicators
 * Aligned with financial industry standards
 */
export const semantic = {
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a', // Primary success
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706', // Primary warning
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626', // Primary error
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },
  info: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6', // Primary info
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Neutral Colors - Improved Contrast
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Neutral scale with WCAG AA compliant contrast ratios
 * neutral-600+ should be used for body text on white backgrounds
 */
export const neutral = {
  0: '#ffffff',
  50: '#fafafa',
  100: '#f5f5f5',
  200: '#e5e5e5',
  300: '#d4d4d4',
  400: '#a3a3a3',
  500: '#737373', // Use sparingly - low contrast
  600: '#525252', // Minimum for small text (4.6:1)
  700: '#404040', // Recommended for body text (7:1)
  800: '#262626',
  900: '#171717',
  950: '#0a0a0a',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Risk Level Colors - Financial Risk Assessment
// ─────────────────────────────────────────────────────────────────────────────

export type RiskLevel = 'excellent' | 'good' | 'adequate' | 'weak' | 'poor';

export interface RiskColorConfig {
  bg: string;
  bgSubtle: string;
  text: string;
  textDark: string;
  border: string;
  hex: string;
}

/**
 * Risk level color configurations
 * Used for Covenant FCCR, EBITDA Coverage, Debt/EBITDA, and other financial metrics
 */
export const riskColors: Record<RiskLevel, RiskColorConfig> = {
  excellent: {
    bg: 'bg-emerald-100',
    bgSubtle: 'bg-emerald-50',
    text: 'text-emerald-700',
    textDark: 'text-emerald-800',
    border: 'border-emerald-300',
    hex: '#059669',
  },
  good: {
    bg: 'bg-green-100',
    bgSubtle: 'bg-green-50',
    text: 'text-green-700',
    textDark: 'text-green-800',
    border: 'border-green-300',
    hex: '#16a34a',
  },
  adequate: {
    bg: 'bg-amber-100',
    bgSubtle: 'bg-amber-50',
    text: 'text-amber-700',
    textDark: 'text-amber-800',
    border: 'border-amber-300',
    hex: '#d97706',
  },
  weak: {
    bg: 'bg-orange-100',
    bgSubtle: 'bg-orange-50',
    text: 'text-orange-700',
    textDark: 'text-orange-800',
    border: 'border-orange-300',
    hex: '#ea580c',
  },
  poor: {
    bg: 'bg-red-100',
    bgSubtle: 'bg-red-50',
    text: 'text-red-700',
    textDark: 'text-red-800',
    border: 'border-red-300',
    hex: '#dc2626',
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Typography Scale
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Typography tokens for consistent text styling
 * Based on a 1.25 modular scale (Major Third)
 */
export const typography = {
  /** Font families */
  fontFamily: {
    sans: 'var(--font-geist-sans), system-ui, sans-serif',
    mono: 'var(--font-geist-mono), ui-monospace, monospace',
  },
  /** Font sizes with recommended line heights */
  fontSize: {
    xs: { size: '0.75rem', lineHeight: '1rem' },      // 12px
    sm: { size: '0.875rem', lineHeight: '1.25rem' },  // 14px
    base: { size: '1rem', lineHeight: '1.5rem' },     // 16px
    lg: { size: '1.125rem', lineHeight: '1.75rem' },  // 18px
    xl: { size: '1.25rem', lineHeight: '1.75rem' },   // 20px
    '2xl': { size: '1.5rem', lineHeight: '2rem' },    // 24px
    '3xl': { size: '1.875rem', lineHeight: '2.25rem' }, // 30px
    '4xl': { size: '2.25rem', lineHeight: '2.5rem' }, // 36px
  },
  /** Font weights */
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  /** Letter spacing */
  letterSpacing: {
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Spacing Scale
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Spacing tokens based on 4px base unit
 * Use for margin, padding, and gap values
 */
export const spacing = {
  px: '1px',
  0: '0',
  0.5: '0.125rem',  // 2px
  1: '0.25rem',     // 4px
  1.5: '0.375rem',  // 6px
  2: '0.5rem',      // 8px
  2.5: '0.625rem',  // 10px
  3: '0.75rem',     // 12px
  3.5: '0.875rem',  // 14px
  4: '1rem',        // 16px
  5: '1.25rem',     // 20px
  6: '1.5rem',      // 24px
  7: '1.75rem',     // 28px
  8: '2rem',        // 32px
  9: '2.25rem',     // 36px
  10: '2.5rem',     // 40px
  12: '3rem',       // 48px
  14: '3.5rem',     // 56px
  16: '4rem',       // 64px
  20: '5rem',       // 80px
  24: '6rem',       // 96px
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Shadow Scale
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shadow tokens for elevation hierarchy
 */
export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  base: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Border Radius
// ─────────────────────────────────────────────────────────────────────────────

export const borderRadius = {
  none: '0',
  sm: '0.125rem',   // 2px
  base: '0.25rem',  // 4px
  md: '0.375rem',   // 6px
  lg: '0.5rem',     // 8px
  xl: '0.75rem',    // 12px
  '2xl': '1rem',    // 16px
  '3xl': '1.5rem',  // 24px
  full: '9999px',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get risk color configuration for a given level
 */
export function getRiskColor(level: RiskLevel): RiskColorConfig {
  return riskColors[level];
}

/**
 * Determine risk level for Covenant FCCR (lender-defined cash flow coverage ratio)
 * Higher is better
 */
export function getFCCRRiskLevel(value: number | null | undefined): RiskLevel {
  if (value == null) return 'adequate';
  if (value >= 2.0) return 'excellent';
  if (value >= 1.5) return 'good';
  if (value >= 1.25) return 'adequate';
  if (value >= 1.0) return 'weak';
  return 'poor';
}

/**
 * Determine risk level for EBITDA Coverage Ratio (Adj. EBITDA / Total Debt Service)
 * Higher is better
 */
export function getDSCRRiskLevel(value: number | null | undefined): RiskLevel {
  if (value == null) return 'adequate';
  if (value >= 2.0) return 'excellent';
  if (value >= 1.5) return 'good';
  if (value >= 1.25) return 'adequate';
  if (value >= 1.0) return 'weak';
  return 'poor';
}

/**
 * Determine risk level for Senior Debt / EBITDA ratio
 * Lower is better
 */
export function getDebtEBITDARiskLevel(value: number | null | undefined): RiskLevel {
  if (value == null) return 'adequate';
  if (value <= 1.5) return 'excellent';
  if (value <= 2.5) return 'good';
  if (value <= 3.0) return 'adequate';
  if (value <= 4.0) return 'weak';
  return 'poor';
}

/**
 * Determine risk level for Total Debt / Capital ratio
 * Lower is better (value expected as decimal, e.g., 0.5 for 50%)
 */
export function getDebtCapitalRiskLevel(value: number | null | undefined): RiskLevel {
  if (value == null) return 'adequate';
  if (value < 0.3) return 'excellent';
  if (value <= 0.5) return 'good';
  if (value <= 0.6) return 'adequate';
  if (value <= 0.7) return 'weak';
  return 'poor';
}

/**
 * Get combined Tailwind classes for a risk level
 */
export function getRiskClasses(
  level: RiskLevel,
  options: { withBg?: boolean; withBorder?: boolean } = {}
): string {
  const config = riskColors[level];
  const classes = [config.text];

  if (options.withBg) {
    classes.push(config.bgSubtle);
  }
  if (options.withBorder) {
    classes.push(config.border, 'border');
  }

  return classes.join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS Variable Mappings (for globals.css)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * OKLCH color values for CSS variables
 * These are used in globals.css for the Tailwind theme
 */
export const cssVariables = {
  light: {
    // Brand
    primary: 'oklch(0.45 0.12 250)',           // #1e40af - Professional blue
    primaryForeground: 'oklch(0.985 0 0)',     // White
    accent: 'oklch(0.55 0.10 200)',            // #0891b2 - Teal
    accentForeground: 'oklch(0.985 0 0)',      // White

    // Semantic
    success: 'oklch(0.55 0.15 155)',           // #059669 - Emerald
    successForeground: 'oklch(0.985 0 0)',
    warning: 'oklch(0.65 0.15 75)',            // #d97706 - Amber
    warningForeground: 'oklch(0.15 0 0)',
    error: 'oklch(0.55 0.22 25)',              // #dc2626 - Red
    errorForeground: 'oklch(0.985 0 0)',
    info: 'oklch(0.60 0.15 250)',              // #3b82f6 - Blue
    infoForeground: 'oklch(0.985 0 0)',

    // Neutral (improved contrast)
    background: 'oklch(1 0 0)',                // White
    foreground: 'oklch(0.15 0 0)',             // Near black
    muted: 'oklch(0.96 0 0)',                  // Light gray bg
    mutedForeground: 'oklch(0.45 0 0)',        // Improved from 0.556
    border: 'oklch(0.90 0 0)',                 // Slightly darker border
    ring: 'oklch(0.45 0.12 250)',              // Match primary
  },
  dark: {
    primary: 'oklch(0.65 0.15 250)',
    primaryForeground: 'oklch(0.15 0 0)',
    accent: 'oklch(0.65 0.12 200)',
    accentForeground: 'oklch(0.15 0 0)',
    success: 'oklch(0.65 0.18 155)',
    successForeground: 'oklch(0.15 0 0)',
    warning: 'oklch(0.75 0.15 75)',
    warningForeground: 'oklch(0.15 0 0)',
    error: 'oklch(0.65 0.22 25)',
    errorForeground: 'oklch(0.15 0 0)',
    info: 'oklch(0.70 0.15 250)',
    infoForeground: 'oklch(0.15 0 0)',
    background: 'oklch(0.15 0 0)',
    foreground: 'oklch(0.95 0 0)',
    muted: 'oklch(0.25 0 0)',
    mutedForeground: 'oklch(0.65 0 0)',
    border: 'oklch(0.30 0 0)',
    ring: 'oklch(0.65 0.15 250)',
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Export All
// ─────────────────────────────────────────────────────────────────────────────

export const designTokens = {
  brand,
  semantic,
  neutral,
  riskColors,
  typography,
  spacing,
  shadows,
  borderRadius,
  cssVariables,
} as const;

export default designTokens;

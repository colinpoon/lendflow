import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Typography Components
 *
 * A consistent typography system for Lendflow.
 * Based on a modular scale with clear hierarchy.
 *
 * Usage:
 * ```tsx
 * <H1>Page Title</H1>
 * <H2>Section Header</H2>
 * <Body>Regular paragraph text</Body>
 * <Body size="sm">Small text</Body>
 * <Metric size="xl">$1,234,567</Metric>
 * <Label>Form Label</Label>
 * ```
 */

// ─────────────────────────────────────────────────────────────────────────────
// Heading Components
// ─────────────────────────────────────────────────────────────────────────────

const headingVariants = cva('font-bold tracking-tight text-foreground', {
  variants: {
    level: {
      1: 'text-4xl leading-tight',
      2: 'text-3xl leading-tight',
      3: 'text-2xl leading-snug',
      4: 'text-xl leading-snug',
      5: 'text-lg leading-normal',
      6: 'text-base leading-normal font-semibold',
    },
  },
  defaultVariants: {
    level: 1,
  },
});

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

interface HeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof headingVariants> {
  level?: HeadingLevel;
  as?: `h${HeadingLevel}`;
}

/**
 * Flexible Heading component with semantic HTML
 */
export function Heading({
  level = 1,
  as,
  className,
  children,
  ...props
}: HeadingProps) {
  const Tag = as || (`h${level}` as `h${HeadingLevel}`);

  return (
    <Tag className={cn(headingVariants({ level }), className)} {...props}>
      {children}
    </Tag>
  );
}

// Convenience components for each heading level
export function H1({
  className,
  ...props
}: Omit<HeadingProps, 'level' | 'as'>) {
  return <Heading level={1} className={className} {...props} />;
}

export function H2({
  className,
  ...props
}: Omit<HeadingProps, 'level' | 'as'>) {
  return <Heading level={2} className={className} {...props} />;
}

export function H3({
  className,
  ...props
}: Omit<HeadingProps, 'level' | 'as'>) {
  return <Heading level={3} className={className} {...props} />;
}

export function H4({
  className,
  ...props
}: Omit<HeadingProps, 'level' | 'as'>) {
  return <Heading level={4} className={className} {...props} />;
}

export function H5({
  className,
  ...props
}: Omit<HeadingProps, 'level' | 'as'>) {
  return <Heading level={5} className={className} {...props} />;
}

export function H6({
  className,
  ...props
}: Omit<HeadingProps, 'level' | 'as'>) {
  return <Heading level={6} className={className} {...props} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Body Text Components
// ─────────────────────────────────────────────────────────────────────────────

const bodyVariants = cva('text-foreground', {
  variants: {
    size: {
      xs: 'text-xs leading-normal',
      sm: 'text-sm leading-normal',
      base: 'text-base leading-relaxed',
      lg: 'text-lg leading-relaxed',
    },
    weight: {
      normal: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
    },
    muted: {
      true: 'text-muted-foreground',
      false: '',
    },
  },
  defaultVariants: {
    size: 'base',
    weight: 'normal',
    muted: false,
  },
});

interface BodyProps
  extends React.HTMLAttributes<HTMLParagraphElement>,
    VariantProps<typeof bodyVariants> {}

/**
 * Body text component for paragraphs and general text
 */
export function Body({
  size,
  weight,
  muted,
  className,
  ...props
}: BodyProps) {
  return (
    <p
      className={cn(bodyVariants({ size, weight, muted }), className)}
      {...props}
    />
  );
}

/**
 * Span variant for inline text
 */
export function Text({
  size,
  weight,
  muted,
  className,
  ...props
}: Omit<BodyProps, 'as'> & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(bodyVariants({ size, weight, muted }), className)}
      {...props}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Metric Component (for financial data)
// ─────────────────────────────────────────────────────────────────────────────

const metricVariants = cva('font-mono tabular-nums text-foreground', {
  variants: {
    size: {
      sm: 'text-sm',
      base: 'text-base',
      lg: 'text-xl font-semibold',
      xl: 'text-3xl font-bold',
      '2xl': 'text-4xl font-bold',
    },
    trend: {
      positive: 'text-success',
      negative: 'text-error',
      neutral: 'text-foreground',
    },
  },
  defaultVariants: {
    size: 'base',
    trend: 'neutral',
  },
});

interface MetricProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof metricVariants> {}

/**
 * Metric component for displaying financial numbers
 * Uses monospace font for alignment in tables
 */
export function Metric({ size, trend, className, ...props }: MetricProps) {
  return (
    <span className={cn(metricVariants({ size, trend }), className)} {...props} />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Label Component
// ─────────────────────────────────────────────────────────────────────────────

const labelVariants = cva(
  'text-xs font-medium uppercase tracking-wider text-muted-foreground',
  {
    variants: {
      size: {
        sm: 'text-[10px]',
        base: 'text-xs',
        lg: 'text-sm',
      },
    },
    defaultVariants: {
      size: 'base',
    },
  }
);

interface TypographyLabelProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof labelVariants> {}

/**
 * Label component for table headers, form labels, and categories
 */
export function TypographyLabel({ size, className, ...props }: TypographyLabelProps) {
  return <span className={cn(labelVariants({ size }), className)} {...props} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Code Component
// ─────────────────────────────────────────────────────────────────────────────

interface CodeProps extends React.HTMLAttributes<HTMLElement> {
  inline?: boolean;
}

/**
 * Code component for displaying code snippets
 */
export function Code({ inline = true, className, ...props }: CodeProps) {
  if (inline) {
    return (
      <code
        className={cn(
          'rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground',
          className
        )}
        {...props}
      />
    );
  }

  return (
    <pre
      className={cn(
        'overflow-auto rounded-lg bg-muted p-4 font-mono text-sm',
        className
      )}
    >
      <code {...props} />
    </pre>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section Header Component
// ─────────────────────────────────────────────────────────────────────────────

interface SectionHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/**
 * Section header with optional description and action
 */
export function SectionHeader({
  title,
  description,
  action,
  className,
  ...props
}: SectionHeaderProps) {
  return (
    <div
      className={cn('flex items-start justify-between gap-4', className)}
      {...props}
    >
      <div className="space-y-1">
        <H3>{title}</H3>
        {description && (
          <Body size="sm" muted>
            {description}
          </Body>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Table Header Label
// ─────────────────────────────────────────────────────────────────────────────

interface TableHeaderProps extends React.ThHTMLAttributes<HTMLTableCellElement> {}

/**
 * Styled table header cell with consistent typography
 */
export function TableHeader({ className, children, ...props }: TableHeaderProps) {
  return (
    <th
      className={cn(
        'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground',
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export {
  headingVariants,
  bodyVariants,
  metricVariants,
  labelVariants,
};

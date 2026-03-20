'use client';

/**
 * CovenantParametersPanel
 *
 * A compact control panel that lets analysts adjust the three covenant
 * configuration parameters — CapEx treatment, lease debt treatment, and
 * operating lease treatment — and instantly see updated ratios without
 * re-running an AI extraction.
 *
 * All Tailwind classes use semantic theme tokens (text-foreground,
 * bg-primary, bg-muted, etc.) so the panel works correctly in both light
 * and dark modes without any hardcoded color values.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SlidersHorizontal } from 'lucide-react';
import type { CovenantConfig } from '@/lib/calculations/recalculate';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface CovenantParametersPanelProps {
  config: CovenantConfig;
  onConfigChange: (config: CovenantConfig) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

interface ButtonGroupOption<T extends string> {
  value: T;
  label: string;
  description: string;
}

function ButtonGroup<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: ButtonGroupOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const isActive = opt.value === selected;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            title={opt.description}
            className={[
              'flex flex-col items-start px-3 py-2 rounded-md border text-xs transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-foreground border-border hover:bg-muted',
            ].join(' ')}
          >
            <span className="font-semibold leading-none">{opt.label}</span>
            <span
              className={[
                'mt-0.5 text-[10px] leading-none',
                isActive ? 'text-primary-foreground/70' : 'text-muted-foreground',
              ].join(' ')}
            >
              {opt.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Option definitions
// ─────────────────────────────────────────────────────────────────────────────

type CapexMode = 'unfunded' | 'all' | 'none' | 'custom';
type LeaseDbt = 'include' | 'exclude';
type OpLease = 'exclude' | 'include';

const CAPEX_OPTIONS: ButtonGroupOption<CapexMode>[] = [
  { value: 'unfunded', label: 'Unfunded Only', description: 'CapEx minus debt proceeds' },
  { value: 'all',      label: 'Deduct All',    description: 'Conservative — 100% of CapEx' },
  { value: 'none',     label: 'No Deduction',  description: 'Growth / maintenance CapEx' },
  { value: 'custom',   label: 'Custom %',       description: 'Manual percentage' },
];

const LEASE_DEBT_OPTIONS: ButtonGroupOption<LeaseDbt>[] = [
  { value: 'include', label: 'Include',  description: 'IFRS 16 — on-balance-sheet leases' },
  { value: 'exclude', label: 'Exclude',  description: 'Pre-IFRS 16 / US GAAP convention' },
];

const OP_LEASE_OPTIONS: ButtonGroupOption<OpLease>[] = [
  { value: 'exclude', label: 'Exclude',  description: 'Standard banking (default)' },
  { value: 'include', label: 'Include',  description: 'Conservative / pre-IFRS 16 style' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function CovenantParametersPanel({
  config,
  onConfigChange,
}: CovenantParametersPanelProps) {
  // ── CapEx treatment ───────────────────────────────────────────────────────
  const handleCapexMode = (mode: CapexMode) => {
    onConfigChange({
      ...config,
      capexTreatment: {
        mode,
        // Preserve existing percentage when switching to custom, default to 100
        customPercentage:
          mode === 'custom'
            ? (config.capexTreatment.customPercentage ?? 100)
            : undefined,
      },
    });
  };

  const handleCapexPercentage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseFloat(e.target.value);
    const pct = isNaN(raw) ? 0 : Math.min(100, Math.max(0, raw));
    onConfigChange({
      ...config,
      capexTreatment: { mode: 'custom', customPercentage: pct },
    });
  };

  // ── Lease debt treatment ──────────────────────────────────────────────────
  const handleLeaseDebt = (mode: LeaseDbt) => {
    onConfigChange({
      ...config,
      leaseDebtTreatment: { mode },
    });
  };

  // ── Operating lease treatment ─────────────────────────────────────────────
  const handleOpLease = (mode: OpLease) => {
    onConfigChange({
      ...config,
      operatingLeaseTreatment: { mode },
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          Covenant Parameters
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Adjusting these settings instantly recalculates FCCR, Senior Debt / Adj. EBITDA, and
          Total Debt / Capital without re-running extraction.
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ── CapEx Treatment ─────────────────────────────────────────────── */}
        <div className="space-y-2">
          <div>
            <p className="text-xs font-semibold text-foreground">CapEx Treatment</p>
            <p className="text-[11px] text-muted-foreground">
              Controls how capital expenditures reduce the FCCR numerator.
            </p>
          </div>
          <ButtonGroup
            options={CAPEX_OPTIONS}
            selected={config.capexTreatment.mode}
            onSelect={handleCapexMode}
          />
          {config.capexTreatment.mode === 'custom' && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-muted-foreground">Deduct</span>
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                value={config.capexTreatment.customPercentage ?? 100}
                onChange={handleCapexPercentage}
                className="w-20 h-7 text-xs text-center"
              />
              <span className="text-xs text-muted-foreground">% of total CapEx</span>
            </div>
          )}
        </div>

        {/* ── Lease Debt Treatment ─────────────────────────────────────────── */}
        <div className="space-y-2">
          <div>
            <p className="text-xs font-semibold text-foreground">Lease Debt Treatment</p>
            <p className="text-[11px] text-muted-foreground">
              Whether IFRS 16 lease liabilities count toward Senior Debt for leverage ratios.
            </p>
          </div>
          <ButtonGroup
            options={LEASE_DEBT_OPTIONS}
            selected={config.leaseDebtTreatment.mode}
            onSelect={handleLeaseDebt}
          />
        </div>

        {/* ── Operating Lease Treatment ─────────────────────────────────────── */}
        <div className="space-y-2">
          <div>
            <p className="text-xs font-semibold text-foreground">Operating Lease Treatment</p>
            <p className="text-[11px] text-muted-foreground">
              Whether operating lease payments are added to the FCCR denominator.
            </p>
          </div>
          <ButtonGroup
            options={OP_LEASE_OPTIONS}
            selected={config.operatingLeaseTreatment.mode}
            onSelect={handleOpLease}
          />
        </div>
      </CardContent>
    </Card>
  );
}

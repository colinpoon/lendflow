import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  AlertTriangle,
  ThumbsUp,
  ListChecks,
  Building2,
} from 'lucide-react';

import type { DebtHealthAssessment } from '@/types/risk';
import { DecisionSkeleton } from '@/components/skeletons/ProjectDetailSkeletons';

interface LoanDecisionCardProps {
  debtHealthAssessment: DebtHealthAssessment | null;
  isRefreshing: boolean;
  onScrollToUpload: () => void;
}

export default function LoanDecisionCard({
  debtHealthAssessment,
  isRefreshing,
  onScrollToUpload,
}: LoanDecisionCardProps) {
  if (isRefreshing) {
    return <DecisionSkeleton />;
  }

  if (!debtHealthAssessment) {
    return (
      <div className="space-y-4">
        {/* Skeleton preview of what the decision looks like */}
        <div className="rounded-xl border-2 border-dashed border-border px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-muted animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 bg-muted rounded animate-pulse" />
            <div className="h-6 w-48 bg-muted rounded animate-pulse" />
          </div>
          <div className="space-y-2 sm:text-right">
            <div className="h-3 w-16 bg-muted rounded animate-pulse" />
            <div className="h-5 w-24 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-dashed border-border p-4 space-y-2">
            <div className="h-3 w-28 bg-muted rounded animate-pulse" />
            <div className="h-2 w-full bg-muted rounded animate-pulse" />
            <div className="h-2 w-3/4 bg-muted rounded animate-pulse" />
          </div>
          <div className="rounded-lg border border-dashed border-border p-4 space-y-2">
            <div className="h-3 w-28 bg-muted rounded animate-pulse" />
            <div className="h-2 w-full bg-muted rounded animate-pulse" />
            <div className="h-2 w-2/3 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <p className="text-muted-foreground text-xs text-center">
          Upload financial documents to generate a lending recommendation.
        </p>
        <div className="flex justify-center">
          <button
            onClick={onScrollToUpload}
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Go to Upload
          </button>
        </div>
      </div>
    );
  }

  const lowerDecision = debtHealthAssessment.lending_decision.toLowerCase();
  const isApprove = lowerDecision.includes('approve') && !lowerDecision.includes('conditional');
  const isConditional = lowerDecision.includes('conditional');
  const bannerClasses = isApprove
    ? 'bg-success/15 border-success/40 text-success'
    : isConditional
      ? 'bg-warning/15 border-warning/40 text-warning'
      : 'bg-error/15 border-error/40 text-error';
  const DecisionIcon = isApprove ? ShieldCheck : isConditional ? ShieldAlert : ShieldX;

  return (
    <div className="space-y-5">
      {/* Verdict Banner — largest, most visible element in this section */}
      <div className={`flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border-2 px-6 py-5 ${bannerClasses}`}>
        <DecisionIcon className="h-12 w-12 shrink-0 opacity-90" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-normal font-semibold text-muted-foreground mb-0.5">
            Lending Decision
          </p>
          <p className="text-2xl font-extrabold tracking-tight leading-tight break-words">
            {debtHealthAssessment.lending_decision}
          </p>
        </div>
        <div className="sm:ml-auto sm:text-right shrink-0">
          <p className="text-[10px] uppercase tracking-normal font-semibold text-muted-foreground mb-0.5">
            Risk Band
          </p>
          <p className="text-base font-bold">{debtHealthAssessment.risk_band}</p>
        </div>
      </div>

      {/* Risk Factors + Positive Factors — distinct semantic panel treatments */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {debtHealthAssessment.key_risk_factors.length > 0 && (
          <div className="rounded-lg border border-warning/25 bg-warning/5 p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
              Key Risk Factors
              <span className="ml-auto text-[11px] font-medium bg-warning/15 text-warning px-2 py-0.5 rounded-full tabular-nums">
                {debtHealthAssessment.key_risk_factors.length}
              </span>
            </div>
            <ul className="space-y-2">
              {debtHealthAssessment.key_risk_factors.map((factor, i) => (
                <li key={i} className="text-xs text-muted-foreground leading-relaxed flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-warning shrink-0" />
                  {factor}
                </li>
              ))}
            </ul>
          </div>
        )}
        {debtHealthAssessment.positive_factors.length > 0 && (
          <div className="rounded-lg border border-success/25 bg-success/5 p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ThumbsUp className="h-4 w-4 text-success shrink-0" />
              Positive Factors
              <span className="ml-auto text-[11px] font-medium bg-success/15 text-success px-2 py-0.5 rounded-full tabular-nums">
                {debtHealthAssessment.positive_factors.length}
              </span>
            </div>
            <ul className="space-y-2">
              {debtHealthAssessment.positive_factors.map((factor, i) => (
                <li key={i} className="text-xs text-muted-foreground leading-relaxed flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-success shrink-0" />
                  {factor}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Recommendations — numbered list; action-oriented framing */}
      {debtHealthAssessment.recommendations.length > 0 && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ListChecks className="h-4 w-4 text-primary shrink-0" />
            Recommendations
            <span className="ml-auto text-[11px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full tabular-nums">
              {debtHealthAssessment.recommendations.length}
            </span>
          </div>
          <ol className="space-y-2">
            {debtHealthAssessment.recommendations.map((rec, i) => (
              <li key={i} className="text-xs text-muted-foreground leading-relaxed flex items-start gap-2.5">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary font-bold text-[9px]">
                  {i + 1}
                </span>
                {rec}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Suggested Loan Structure */}
      {debtHealthAssessment.suggested_loan_structure && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Building2 className="h-4 w-4 text-primary shrink-0" />
            Suggested Loan Structure
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
            {debtHealthAssessment.suggested_loan_structure}
          </p>
        </div>
      )}
    </div>
  );
}

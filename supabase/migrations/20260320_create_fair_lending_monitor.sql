-- Fair lending monitoring for ECOA/Reg B compliance.
-- Captures lending recommendation metadata by observable borrower characteristics
-- to enable post-hoc disparity analysis. Companion to audit_trail — audit_trail
-- preserves the full decision snapshot; this table normalizes key dimensions
-- for efficient distribution analysis across borrower segments.
--
-- IMMUTABILITY: RLS policies allow INSERT and SELECT only — no UPDATE or DELETE.
-- Revenue buckets and risk bands are denormalized at insert time to freeze
-- the classification as it was when the recommendation was made.

CREATE TABLE IF NOT EXISTS fair_lending_monitor (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Linkage
  extraction_id   UUID,
  project_id      UUID NOT NULL,
  user_id         TEXT NOT NULL,

  -- Lending decision (frozen at recommendation time)
  lending_decision        TEXT,           -- "Strong Approve" / "Approve" / "Conditional Approval" / "Further Review Required" / "Decline"
  quantitative_risk_score NUMERIC,       -- 0-100 normalized score
  quantitative_risk_band  TEXT,          -- "Very Low Risk" .. "High Risk"
  debt_health_score       NUMERIC,       -- 0-10 weighted score
  debt_health_band        TEXT,          -- "Strong Approve" .. "Decline"

  -- Borrower classification (observable, non-protected characteristics)
  revenue_bucket          TEXT,          -- "micro" / "small" / "medium" / "large" / "enterprise" / "unknown"
  revenue_thousands       NUMERIC,      -- Raw revenue in thousands for custom bucketing

  -- Key financial metrics driving the recommendation (latest fiscal year)
  primary_fccr            NUMERIC,      -- Covenant FCCR
  primary_leverage        NUMERIC,      -- Sr Debt / Adj EBITDA
  primary_debt_capital    NUMERIC,      -- Total Debt / Total Capital
  primary_current_ratio   NUMERIC,      -- Current ratio (liquidity)

  -- Pipeline context
  pipeline_type   TEXT NOT NULL CHECK (pipeline_type IN ('text', 'vision')),

  -- Timestamp — immutable
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE fair_lending_monitor ENABLE ROW LEVEL SECURITY;

-- INSERT policy: authenticated users can create monitoring records
CREATE POLICY "Users can insert fair lending records"
  ON fair_lending_monitor FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- SELECT policy: users can read records (for disparity reporting)
CREATE POLICY "Users can read fair lending records"
  ON fair_lending_monitor FOR SELECT
  TO authenticated
  USING (true);

-- NOTE: No UPDATE or DELETE policies. Append-only by design.
-- When Task 18 (Clerk JWT UUID mismatch) is resolved, scope policies to user_id.

-- Indexes for disparity analysis queries
CREATE INDEX IF NOT EXISTS idx_flm_lending_decision
  ON fair_lending_monitor (lending_decision, created_at DESC)
  WHERE lending_decision IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_flm_revenue_bucket
  ON fair_lending_monitor (revenue_bucket, lending_decision)
  WHERE revenue_bucket IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_flm_user_created
  ON fair_lending_monitor (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_flm_project
  ON fair_lending_monitor (project_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Disparity analysis function: recommendation distribution by revenue bucket.
-- Returns counts and percentages of each lending decision within each bucket,
-- enabling analysts to spot systematic patterns across borrower size segments.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_recommendation_distribution(
  p_user_id TEXT DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  revenue_bucket    TEXT,
  lending_decision  TEXT,
  decision_count    BIGINT,
  bucket_total      BIGINT,
  decision_pct      NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  WITH filtered AS (
    SELECT
      flm.revenue_bucket,
      flm.lending_decision
    FROM fair_lending_monitor flm
    WHERE flm.lending_decision IS NOT NULL
      AND (p_user_id IS NULL OR flm.user_id = p_user_id)
      AND (p_start_date IS NULL OR flm.created_at >= p_start_date)
      AND (p_end_date IS NULL OR flm.created_at <= p_end_date)
  ),
  bucket_totals AS (
    SELECT
      f.revenue_bucket,
      COUNT(*) AS bucket_total
    FROM filtered f
    GROUP BY f.revenue_bucket
  )
  SELECT
    f.revenue_bucket,
    f.lending_decision,
    COUNT(*) AS decision_count,
    bt.bucket_total,
    ROUND(COUNT(*) * 100.0 / NULLIF(bt.bucket_total, 0), 1) AS decision_pct
  FROM filtered f
  JOIN bucket_totals bt ON bt.revenue_bucket = f.revenue_bucket
  GROUP BY f.revenue_bucket, f.lending_decision, bt.bucket_total
  ORDER BY f.revenue_bucket, f.lending_decision;
$$;

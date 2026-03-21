-- Scope RLS policies on audit_trail and fair_lending_monitor to user_id.
--
-- Replaces permissive USING(true) / WITH CHECK(true) policies with
-- user-scoped policies using auth.jwt() ->> 'sub' = user_id.
--
-- Clerk JWTs (template: 'supabase') set the `sub` claim to the Clerk user ID
-- (e.g., 'user_2abc123'), which matches the user_id column format.
--
-- NOTE: The app's audit logging uses createAdminClient() (bypasses RLS), so
-- these policies are defense-in-depth. They prevent cross-user data access
-- if a non-admin client is ever used to query these tables.

-- ── audit_trail ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can insert own audit records" ON audit_trail;
DROP POLICY IF EXISTS "Users can read own audit records" ON audit_trail;

CREATE POLICY "Users can insert own audit records"
  ON audit_trail FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can read own audit records"
  ON audit_trail FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'sub' = user_id);

-- ── fair_lending_monitor ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can insert fair lending records" ON fair_lending_monitor;
DROP POLICY IF EXISTS "Users can read fair lending records" ON fair_lending_monitor;

CREATE POLICY "Users can insert fair lending records"
  ON fair_lending_monitor FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can read fair lending records"
  ON fair_lending_monitor FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'sub' = user_id);

-- ── Update disparity analysis function to SECURITY DEFINER ───────────────
-- The get_recommendation_distribution function needs cross-user data for
-- fair lending disparity analysis. SECURITY DEFINER runs as the function
-- owner (bypassing RLS), allowing aggregate queries across all users.
-- Access control is handled by the p_user_id parameter and app-level auth.

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
SECURITY DEFINER
SET search_path = public
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

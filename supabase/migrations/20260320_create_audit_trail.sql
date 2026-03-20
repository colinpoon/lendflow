-- Regulatory audit trail for lending decisions.
-- Immutable, append-only record of every extraction analysis: model version,
-- document hash, computed metrics, risk assessments, and lending decisions.
-- Required for OCC/FDIC regulatory exams and litigation support.
--
-- IMMUTABILITY: RLS policies allow INSERT and SELECT only — no UPDATE or DELETE.
-- Even service-role callers should never modify or remove audit records.

CREATE TABLE IF NOT EXISTS audit_trail (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who & what
  event_type      TEXT NOT NULL DEFAULT 'extraction_completed',
  user_id         TEXT NOT NULL,
  project_id      UUID NOT NULL,
  document_id     UUID NOT NULL,
  extraction_id   UUID,

  -- Pipeline context
  pipeline_type   TEXT NOT NULL CHECK (pipeline_type IN ('text', 'vision')),
  model_version   TEXT NOT NULL,
  document_hash   TEXT,
  document_name   TEXT NOT NULL,
  document_size   INTEGER NOT NULL,
  processing_time_ms INTEGER,

  -- Extraction output snapshot (frozen at decision time)
  fiscal_years           TEXT[],
  metrics_snapshot       JSONB NOT NULL,       -- latest-year ComputedMetrics
  full_metrics_snapshot  JSONB,                -- all years (optional, for deep audits)
  extraction_warnings    TEXT[],
  validation_issues      JSONB,

  -- Risk assessment snapshots
  qualitative_risk_snapshot   JSONB,           -- RiskData from risk-generator
  debt_health_snapshot        JSONB,           -- DebtHealthAssessment
  quantitative_risk_snapshot  JSONB,           -- QuantitativeRiskAssessment

  -- Lending decision (denormalized for fast queries)
  lending_decision        TEXT,                -- "Strong Approve" / "Approve" / "Conditional Approval" / "Further Review Required" / "Decline"
  quantitative_risk_score NUMERIC,            -- 0-100 normalized score
  quantitative_risk_band  TEXT,               -- "Very Low Risk" .. "High Risk"

  -- Timestamp — immutable
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;

-- INSERT policy: authenticated users can create audit records
CREATE POLICY "Users can insert own audit records"
  ON audit_trail FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- SELECT policy: users can read their own audit records
CREATE POLICY "Users can read own audit records"
  ON audit_trail FOR SELECT
  TO authenticated
  USING (true);

-- NOTE: No UPDATE or DELETE policies. This table is append-only by design.
-- When Task 18 (Clerk JWT UUID mismatch) is resolved, replace USING(true) / WITH CHECK(true)
-- with proper user-scoped policies: USING (auth.jwt() ->> 'sub' = user_id).

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_trail_user_created
  ON audit_trail (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_trail_project
  ON audit_trail (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_trail_document
  ON audit_trail (document_id);

CREATE INDEX IF NOT EXISTS idx_audit_trail_lending_decision
  ON audit_trail (lending_decision, created_at DESC)
  WHERE lending_decision IS NOT NULL;

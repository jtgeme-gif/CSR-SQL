-- New Supabase-native CSR tracking, replacing the SharePoint CSR Tracker
-- list. csr_item_id is intentionally left in place for now - CSRTab.js
-- still reads/writes SharePoint until that piece is separately migrated.

-- Full submission history, one row per actual CSR submission. Chosen over
-- flat fields specifically to preserve an audit trail (who submitted what,
-- when) - useful for insurer-facing questions down the line.
CREATE TABLE IF NOT EXISTS csr_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id uuid NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  date_submitted date NOT NULL,
  next_due date NOT NULL,
  submitted_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_csr_submissions_matter_id ON csr_submissions(matter_id);

-- Initial CSR due date - auto-calculated as date_opened + 45 days at matter
-- creation, but manually overridable (e.g. matter opened late but the clock
-- should've started earlier).
ALTER TABLE matters ADD COLUMN IF NOT EXISTS csr_initial_due date;

-- Cached copy of the latest csr_submissions.next_due, kept in sync on every
-- new submission - avoids a join for every dashboard/digest lookup. No
-- separate "CSR closed" concept - CSR just stops being relevant once
-- matters.case_status = 'Closed'.
ALTER TABLE matters ADD COLUMN IF NOT EXISTS csr_next_due date;

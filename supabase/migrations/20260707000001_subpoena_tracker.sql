-- Rebuilds the Subpoena/FOIA tab on the existing case_requests table
-- (already live: matter_id, target, date_submitted, date_due, request_content).
-- Adds date_received, notes, request_type, method_id, and widens status.
-- Deliberately minimal per discussion — three statuses, not a granular workflow.

-- Widen status check dynamically, since the exact auto-generated constraint
-- name from the original migration isn't known for certain.
DO $$
DECLARE
  existing_constraint text;
BEGIN
  SELECT con.conname INTO existing_constraint
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'case_requests'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%status%';

  IF existing_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE case_requests DROP CONSTRAINT %I', existing_constraint);
  END IF;
END $$;

ALTER TABLE case_requests
  ADD CONSTRAINT case_requests_status_check
  CHECK (status IN ('Open', 'Closed', 'Withdrawn'));

ALTER TABLE case_requests ADD COLUMN date_received date;
ALTER TABLE case_requests ADD COLUMN notes text;
ALTER TABLE case_requests ADD COLUMN request_type text CHECK (request_type IN ('Subpoena', 'FOIA', 'Other'));

-- Method (Send Via): small, growable list — RDS, LCS, Direct, and whatever
-- else gets typed. Deliberately NOT linked to Entities.
CREATE TABLE subpoena_methods (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    label       text NOT NULL UNIQUE,
    created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE subpoena_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users have full access to subpoena_methods"
  ON subpoena_methods FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

INSERT INTO subpoena_methods (label) VALUES ('RDS'), ('LCS'), ('Direct');

ALTER TABLE case_requests ADD COLUMN method_id uuid REFERENCES subpoena_methods(id);

NOTIFY pgrst, 'reload schema';

-- Idempotent version — safe to run even if some of these columns already
-- exist from a prior partial run. Each ADD COLUMN is guarded with
-- IF NOT EXISTS so nothing errors out on a second pass.

ALTER TABLE case_people ADD COLUMN IF NOT EXISTS witness_type text;
ALTER TABLE case_people ADD COLUMN IF NOT EXISTS party text;
ALTER TABLE case_entities ADD COLUMN IF NOT EXISTS party text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS case_people_id uuid REFERENCES case_people(id) ON DELETE SET NULL;

-- Forces Supabase's PostgREST layer to refresh its schema cache immediately,
-- rather than waiting for its own refresh cycle. This is likely the actual
-- cause of the original "column not found in schema cache" error — the
-- column may have already existed in Postgres, but the API layer serving
-- your app hadn't picked up the change yet.
NOTIFY pgrst, 'reload schema';

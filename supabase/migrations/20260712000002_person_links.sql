-- Person-to-person linking (assistants, paralegals, clerks, secretaries,
-- etc.) - deliberately no relationship label field. identity/title on the
-- people themselves already convey enough context. Always mutual: a single
-- row represents the link in both directions, no directionality.
--
-- person_a_id/person_b_id are canonically ordered (smaller UUID first,
-- enforced by the app, not the DB) purely so the unique constraint actually
-- prevents a duplicate reverse-order row for the same pair.
CREATE TABLE IF NOT EXISTS person_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_a_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  person_b_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT person_links_no_self CHECK (person_a_id <> person_b_id),
  CONSTRAINT person_links_unique_pair UNIQUE (person_a_id, person_b_id)
);

CREATE INDEX IF NOT EXISTS idx_person_links_a ON person_links(person_a_id);
CREATE INDEX IF NOT EXISTS idx_person_links_b ON person_links(person_b_id);

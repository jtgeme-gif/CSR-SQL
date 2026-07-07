-- Mediation redesign: mediation becomes a real, schedulable event type
-- (shared with Scheduling's Court Dates & Deadlines frame), with a dedicated
-- session record and its own running notes log. Demands & Offers gains the
-- richer field set from OMT (expiration, counter, response deadline).

-- 1. Mediation becomes a real event type, alongside Hearing/Trial/etc.
INSERT INTO event_types (label) VALUES ('Mediation');

-- 2. One session record per Mediation event. event_id is UNIQUE, making this
--    a true one-to-one with events — one mediation event, one session record.
CREATE TABLE mediation_sessions (
    id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id                    uuid NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
    mediator_id                 uuid REFERENCES people(id),
    format                      text,
    summary_due_date            date,
    mediator_response_deadline  date,
    resolved                    boolean NOT NULL DEFAULT false,
    settlement_amount           numeric(12,2),
    created_at                  timestamptz NOT NULL DEFAULT now(),
    updated_at                  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mediation_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users have full access to mediation_sessions"
  ON mediation_sessions FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 3. Running notes log per session — timestamped, authored, editable/deletable.
CREATE TABLE mediation_notes (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    mediation_session_id  uuid NOT NULL REFERENCES mediation_sessions(id) ON DELETE CASCADE,
    author_name           text,
    note_text             text NOT NULL,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mediation_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users have full access to mediation_notes"
  ON mediation_notes FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 4. Demands & Offers gets the richer OMT field set. Status column deliberately
--    not added, per discussion. Existing opening_demand/opening_offer/
--    final_demand/final_offer columns are left in place, unused — they belonged
--    to the old "Mediation" entry_type concept, now fully replaced by the above.
ALTER TABLE settlement_negotiations
  ADD COLUMN expiration_date date,
  ADD COLUMN counter_amount numeric(12,2),
  ADD COLUMN counter_date date,
  ADD COLUMN response_deadline date;

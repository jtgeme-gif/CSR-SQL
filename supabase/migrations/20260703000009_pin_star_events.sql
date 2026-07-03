-- Splits the single is_key_deadline flag into two independent flags,
-- matching OMT's pin (red pushpin -> Overview Key Deadlines) vs
-- star (star icon -> sticky info bar) distinction. Fully independent:
-- an event can be pinned, starred, both, or neither.

ALTER TABLE events RENAME COLUMN is_key_deadline TO pin_to_overview;
ALTER TABLE events ADD COLUMN star_to_infobar boolean NOT NULL DEFAULT false;

-- Old partial index referenced the pre-rename column name
DROP INDEX IF EXISTS idx_events_key_deadline;
CREATE INDEX idx_events_pin_to_overview ON events (matter_id, pin_to_overview) WHERE pin_to_overview = true;
CREATE INDEX idx_events_star_to_infobar ON events (matter_id, star_to_infobar) WHERE star_to_infobar = true;

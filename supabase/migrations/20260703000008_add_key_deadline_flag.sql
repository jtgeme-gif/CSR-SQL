-- Flags an event as a "Key Deadline" for the Matter Overview summary frame.
-- Set from the Events/Scheduling tab once built; this migration only adds
-- the column so the read-only summary frame has something real to query.

ALTER TABLE events ADD COLUMN is_key_deadline boolean NOT NULL DEFAULT false;

CREATE INDEX idx_events_key_deadline ON events (matter_id, is_key_deadline) WHERE is_key_deadline = true;

-- Adds the pending Trial event type, and a completed flag for the
-- Scheduling tab's row-level complete checkbox (fades but doesn't hide).

INSERT INTO event_types (label) VALUES ('Trial');

ALTER TABLE events ADD COLUMN completed boolean NOT NULL DEFAULT false;

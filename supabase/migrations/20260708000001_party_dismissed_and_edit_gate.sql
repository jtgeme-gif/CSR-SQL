-- Tracks a party as dismissed (case still open, this party is no longer active)
-- on both person and entity parties. Free-text note, not a fixed dropdown --
-- quick reference only ("dismissed by stipulation", "settled", etc.), same
-- pattern as capacity and other quick-note fields elsewhere.

ALTER TABLE case_people ADD COLUMN dismissed boolean NOT NULL DEFAULT false;
ALTER TABLE case_people ADD COLUMN dismissal_note text;

ALTER TABLE case_entities ADD COLUMN dismissed boolean NOT NULL DEFAULT false;
ALTER TABLE case_entities ADD COLUMN dismissal_note text;

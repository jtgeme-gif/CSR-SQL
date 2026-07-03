-- Entity Type classification: Client, Law Firm, Municipality, Vendor
-- Nullable — existing entities are unclassified until reviewed, not forced to backfill.

ALTER TABLE entities
  ADD COLUMN entity_type text
  CHECK (entity_type IN ('Client', 'Law Firm', 'Municipality', 'Vendor'));

-- Department field on People - identifies which department within a larger
-- entity a person belongs to (e.g. a City of Detroit police officer vs. a
-- City of Detroit attorney). Free text, applies to every identity type.
ALTER TABLE people ADD COLUMN IF NOT EXISTS department text;

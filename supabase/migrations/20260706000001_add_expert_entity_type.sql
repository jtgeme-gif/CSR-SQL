-- Adds 'Expert' as a valid entity_type, alongside Client/Law Firm/Municipality/Vendor.
-- The original CHECK constraint's exact auto-generated name isn't known for certain,
-- so this looks it up dynamically rather than guessing, then replaces it.

DO $$
DECLARE
  existing_constraint text;
BEGIN
  SELECT con.conname INTO existing_constraint
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'entities'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%entity_type%';

  IF existing_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE entities DROP CONSTRAINT %I', existing_constraint);
  END IF;
END $$;

ALTER TABLE entities
  ADD CONSTRAINT entities_entity_type_check
  CHECK (entity_type IN ('Client', 'Law Firm', 'Municipality', 'Vendor', 'Expert'));

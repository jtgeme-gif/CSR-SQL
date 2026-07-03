-- staff_name was NOT NULL from when it was the only way to record an
-- assignment. Structured assignments now go through staff_id instead,
-- so staff_name needs to become optional (legacy text still supported,
-- just no longer required going forward).

ALTER TABLE matter_staff ALTER COLUMN staff_name DROP NOT NULL;

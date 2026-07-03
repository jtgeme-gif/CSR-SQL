-- Adds the "Motion / Brief" event type, referenced in the earlier
-- multi-date design (event_date=filed, secondary_date=response due,
-- tertiary_date=reply due) but never actually seeded into event_types.

INSERT INTO event_types (label) VALUES ('Motion / Brief');

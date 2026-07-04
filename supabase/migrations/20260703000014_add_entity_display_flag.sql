-- Controls clutter in the Entities/Municipalities directory without
-- blocking creation anywhere. Defaults to true so nothing in the existing
-- ~50 entities disappears on deploy — uncheck individual ones as clutter
-- is noticed (solo expert firms, one-off duplicates, etc.).

ALTER TABLE entities ADD COLUMN display_on_entity_list boolean NOT NULL DEFAULT true;

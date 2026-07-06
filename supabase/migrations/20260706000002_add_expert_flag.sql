-- Expert flag on people, same pattern as mediator: an independent
-- capability checkbox, not an identity value. A person's identity
-- (Individual/Attorney/Judge/Client Rep) stays single-select and
-- unaffected; Expert layers on top and persists even if identity changes.

ALTER TABLE people ADD COLUMN expert boolean NOT NULL DEFAULT false;

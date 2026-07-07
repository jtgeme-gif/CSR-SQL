-- Witnesses tab: unifies Witness + Expert under role='Witness' on case_people,
-- distinguished by witness_type (Fact/Expert/Records/Reps/Other). Party tracks
-- which side called them. Designated Representatives (entity witnesses'
-- testifying person, MCR 2.306(B) / FRCP 30(b)(6)) reuse the existing
-- poc_entity_id mechanism already built for Defendant POCs — witness_type='Reps'.

ALTER TABLE case_people ADD COLUMN witness_type text;
ALTER TABLE case_people ADD COLUMN party text;

-- Entity witnesses (the entity itself is deposed, e.g. City of Vassar) need
-- their own party alignment too, since it's not always inferable from their
-- Defendant/Co-Defendant role on the same matter.
ALTER TABLE case_entities ADD COLUMN party text;

-- Links a Deposition event to who's being deposed. Conditional-in-UI, same
-- pattern as the Expert tracking fields — not enforced at the DB level since
-- it's only meaningful for Deposition-type events.
ALTER TABLE events ADD COLUMN case_people_id uuid REFERENCES case_people(id) ON DELETE SET NULL;

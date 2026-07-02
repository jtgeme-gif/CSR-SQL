-- ============================================================
-- Matter Tracker v2 — Attorney "represents" link
-- Run this AFTER 20260701000019_phone_email_labels.sql
--
-- Lets an Attorney's case_people row point at the specific
-- party they represent — either a case_entities row (an entity
-- party, e.g. Houghton County) or another case_people row (a
-- person party, e.g. Peter Dekryger). Exactly one should be
-- set when role = 'Attorney'.
-- ============================================================

alter table case_people
    add column if not exists represents_case_entity_id uuid references case_entities(id) on delete set null,
    add column if not exists represents_case_person_id uuid references case_people(id) on delete set null;

create index idx_case_people_represents_entity on case_people (represents_case_entity_id);
create index idx_case_people_represents_person on case_people (represents_case_person_id);

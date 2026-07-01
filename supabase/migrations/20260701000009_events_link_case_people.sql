-- ============================================================
-- Matter Tracker v2 — Link events to case_people
-- Run this AFTER 20260701000008_mediation_session_fields.sql
--
-- Lets an event (most importantly, a Deposition) reference a
-- specific case_people row, instead of just a text description.
-- Nullable — most events (a court deadline, a status conference)
-- don't need a person attached, only ones like depositions do.
-- ============================================================

alter table events
    add column if not exists case_people_id uuid references case_people(id) on delete set null;

create index idx_events_case_people on events (case_people_id);

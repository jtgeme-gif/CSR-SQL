-- ============================================================
-- Matter Tracker v2 — Remove firm_type from people
-- Run this AFTER 20260701000003_remove_assistant_fields.sql
--
-- firm_type is redundant now that Entities exist as their own
-- concept — the person's entity_id already tells you who they
-- work for, and any distinguishing detail belongs on the
-- entity itself if it's ever needed, not duplicated per person.
-- ============================================================

alter table people
    drop column if exists firm_type;

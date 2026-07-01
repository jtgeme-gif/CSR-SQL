-- ============================================================
-- Matter Tracker v2 — Add missing date_opened field
-- Run this AFTER 20260701000015_case_status_appeal.sql
--
-- Caught while building the Add Matter form — this was visible
-- on the OMT Case Overview screenshot but never actually added
-- to the new schema.
-- ============================================================

alter table matters
    add column if not exists date_opened date;

-- ============================================================
-- Matter Tracker v2 — Remove redundant attorney-assistant fields
-- Run this AFTER 20260701000002_rls_policies.sql
--
-- assistant_name, assistant_email, and mediation_notes are
-- being dropped from people. The general `notes` field covers
-- this information instead of dedicating narrow columns to it.
-- ============================================================

alter table people
    drop column if exists assistant_name,
    drop column if exists assistant_email,
    drop column if exists mediation_notes;

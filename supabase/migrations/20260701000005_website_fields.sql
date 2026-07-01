-- ============================================================
-- Matter Tracker v2 — Rename judge_page to website, add
-- website to entities
-- Run this AFTER 20260701000004_remove_firm_type.sql
--
-- judge_page was too narrow — a judge's court bio page and an
-- attorney's firm bio page are the same shape of field.
-- Generalizing to `website` on people. Also adding a matching
-- `website` field on entities, for the org's own homepage
-- (e.g. TMHCC's site, a law firm's site).
-- ============================================================

alter table people
    rename column judge_page to website;

alter table entities
    add column if not exists website text;

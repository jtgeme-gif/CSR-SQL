-- ============================================================
-- Matter Tracker v2 — File Number moves back to Matters
-- Run this AFTER 20260701000021_matter_claim_reps.sql
--
-- Reversal of the earlier per-defendant design: File Number is
-- just a quick-reference internal number, typed manually
-- (including multi-defendant cases like "1979.1807 // 1979.1810"
-- entered as one string). claim_rep_file_number stays on
-- case_entities untouched — that one's a genuinely different,
-- correct use case (per-defendant client claim numbers).
-- ============================================================

alter table matters
    add column if not exists file_number text;

alter table case_entities
    drop column if exists file_number;

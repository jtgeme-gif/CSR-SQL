-- ============================================================
-- Matter Tracker v2 — Remove unused client_insurer_entity_id
-- Run this AFTER 20260701000022_file_number_to_matters.sql
--
-- Superseded by displaying each Claim Rep's own entity link
-- (people.entity_id) directly, instead of a separate matter-
-- level insurer field. The junction-table design keeps making
-- fields like this redundant as real associations replace them.
-- ============================================================

alter table matters
    drop column if exists client_insurer_entity_id;

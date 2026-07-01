-- ============================================================
-- Matter Tracker v2 — Client Insurer on Matters
-- Run this AFTER 20260701000016_date_opened.sql
--
-- This is the "whose insurance contract is paying for this
-- matter" relationship (TMHCC, XL, MSP) discussed early on but
-- never actually migrated in. Distinct from case_entities,
-- which tracks litigation parties, not business relationships.
-- ============================================================

alter table matters
    add column if not exists client_insurer_entity_id uuid references entities(id) on delete set null;

create index idx_matters_client_insurer on matters (client_insurer_entity_id);

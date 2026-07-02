-- ============================================================
-- Matter Tracker v2 — Add "Client Rep" identity value
-- Run this AFTER 20260701000017_client_insurer.sql
--
-- For people like Richard Chaffee at MSP: not a litigation
-- party, but the firm's point of contact at an entity that
-- assigns work.
-- ============================================================

alter table people
    drop constraint if exists people_identity_check;

alter table people
    add constraint people_identity_check
        check (identity in ('Individual', 'Attorney', 'Judge', 'Client Rep'));

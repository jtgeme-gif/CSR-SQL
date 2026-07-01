-- ============================================================
-- Matter Tracker v2 — Mediation session fields on
-- settlement_negotiations
-- Run this AFTER 20260701000007_event_types_settlement_negotiations.sql
--
-- Rather than a separate table, Mediation entries use these
-- four columns instead of `amount`. Demand/Offer entries keep
-- using `amount` and leave these null. Same conditional-column
-- pattern already used on case_people for Expert-only fields.
-- ============================================================

alter table settlement_negotiations
    add column if not exists opening_demand numeric(12,2),
    add column if not exists opening_offer  numeric(12,2),
    add column if not exists final_demand   numeric(12,2),
    add column if not exists final_offer    numeric(12,2);

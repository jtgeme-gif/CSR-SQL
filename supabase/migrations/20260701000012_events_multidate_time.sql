-- ============================================================
-- Matter Tracker v2 — Multi-date events, start time + duration
-- Run this AFTER 20260701000011_case_requests.sql
--
-- secondary_date / tertiary_date: UI shows 1, 2, or 3 date
-- fields depending on event_type.
--   Court Deadline  -> event_date only
--   Discovery       -> event_date (sent/rcvd) + secondary_date (due)
--   Motion          -> event_date (filed) + secondary_date (response due)
--                       + tertiary_date (reply due)
--
-- event_time / duration_minutes: used when all_day = false.
-- ============================================================

alter table events
    add column if not exists secondary_date date,
    add column if not exists tertiary_date  date,
    add column if not exists event_time     time,
    add column if not exists duration_minutes integer;

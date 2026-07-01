-- ============================================================
-- Matter Tracker v2 — Add Appeal to case_status, add
-- appellate_case_number
-- Run this AFTER 20260701000014_practice_group.sql
--
-- case_status now covers five values instead of four.
-- appellate_case_number is only relevant when status = Appeal,
-- but left unenforced at the DB level (UI shows it conditionally).
-- ============================================================

alter table matters
    drop constraint if exists matters_case_status_check;

alter table matters
    add constraint matters_case_status_check
        check (case_status in (
            'Pre-litigation Monitoring', 'Active Litigation', 'Stayed', 'Closed', 'Appeal'
        ));

alter table matters
    add column if not exists appellate_case_number text;

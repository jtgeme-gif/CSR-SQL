-- ============================================================
-- Matter Tracker v2 — Practice Group on Matters
-- Run this AFTER 20260701000013_csr_reports.sql
--
-- Values pulled from the existing CSR Tracker's PRACTICE_GROUPS
-- list, since that's the authoritative current set.
-- ============================================================

alter table matters
    add column if not exists practice_group text
        check (practice_group in (
            'Auto-Neg', 'Business', 'Police', 'Labor-Employment',
            'Municipal', 'Zoning', 'School'
        ));

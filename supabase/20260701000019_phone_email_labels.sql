-- ============================================================
-- Matter Tracker v2 — Phone/Email labels
-- Run this AFTER 20260701000018_client_rep_identity.sql
--
-- Free-text labels alongside each phone/email slot, e.g.
-- "Work Cell", "Personal Cell", "Work Email", "Personal Email".
-- Not a lookup table — these are just descriptive tags for
-- display, not something filtered/reported on in aggregate.
-- ============================================================

alter table people
    add column if not exists phone1_label text,
    add column if not exists phone2_label text,
    add column if not exists email1_label text,
    add column if not exists email2_label text;

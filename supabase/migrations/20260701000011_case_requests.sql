-- ============================================================
-- Matter Tracker v2 — Requests (Subpoenas & FOIA)
-- Run this AFTER 20260701000010_case_notes.sql
--
-- Deliberately simple, per direction to avoid repeating the
-- over-built OMT Requests tab. target is free text, not linked
-- to Entities — request targets (records custodians, hospitals,
-- phone companies) aren't case parties, and staying free text
-- avoids cluttering Entities with one-off records departments.
-- ============================================================

create table case_requests (
    id                  uuid primary key default gen_random_uuid(),
    matter_id           uuid not null references matters(id) on delete cascade,
    target              text not null,
    date_submitted      date,
    date_due            date,
    status              text not null default 'Open'
                            check (status in ('Open', 'Closed')),
    request_content     text,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create index idx_case_requests_matter on case_requests (matter_id);
create index idx_case_requests_status on case_requests (status);

alter table case_requests enable row level security;

create policy "authenticated_full_access_case_requests"
    on case_requests
    for all
    to authenticated
    using (true)
    with check (true);

create trigger trg_case_requests_updated_at before update on case_requests
    for each row execute function set_updated_at();

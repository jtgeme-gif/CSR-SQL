-- ============================================================
-- Matter Tracker v2 — CSR Reporting
-- Run this AFTER 20260701000012_events_multidate_time.sql
--
-- Tracked per case_entities row (per defendant/client-insurer),
-- not per matter — a multi-defendant matter like Walby needs
-- one CSR per municipality (Hancock, Houghton), each with its
-- own claims rep and due dates.
--
-- No submission history log — CSR history lives in the filed
-- documents themselves, not the database. Only current state
-- is tracked here, matching OMT's existing behavior.
--
-- assigned staff, claims rep, and client insurer are NOT
-- duplicated here as free text — they already live on
-- matter_staff, case_people, and case_entities respectively.
-- days-remaining is never stored; it's computed live from
-- next_csr_due in the UI, same as OMT.
-- ============================================================

create table csr_reports (
    id                  uuid primary key default gen_random_uuid(),
    case_entity_id      uuid not null references case_entities(id) on delete cascade,

    initial_csr         date,   -- default: matter's date_opened + 45 days, overridable
    next_csr_due        date,
    prior_csr_date       date,   -- date of last submission

    closed              boolean not null default false,
    mute_notifications  boolean not null default false,

    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),

    unique (case_entity_id)
);

create index idx_csr_reports_case_entity on csr_reports (case_entity_id);
create index idx_csr_reports_next_due on csr_reports (next_csr_due);

alter table csr_reports enable row level security;

create policy "authenticated_full_access_csr_reports"
    on csr_reports
    for all
    to authenticated
    using (true)
    with check (true);

create trigger trg_csr_reports_updated_at before update on csr_reports
    for each row execute function set_updated_at();

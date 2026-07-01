-- ============================================================
-- Matter Tracker v2 — Case tab fields, Counts, Staff, and
-- Events star/pin
-- Run this AFTER 20260701000005_website_fields.sql
-- ============================================================

-- ------------------------------------------------------------
-- MATTERS: new case-detail fields
-- file_number is dropped — it now lives on case_entities,
-- one per defendant (matches the Hancock/Houghton example).
-- ------------------------------------------------------------
alter table matters
    add column if not exists case_status text
        check (case_status in ('Pre-litigation Monitoring', 'Active Litigation', 'Stayed', 'Closed')),
    add column if not exists incident_date date,
    add column if not exists factual_allegations text,
    add column if not exists defense_theory_notes text,
    add column if not exists court_case_number text,
    add column if not exists starred boolean not null default false;

alter table matters
    drop column if exists file_number;

-- ------------------------------------------------------------
-- CASE_ENTITIES: per-defendant file numbers
-- e.g. Hancock's own row carries 1979.1807 / OPM-23-16152,
-- Houghton's own row carries 1979.1810 / OPM-23-16149.
-- ------------------------------------------------------------
alter table case_entities
    add column if not exists file_number text,
    add column if not exists claim_rep_file_number text;

-- ------------------------------------------------------------
-- CASE_COUNTS
-- Structured allegation counts per matter, replacing the
-- OMT "+ Add Count" list.
-- ------------------------------------------------------------
create table case_counts (
    id                  uuid primary key default gen_random_uuid(),
    matter_id           uuid not null references matters(id) on delete cascade,
    count_number         integer,
    description         text not null,
    dismissed           boolean not null default false,
    dismissed_date       date,
    dismissal_notes      text,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create index idx_case_counts_matter on case_counts (matter_id);

alter table case_counts enable row level security;

create policy "authenticated_full_access_case_counts"
    on case_counts
    for all
    to authenticated
    using (true)
    with check (true);

create trigger trg_case_counts_updated_at before update on case_counts
    for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- COUNT_DEFENDANTS
-- Links a Count to whichever defendants it applies to.
-- A defendant can be a Person (Wuebben) or an Entity
-- (City of Hancock) — exactly one of the two must be set.
-- ------------------------------------------------------------
create table count_defendants (
    id              uuid primary key default gen_random_uuid(),
    count_id        uuid not null references case_counts(id) on delete cascade,
    person_id       uuid references people(id) on delete cascade,
    entity_id       uuid references entities(id) on delete cascade,
    created_at      timestamptz not null default now(),

    constraint chk_count_defendants_one_side check (
        (person_id is not null and entity_id is null)
        or (person_id is null and entity_id is not null)
    )
);

create index idx_count_defendants_count on count_defendants (count_id);
create index idx_count_defendants_person on count_defendants (person_id);
create index idx_count_defendants_entity on count_defendants (entity_id);

alter table count_defendants enable row level security;

create policy "authenticated_full_access_count_defendants"
    on count_defendants
    for all
    to authenticated
    using (true)
    with check (true);

-- ------------------------------------------------------------
-- MATTER_STAFF
-- Internal firm resourcing (who at the firm is working this
-- file) — distinct from case_people, which tracks external
-- litigation participants only.
--
-- staff_name is a plain text placeholder for now, since it's
-- just you today. Once this is multi-user, this should
-- reference Supabase Auth users directly instead.
-- ------------------------------------------------------------
create table matter_staff (
    id              uuid primary key default gen_random_uuid(),
    matter_id       uuid not null references matters(id) on delete cascade,
    staff_name      text not null,
    created_at      timestamptz not null default now()
);

create index idx_matter_staff_matter on matter_staff (matter_id);

alter table matter_staff enable row level security;

create policy "authenticated_full_access_matter_staff"
    on matter_staff
    for all
    to authenticated
    using (true)
    with check (true);

-- ------------------------------------------------------------
-- EVENTS: starred (info bar) and pinned (Case Overview list)
-- Two independent flags, per event, per the Bullock screenshots.
-- ------------------------------------------------------------
alter table events
    add column if not exists starred boolean not null default false,
    add column if not exists pinned boolean not null default false;

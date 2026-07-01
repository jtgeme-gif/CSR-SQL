-- ============================================================
-- Matter Tracker v2 — Event Types lookup, Settlement/Mediation
-- tracking
-- Run this AFTER 20260701000006_case_details_counts_staff_flags.sql
-- ============================================================

-- ------------------------------------------------------------
-- EVENT_TYPES
-- Replaces free-text event_type on `events`. A lookup table
-- instead of a rigid CHECK list, so new types can be added
-- later as data (no migration needed), while keeping the
-- dropdown consistent and typo-proof.
-- ------------------------------------------------------------
create table event_types (
    id      uuid primary key default gen_random_uuid(),
    label   text not null unique
);

insert into event_types (label) values
    ('Discovery'),
    ('Court Deadline'),
    ('Deposition'),
    ('Hearing'),
    ('Status Conference/Pre-Trial');

alter table event_types enable row level security;

create policy "authenticated_full_access_event_types"
    on event_types
    for all
    to authenticated
    using (true)
    with check (true);

-- Swap events.event_type (text) for a proper foreign key
alter table events
    add column if not exists event_type_id uuid references event_types(id);

alter table events
    drop column if exists event_type;

create index idx_events_event_type on events (event_type_id);

-- ------------------------------------------------------------
-- ENTRY_TYPES
-- Same lookup pattern, for settlement_negotiations entries.
-- ------------------------------------------------------------
create table entry_types (
    id      uuid primary key default gen_random_uuid(),
    label   text not null unique
);

insert into entry_types (label) values
    ('Mediation'),
    ('Demand'),
    ('Offer');

alter table entry_types enable row level security;

create policy "authenticated_full_access_entry_types"
    on entry_types
    for all
    to authenticated
    using (true)
    with check (true);

-- ------------------------------------------------------------
-- SETTLEMENT_NEGOTIATIONS
-- Case content for the Mediation & Demands tab — separate
-- from Events/Scheduling, which just tracks the calendar date.
-- amount is pulled out as its own field for quick-glance
-- tracking of where negotiations stand; narrative detail still
-- goes in notes.
-- ------------------------------------------------------------
create table settlement_negotiations (
    id              uuid primary key default gen_random_uuid(),
    matter_id       uuid not null references matters(id) on delete cascade,
    entry_type_id   uuid not null references entry_types(id),
    entry_date      date not null,
    amount          numeric(12,2),
    notes           text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index idx_settlement_negotiations_matter on settlement_negotiations (matter_id);
create index idx_settlement_negotiations_entry_type on settlement_negotiations (entry_type_id);

alter table settlement_negotiations enable row level security;

create policy "authenticated_full_access_settlement_negotiations"
    on settlement_negotiations
    for all
    to authenticated
    using (true)
    with check (true);

create trigger trg_settlement_negotiations_updated_at before update on settlement_negotiations
    for each row execute function set_updated_at();

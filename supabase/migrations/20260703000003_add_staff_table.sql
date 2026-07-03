-- Structured Staff table, separate from `people` (people = external contacts,
-- staff = internal firm team). Recurring, needs a real email for Power Automate
-- triggers, and needs to support historical group/sort by staff on matters.

create table staff (
    id              uuid primary key default gen_random_uuid(),
    first_name      text not null,
    middle_name     text,
    last_name       text not null,
    email           text,
    cell_phone      text,
    work_phone      text,
    extension       text,
    active          boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- Link matter_staff to the new structured table. The existing staff_name
-- text column is left in place untouched — it holds real historical data
-- and gets backfilled separately once the roster is confirmed, not dropped.
alter table matter_staff add column staff_id uuid references staff(id) on delete set null;

create index idx_matter_staff_staff on matter_staff (staff_id);

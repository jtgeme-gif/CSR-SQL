-- ============================================================
-- Matter Tracker v2 — Case Notes
-- Run this AFTER 20260701000009_events_link_case_people.sql
--
-- Simple matter-level notes. author_id references Supabase's
-- own auth.users table directly (auth is already set up via
-- Azure OAuth), so authorship is a real link rather than a
-- plain text placeholder like matter_staff currently uses.
-- The "Quick Note" bar is this same table, just a shortcut UI
-- for adding to it from anywhere in the matter.
-- ============================================================

create table case_notes (
    id              uuid primary key default gen_random_uuid(),
    matter_id       uuid not null references matters(id) on delete cascade,
    author_id       uuid references auth.users(id),
    note_text       text not null,
    created_at      timestamptz not null default now()
);

create index idx_case_notes_matter on case_notes (matter_id);

alter table case_notes enable row level security;

create policy "authenticated_full_access_case_notes"
    on case_notes
    for all
    to authenticated
    using (true)
    with check (true);

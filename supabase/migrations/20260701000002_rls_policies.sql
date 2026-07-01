-- ============================================================
-- Matter Tracker v2 — RLS Policies
-- Run this AFTER 001_initial_schema.sql
--
-- Posture for now: single user (John), so policy is simply
-- "any authenticated user can do anything." No per-row
-- ownership logic yet — that gets added when this becomes
-- multi-user (Emma, Kathie, Tom, Gus).
--
-- Anonymous (anon) requests are never granted anything here,
-- so the tables stay closed to the public API by default.
-- ============================================================

-- Make sure RLS is explicitly on for every table, regardless
-- of whether the automatic-RLS trigger already caught it.
alter table entities      enable row level security;
alter table matters       enable row level security;
alter table people        enable row level security;
alter table case_entities enable row level security;
alter table case_people   enable row level security;
alter table events        enable row level security;

-- ------------------------------------------------------------
-- ENTITIES
-- ------------------------------------------------------------
create policy "authenticated_full_access_entities"
    on entities
    for all
    to authenticated
    using (true)
    with check (true);

-- ------------------------------------------------------------
-- MATTERS
-- ------------------------------------------------------------
create policy "authenticated_full_access_matters"
    on matters
    for all
    to authenticated
    using (true)
    with check (true);

-- ------------------------------------------------------------
-- PEOPLE
-- ------------------------------------------------------------
create policy "authenticated_full_access_people"
    on people
    for all
    to authenticated
    using (true)
    with check (true);

-- ------------------------------------------------------------
-- CASE_ENTITIES
-- ------------------------------------------------------------
create policy "authenticated_full_access_case_entities"
    on case_entities
    for all
    to authenticated
    using (true)
    with check (true);

-- ------------------------------------------------------------
-- CASE_PEOPLE
-- ------------------------------------------------------------
create policy "authenticated_full_access_case_people"
    on case_people
    for all
    to authenticated
    using (true)
    with check (true);

-- ------------------------------------------------------------
-- EVENTS
-- ------------------------------------------------------------
create policy "authenticated_full_access_events"
    on events
    for all
    to authenticated
    using (true)
    with check (true);

-- ============================================================
-- Matter Tracker v2 — Initial Schema
-- Supabase / Postgres
--
-- Architecture: Entities + People + Matter-level junctions + Events
-- See conversation notes for full design rationale.
-- ============================================================

-- ------------------------------------------------------------
-- ENTITIES
-- Flat table. No "type" column — TMHCC, Ven Johnson Law Firm,
-- and City of Hancock are all just entities. An entity can be
-- a party on a matter in its own right (case_entities), and/or
-- the employer of one or more people (people.entity_id).
-- ------------------------------------------------------------
create table entities (
    id              uuid primary key default gen_random_uuid(),
    name            text not null,
    address         text,
    city            text,
    state           text,
    zip             text,
    phone           text,
    email           text,
    notes           text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index idx_entities_name on entities (name);

-- ------------------------------------------------------------
-- MATTERS
-- Placeholder / minimal stub. This will be fleshed out
-- separately — included here only so foreign keys below
-- have something to reference.
-- ------------------------------------------------------------
create table matters (
    id              uuid primary key default gen_random_uuid(),
    file_number     text unique,
    case_name       text not null,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index idx_matters_file_number on matters (file_number);

-- ------------------------------------------------------------
-- PEOPLE
-- Tier 1 (person-level) attributes only. Case-specific role
-- and capacity live in case_people, not here.
--
-- identity: 'Individual' | 'Attorney' | 'Judge'
-- title: free text, mostly blank (e.g. "Chief of Police")
-- entity_id: who this person works for / is affiliated with
-- mediator: universal capability flag, not gated by identity
-- field_of_expertise: universal, optional, not gated by identity
--
-- Identity-specific fields (nullable, only populated when relevant):
--   Judge:    judge_page, court_level, court_jurisdiction, magjudge
--   Attorney: firm_type, assistant_name, assistant_email, mediation_notes
-- ------------------------------------------------------------
create table people (
    id                  uuid primary key default gen_random_uuid(),

    first_name          text,
    middle_name         text,
    last_name           text,
    title               text,

    identity            text not null default 'Individual'
                            check (identity in ('Individual', 'Attorney', 'Judge')),

    entity_id           uuid references entities(id) on delete set null,

    address             text,
    city                text,
    state               text,
    zip                 text,
    phone1              text,
    phone2              text,
    email1              text,
    email2              text,

    mediator            boolean not null default false,
    field_of_expertise  text,

    -- Judge-specific
    judge_page          text,
    court_level         text,
    court_jurisdiction  text,
    magjudge            boolean default false,

    -- Attorney-specific
    firm_type           text,
    assistant_name      text,
    assistant_email     text,
    mediation_notes     text,

    notes               text,

    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create index idx_people_last_name on people (last_name);
create index idx_people_entity_id on people (entity_id);
create index idx_people_identity on people (identity);

-- ------------------------------------------------------------
-- CASE_ENTITIES (junction)
-- Attaches an Entity to a Matter directly as a party,
-- independent of any individual person.
-- e.g. City of Hancock, Role = 'Defendant', on the Walby matter.
-- ------------------------------------------------------------
create table case_entities (
    id              uuid primary key default gen_random_uuid(),
    matter_id       uuid not null references matters(id) on delete cascade,
    entity_id       uuid not null references entities(id) on delete cascade,
    role            text not null,   -- e.g. 'Plaintiff', 'Defendant', 'Co-Defendant', 'Client'
    notes           text,
    created_at      timestamptz not null default now(),

    unique (matter_id, entity_id, role)
);

create index idx_case_entities_matter on case_entities (matter_id);
create index idx_case_entities_entity on case_entities (entity_id);

-- ------------------------------------------------------------
-- CASE_PEOPLE (junction)
-- Attaches a Person to a Matter with a Role specific to that
-- matter. Same person can have different roles on different
-- matters (the "Tomson problem" this schema exists to solve).
--
-- capacity: free-text modifier for how they appear in this
--   case, e.g. "as PR of the Estate of Benjamin Walby"
-- poc_entity_id: when role = 'POC', which case_entities-level
--   entity-party this person is the point of contact FOR on
--   this matter. Lets the UI group multiple POCs correctly
--   when a matter has more than one entity-defendant.
-- Expert-tracking fields are only meaningful when role = 'Expert'
--   but are not enforced at the DB level — the UI shows/hides
--   them conditionally.
-- ------------------------------------------------------------
create table case_people (
    id                  uuid primary key default gen_random_uuid(),
    matter_id           uuid not null references matters(id) on delete cascade,
    person_id           uuid not null references people(id) on delete cascade,

    role                text not null,   -- e.g. 'Plaintiff', 'Defendant', 'Witness', 'Expert', 'Mediator', 'POC'
    capacity            text,            -- e.g. "as PR of the Estate of Benjamin Walby"

    poc_entity_id       uuid references entities(id) on delete set null,

    -- Expert-only tracking (nullable, conditional in UI)
    disclosed           boolean,
    cv_received         boolean,
    report_received     boolean,
    deposed             boolean,

    active              boolean not null default true,
    notes               text,

    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create index idx_case_people_matter on case_people (matter_id);
create index idx_case_people_person on case_people (person_id);
create index idx_case_people_poc_entity on case_people (poc_entity_id);

-- ------------------------------------------------------------
-- EVENTS
-- Consolidates Discovery / Scheduling / Motions / Depositions /
-- Hearings / Mediation into one Type + Description model.
-- Rides the same "all-day vs timed" split as the existing
-- calendar-sync flow architecture.
--
-- event_type is intentionally free text (not an enum) so new
-- types can be added without a schema migration.
-- ------------------------------------------------------------
create table events (
    id                  uuid primary key default gen_random_uuid(),
    matter_id           uuid not null references matters(id) on delete cascade,

    event_type          text not null,   -- e.g. 'Court Deadline', 'Hearing', 'Pre-Trial/Status Conference',
                                          --      'Mediation', 'Discovery Request', 'Deposition'
    event_date          date not null,
    all_day             boolean not null default true,
    description         text,

    outlook_event_id    text,            -- writeback target for calendar sync

    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create index idx_events_matter on events (matter_id);
create index idx_events_date on events (event_date);
create index idx_events_type on events (event_type);

-- ------------------------------------------------------------
-- updated_at auto-touch trigger (applied to tables that track it)
-- ------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger trg_entities_updated_at before update on entities
    for each row execute function set_updated_at();
create trigger trg_matters_updated_at before update on matters
    for each row execute function set_updated_at();
create trigger trg_people_updated_at before update on people
    for each row execute function set_updated_at();
create trigger trg_case_people_updated_at before update on case_people
    for each row execute function set_updated_at();
create trigger trg_events_updated_at before update on events
    for each row execute function set_updated_at();

-- Outlook / Power Automate Calendar Sync - schema additions
-- Ref: PA_Outlook_Calendar_Sync_Design.docx

-- Short name for calendar event titles ("[Short Name] - [Event]").
-- Auto-derived from Case Name (everything before " v "/" v. ") only when
-- blank - app-layer logic, not a DB trigger, so it never fights a manual edit.
ALTER TABLE matters ADD COLUMN IF NOT EXISTS short_name text;

-- One outlook_event_id per date slot. Court Deadline, Discovery (Response
-- Due only), and every timed type only ever use slot 1. Motion/Brief is the
-- only type where slots 2 and 3 (Response Due, Reply Due) are independently
-- trackable calendar events, since those dates commonly move independently
-- of each other and of Filed.
ALTER TABLE events ADD COLUMN IF NOT EXISTS outlook_event_id text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS outlook_event_id_2 text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS outlook_event_id_3 text;

-- Tracks whether the calendar currently reflects this event as timed or
-- all-day, as of the last successful sync. Compared against the event's
-- current type at Sync Calendar time to detect a type change (e.g. someone
-- changes an event's type such that timed/all-day flips), which requires a
-- delete+recreate against Outlook rather than a normal update. Null means
-- never synced yet - i.e. next sync is a plain Create, not a Update/Delete.
ALTER TABLE events ADD COLUMN IF NOT EXISTS last_synced_as_timed boolean;

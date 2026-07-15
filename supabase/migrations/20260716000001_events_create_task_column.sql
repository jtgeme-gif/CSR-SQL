-- Adds the "Create Task" column ahead of the Task tab build. Nothing reads
-- or writes this yet - the checkbox shown in the Import Scheduling Document
-- review table is purely visual for now (defaults checked, has no effect).
-- This just means the column already exists so the future Task tab build
-- doesn't need its own migration for it.

alter table events add column if not exists create_task boolean not null default true;

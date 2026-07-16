-- Adds the Attorney/Support distinction to staff, needed so the new
-- CSR/budget form auto-email (on matter creation) can be limited to
-- attorneys only, not every assigned staff member.

alter table staff add column if not exists is_attorney boolean not null default false;

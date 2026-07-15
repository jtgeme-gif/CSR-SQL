-- Adds manual-override ordering for the Parties section on the matter detail page.
-- NULL (the default) means "let auto-sort-by-attorney decide the position."
-- Once a user nudges a party up/down within a role group, that whole group gets
-- explicit sequential values here and auto-sort stops applying to it.

alter table case_people add column if not exists sort_order integer;
alter table case_entities add column if not exists sort_order integer;

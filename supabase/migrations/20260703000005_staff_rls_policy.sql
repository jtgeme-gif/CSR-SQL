-- The staff table migration didn't include an RLS policy, unlike every
-- other table in this schema. Without one, Supabase blocks all reads/writes
-- by default, which is why staff records don't show up in the app even
-- though the insert succeeded.

alter table staff enable row level security;

create policy "Authenticated users have full access to staff"
  on staff
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

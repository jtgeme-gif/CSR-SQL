-- person_links was created without RLS policies, blocking all inserts by
-- default. Same access model as the rest of the app: any authenticated
-- (logged-in) user can read, add, and remove links.

ALTER TABLE person_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read person_links"
  ON person_links FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert person_links"
  ON person_links FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete person_links"
  ON person_links FOR DELETE
  TO authenticated
  USING (true);

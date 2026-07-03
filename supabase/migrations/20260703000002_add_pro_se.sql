-- Pro Se flag: per-matter attribute of a Plaintiff/Co-Defendant party,
-- same pattern as capacity — lives on the junction row, not the person.

ALTER TABLE case_people
  ADD COLUMN pro_se boolean NOT NULL DEFAULT false;

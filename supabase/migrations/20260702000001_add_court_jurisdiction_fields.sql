-- Add fuller Court & Jurisdiction fields to matters table
-- court_case_number already exists and is reused as "Case Number" in the rebuilt card

ALTER TABLE matters
  ADD COLUMN court_level text,
  ADD COLUMN court_jurisdiction text,
  ADD COLUMN circuit_county_division text,
  ADD COLUMN date_filed date,
  ADD COLUMN date_client_served date;

COMMENT ON COLUMN matters.court_level IS 'Free text, e.g. Circuit Court, District Court, Court of Appeals, Federal District, MI Supreme Court, US Supreme Court';
COMMENT ON COLUMN matters.court_jurisdiction IS 'Free text, e.g. Wayne County, Eastern District of Michigan';
COMMENT ON COLUMN matters.circuit_county_division IS 'Free text; content depends on court_level (Circuit no., County, or Division)';

-- Single flexible field for address OR meeting info (Zoom link, dial-in, etc.)
-- rather than separate columns, since these are usually mutually exclusive.
-- Only surfaced in the UI for Deposition, Status Conference/Pre-Trial, and
-- Hearing — the appointment-style event types where "where" is a live question.

ALTER TABLE events ADD COLUMN location text;

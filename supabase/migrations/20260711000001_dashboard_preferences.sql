-- Per-user Dashboard settings (the two "Due Within X days" values), stored
-- server-side rather than localStorage so they follow a user across any
-- device/browser, but stay private to that specific person. Keyed by email,
-- matching the same email-based identity pattern already used to link
-- Assigned Staff to a logged-in user elsewhere in the app.

CREATE TABLE dashboard_preferences (
    user_email        text PRIMARY KEY,
    due_soon_days_1   integer NOT NULL DEFAULT 5,
    due_soon_days_2   integer NOT NULL DEFAULT 14,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dashboard_preferences ENABLE ROW LEVEL SECURITY;

-- Each user can only ever see/edit their own row, based on the email in
-- their own auth session - not just a client-side filter, enforced by RLS.
CREATE POLICY "Users manage their own dashboard preferences"
  ON dashboard_preferences FOR ALL
  USING (auth.jwt() ->> 'email' = user_email)
  WITH CHECK (auth.jwt() ->> 'email' = user_email);

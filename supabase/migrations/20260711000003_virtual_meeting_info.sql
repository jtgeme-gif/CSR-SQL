-- Virtual Meeting Info - a plain-text paste target for Zoom/Teams dial-in
-- blocks (link, passcode, phone numbers, etc.), kept separate from Location
-- so a physical address can still resolve cleanly to Google Maps. Only
-- applies to the same timed event types that already use Location
-- (Deposition, Hearing, Status Conference/Pre-Trial, Trial, Mediation) -
-- gated in the app by the existing hasLocation config flag, no new flag needed.
ALTER TABLE events ADD COLUMN IF NOT EXISTS virtual_meeting_info text;

-- csr_item_id: the permanent SharePoint item ID once a matter is linked to
-- the CSR Tracker. This becomes the real connection going forward - Title
-- matching only matters at the moment of initial creation/linking, since
-- an item's ID never changes even if Title (Case Name) is later renamed.

ALTER TABLE matters ADD COLUMN csr_item_id text;

-- file_closed: the firm's own "stop actively monitoring" decision, driven
-- by the new Close/Reopen button. Deliberately separate from case_status,
-- which reflects the court's own procedural state (one of Pre-litigation
-- Monitoring/Active Litigation/Stayed/Closed/Appeal) - these are two
-- different facts that shouldn't share one field.

ALTER TABLE matters ADD COLUMN file_closed boolean NOT NULL DEFAULT false;

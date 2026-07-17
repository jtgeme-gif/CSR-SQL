-- Matters created through CSR-SQL are flagged so NMT can exclude them
-- entirely from its own views (All Matters, Dashboard) - full stop, no
-- exceptions - until someone deliberately wants to start using NMT's
-- fuller feature set for that matter and flips this off. Defaults false
-- so every matter created directly in NMT is completely unaffected.
--
-- Deliberately NOT applied to the CSR digest crons (csr-digest-cron,
-- csr-due-tomorrow-cron) - those stay firm-wide regardless of origin,
-- per earlier design: "the digests run and capture the data regardless
-- of whether it was created in the CSR modal or the NMT modal."

alter table matters add column if not exists created_in_csr boolean not null default false;

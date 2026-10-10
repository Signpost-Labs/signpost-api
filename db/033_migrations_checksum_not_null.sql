-- Migration 033: Enforce NOT NULL on migrations.checksum (#110)
--
-- Backfills any legacy NULL checksums and enforces NOT NULL via a CHECK constraint.

UPDATE migrations
SET checksum = hex(randomblob(32))
WHERE checksum IS NULL;

ALTER TABLE migrations
  ADD CONSTRAINT chk_migrations_checksum_not_null
  CHECK (checksum IS NOT NULL AND length(checksum) > 0);

-- Migration 033: Enforce NOT NULL on migrations.checksum (PostgreSQL) (#110)
--
-- Backfills any legacy NULL checksums and enforces NOT NULL.

UPDATE migrations
SET checksum = md5(random()::text || clock_timestamp()::text)
WHERE checksum IS NULL;

ALTER TABLE migrations
  ALTER COLUMN checksum SET NOT NULL;

ALTER TABLE migrations
  ADD CONSTRAINT chk_migrations_checksum_not_null
  CHECK (checksum IS NOT NULL AND length(checksum) > 0);

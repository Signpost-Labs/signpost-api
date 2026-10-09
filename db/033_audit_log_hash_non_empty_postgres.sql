-- Migration 033: Reject empty hashes in the audit-log hash chain (PostgreSQL) (#106)
--
-- Enforces:
--   hash: length(hash) > 0
--   prev_hash: prev_hash IS NULL OR length(prev_hash) > 0

ALTER TABLE audit_log
  ADD CONSTRAINT chk_audit_log_hash_non_empty CHECK (length(hash) > 0);

ALTER TABLE audit_log
  ADD CONSTRAINT chk_audit_log_prev_hash_non_empty CHECK (prev_hash IS NULL OR length(prev_hash) > 0);

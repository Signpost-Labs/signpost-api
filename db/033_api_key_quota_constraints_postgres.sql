-- Migration 033: Enforce non-negative constraints on API key quota and request count (PostgreSQL) (#105)
--
-- Adds CHECK constraints:
--   api_keys.monthly_quota: NULL (unlimited) or >= 0
--   api_key_usage.request_count: >= 0

ALTER TABLE api_keys
  ADD CONSTRAINT chk_api_keys_monthly_quota CHECK (monthly_quota IS NULL OR monthly_quota >= 0);

ALTER TABLE api_key_usage
  ADD CONSTRAINT chk_api_key_usage_request_count CHECK (request_count >= 0);

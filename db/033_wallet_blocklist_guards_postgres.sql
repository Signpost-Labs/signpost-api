-- Migration 033: Guard wallet_blocklist reason length and wallet format (PostgreSQL) (#1019, #109)
-- Enforces length(wallet) > 0 and (reason IS NULL OR length(reason) <= 500)

ALTER TABLE wallet_blocklist
  ADD CONSTRAINT chk_wallet_blocklist_wallet_not_empty CHECK (length(wallet) > 0),
  ADD CONSTRAINT chk_wallet_blocklist_reason_length CHECK (reason IS NULL OR length(reason) <= 500);

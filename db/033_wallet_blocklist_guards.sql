-- Migration 033: Guard wallet_blocklist reason length and wallet format (#1019, #109)
-- Enforces length(wallet) > 0 and (reason IS NULL OR length(reason) <= 500)

CREATE TRIGGER IF NOT EXISTS trg_wallet_blocklist_insert_guard
BEFORE INSERT ON wallet_blocklist
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN length(NEW.wallet) = 0 THEN
      RAISE(ABORT, 'wallet cannot be empty')
    WHEN NEW.reason IS NOT NULL AND length(NEW.reason) > 500 THEN
      RAISE(ABORT, 'reason length cannot exceed 500 characters')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_wallet_blocklist_update_guard
BEFORE UPDATE ON wallet_blocklist
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN length(NEW.wallet) = 0 THEN
      RAISE(ABORT, 'wallet cannot be empty')
    WHEN NEW.reason IS NOT NULL AND length(NEW.reason) > 500 THEN
      RAISE(ABORT, 'reason length cannot exceed 500 characters')
  END;
END;

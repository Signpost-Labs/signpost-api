-- Migration 033: Validate webhook_subscriptions.event_types (#108)
--
-- Ensures event_types is either NULL or a valid JSON array.

UPDATE webhook_subscriptions
SET event_types = NULL
WHERE event_types IS NOT NULL
  AND (json_valid(event_types) = 0 OR json_type(event_types) != 'array');

ALTER TABLE webhook_subscriptions
  ADD CONSTRAINT chk_webhook_sub_event_types_json
  CHECK (
    event_types IS NULL
    OR (json_valid(event_types) = 1 AND json_type(event_types) = 'array')
  );

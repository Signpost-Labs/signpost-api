-- Migration 033: Validate webhook_subscriptions.event_types (PostgreSQL) (#108)
--
-- Ensures event_types is either NULL or a valid JSON array.

ALTER TABLE webhook_subscriptions
  ADD CONSTRAINT chk_webhook_sub_event_types_json
  CHECK (
    event_types IS NULL
    OR (
      jsonb_typeof(event_types::jsonb) = 'array'
    )
  );

import Database from 'better-sqlite3';
import { runMigrations } from '../../src/db/migrate';
import { SqliteDriver } from '../../src/db/sqlite-driver';
import { createWebhookSubscription, initDb, closeDb } from '../../src/db';

describe('webhook_subscriptions.event_types schema validation (#108)', () => {
  let db: Database.Database;

  beforeEach(async () => {
    db = new Database(':memory:');
    const driver = new SqliteDriver(db);
    await runMigrations(driver);
  });

  afterEach(() => {
    db.close();
  });

  it('rejects an insert with invalid JSON in event_types', () => {
    expect(() => {
      db.prepare(
        'INSERT INTO webhook_subscriptions (url, secret, event_types) VALUES (?, ?, ?)'
      ).run('https://example.com/webhook', 'secret123', 'not json');
    }).toThrow(/CHECK constraint failed/i);
  });

  it('rejects an insert where event_types is a JSON object instead of an array', () => {
    expect(() => {
      db.prepare(
        'INSERT INTO webhook_subscriptions (url, secret, event_types) VALUES (?, ?, ?)'
      ).run('https://example.com/webhook', 'secret123', '{"type":"player_registered"}');
    }).toThrow(/CHECK constraint failed/i);
  });

  it('allows inserting NULL event_types (all events)', () => {
    const info = db
      .prepare('INSERT INTO webhook_subscriptions (url, secret, event_types) VALUES (?, ?, ?)')
      .run('https://example.com/webhook', 'secret123', null);

    const row = db
      .prepare('SELECT url, event_types FROM webhook_subscriptions WHERE id = ?')
      .get(info.lastInsertRowid) as { url: string; event_types: string | null };

    expect(row.url).toBe('https://example.com/webhook');
    expect(row.event_types).toBeNull();
  });

  it('allows inserting a valid JSON array of event types and round-trips correctly', () => {
    const eventTypesJson = JSON.stringify(['player_registered', 'milestone_approved']);
    const info = db
      .prepare('INSERT INTO webhook_subscriptions (url, secret, event_types) VALUES (?, ?, ?)')
      .run('https://example.com/webhook', 'secret123', eventTypesJson);

    const row = db
      .prepare('SELECT url, event_types FROM webhook_subscriptions WHERE id = ?')
      .get(info.lastInsertRowid) as { url: string; event_types: string };

    expect(row.url).toBe('https://example.com/webhook');
    expect(JSON.parse(row.event_types)).toEqual(['player_registered', 'milestone_approved']);
  });
});

describe('createWebhookSubscription application-level event_types validation (#108)', () => {
  beforeEach(async () => {
    await initDb();
  });

  afterEach(async () => {
    await closeDb();
  });

  it('accepts valid known CONTRACT_EVENT_TYPES in createWebhookSubscription', () => {
    const sub = createWebhookSubscription(
      'https://example.com/webhook-app',
      'secret-test',
      undefined,
      ['player_registered', 'milestone_approved']
    );

    expect(sub).toBeDefined();
    expect(sub.url).toBe('https://example.com/webhook-app');
    expect(JSON.parse(sub.event_types!)).toEqual(['player_registered', 'milestone_approved']);
  });

  it('throws when an unknown event type is provided to createWebhookSubscription', () => {
    expect(() => {
      createWebhookSubscription(
        'https://example.com/webhook-invalid',
        'secret-test',
        undefined,
        ['non_existent_event_type' as any]
      );
    }).toThrow(/Invalid event type: non_existent_event_type/i);
  });
});

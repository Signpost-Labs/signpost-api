/**
 * Tests for API key quota and request count constraints (#105)
 *
 * Verifies:
 *  - api_keys.monthly_quota allows NULL (unlimited) and non-negative values
 *  - api_keys.monthly_quota rejects negative values on INSERT and UPDATE
 *  - api_key_usage.request_count allows zero and positive values
 *  - api_key_usage.request_count rejects negative values on INSERT and UPDATE
 *  - apiKeyHelpers validates non-negative inputs
 */
import Database from 'better-sqlite3';
import { runMigrations } from '../../src/db/migrate';
import { SqliteDriver } from '../../src/db/sqlite-driver';
import { updateApiKeyMonthlyQuota, recordApiKeyUsage, getApiKeyUsage } from '../../src/db/apiKeyHelpers';
import * as dbModule from '../../src/db';

describe('API key quota and request count constraints (Issue #105)', () => {
  let db: Database.Database;
  let driver: SqliteDriver;

  beforeEach(async () => {
    db = new Database(':memory:');
    driver = new SqliteDriver(db);
    jest.spyOn(dbModule, 'getDriver').mockReturnValue(driver);
    await runMigrations(driver);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('api_keys.monthly_quota constraint', () => {
    it('allows inserting NULL monthly_quota (unlimited)', () => {
      const res = db.prepare(`
        INSERT INTO api_keys (key_hash, scout_wallet, created_at, monthly_quota)
        VALUES ('hash_null', '0xScout1', 1000, NULL)
      `).run();
      expect(res.changes).toBe(1);

      const row = db.prepare('SELECT monthly_quota FROM api_keys WHERE id = ?').get(res.lastInsertRowid) as { monthly_quota: number | null };
      expect(row.monthly_quota).toBeNull();
    });

    it('allows inserting positive monthly_quota', () => {
      const res = db.prepare(`
        INSERT INTO api_keys (key_hash, scout_wallet, created_at, monthly_quota)
        VALUES ('hash_pos', '0xScout1', 1000, 5000)
      `).run();
      expect(res.changes).toBe(1);

      const row = db.prepare('SELECT monthly_quota FROM api_keys WHERE id = ?').get(res.lastInsertRowid) as { monthly_quota: number };
      expect(row.monthly_quota).toBe(5000);
    });

    it('allows inserting zero monthly_quota', () => {
      const res = db.prepare(`
        INSERT INTO api_keys (key_hash, scout_wallet, created_at, monthly_quota)
        VALUES ('hash_zero', '0xScout1', 1000, 0)
      `).run();
      expect(res.changes).toBe(1);

      const row = db.prepare('SELECT monthly_quota FROM api_keys WHERE id = ?').get(res.lastInsertRowid) as { monthly_quota: number };
      expect(row.monthly_quota).toBe(0);
    });

    it('rejects inserting negative monthly_quota with CHECK constraint failure', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO api_keys (key_hash, scout_wallet, created_at, monthly_quota)
          VALUES ('hash_neg', '0xScout1', 1000, -1)
        `).run();
      }).toThrow(/CHECK constraint failed: chk_api_keys_monthly_quota/);
    });

    it('rejects updating to negative monthly_quota with CHECK constraint failure', () => {
      const res = db.prepare(`
        INSERT INTO api_keys (key_hash, scout_wallet, created_at, monthly_quota)
        VALUES ('hash_update', '0xScout1', 1000, 100)
      `).run();

      expect(() => {
        db.prepare(`
          UPDATE api_keys SET monthly_quota = -50 WHERE id = ?
        `).run(res.lastInsertRowid);
      }).toThrow(/CHECK constraint failed: chk_api_keys_monthly_quota/);
    });

    it('allows updating to valid non-negative or NULL monthly_quota', () => {
      const res = db.prepare(`
        INSERT INTO api_keys (key_hash, scout_wallet, created_at, monthly_quota)
        VALUES ('hash_update_valid', '0xScout1', 1000, 100)
      `).run();

      db.prepare('UPDATE api_keys SET monthly_quota = 200 WHERE id = ?').run(res.lastInsertRowid);
      let row = db.prepare('SELECT monthly_quota FROM api_keys WHERE id = ?').get(res.lastInsertRowid) as { monthly_quota: number | null };
      expect(row.monthly_quota).toBe(200);

      db.prepare('UPDATE api_keys SET monthly_quota = NULL WHERE id = ?').run(res.lastInsertRowid);
      row = db.prepare('SELECT monthly_quota FROM api_keys WHERE id = ?').get(res.lastInsertRowid) as { monthly_quota: number | null };
      expect(row.monthly_quota).toBeNull();
    });
  });

  describe('api_key_usage.request_count constraint', () => {
    let keyId: number;

    beforeEach(() => {
      const res = db.prepare(`
        INSERT INTO api_keys (key_hash, scout_wallet, created_at)
        VALUES ('hash_for_usage', '0xScout1', 1000)
      `).run();
      keyId = Number(res.lastInsertRowid);
    });

    it('allows inserting zero and positive request_count', () => {
      const res0 = db.prepare(`
        INSERT INTO api_key_usage (key_id, period, request_count, created_at, updated_at)
        VALUES (?, '2026-09', 0, 1000, 1000)
      `).run(keyId);
      expect(res0.changes).toBe(1);

      const res1 = db.prepare(`
        INSERT INTO api_key_usage (key_id, period, request_count, created_at, updated_at)
        VALUES (?, '2026-10', 42, 1000, 1000)
      `).run(keyId);
      expect(res1.changes).toBe(1);
    });

    it('rejects inserting negative request_count with CHECK constraint failure', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO api_key_usage (key_id, period, request_count, created_at, updated_at)
          VALUES (?, '2026-10', -1, 1000, 1000)
        `).run(keyId);
      }).toThrow(/CHECK constraint failed: chk_api_key_usage_request_count/);
    });

    it('rejects updating to negative request_count with CHECK constraint failure', () => {
      db.prepare(`
        INSERT INTO api_key_usage (key_id, period, request_count, created_at, updated_at)
        VALUES (?, '2026-10', 10, 1000, 1000)
      `).run(keyId);

      expect(() => {
        db.prepare(`
          UPDATE api_key_usage SET request_count = -5 WHERE key_id = ? AND period = '2026-10'
        `).run(keyId);
      }).toThrow(/CHECK constraint failed: chk_api_key_usage_request_count/);
    });
  });

  describe('apiKeyHelpers validation', () => {
    let keyId: number;

    beforeEach(() => {
      const res = db.prepare(`
        INSERT INTO api_keys (key_hash, scout_wallet, created_at)
        VALUES ('hash_helpers', '0xScout1', 1000)
      `).run();
      keyId = Number(res.lastInsertRowid);
    });

    it('updateApiKeyMonthlyQuota validates non-negative input', async () => {
      await expect(updateApiKeyMonthlyQuota(keyId, -1)).rejects.toThrow('monthly_quota must be non-negative or null');

      await updateApiKeyMonthlyQuota(keyId, 250);
      const row = db.prepare('SELECT monthly_quota FROM api_keys WHERE id = ?').get(keyId) as { monthly_quota: number };
      expect(row.monthly_quota).toBe(250);

      await updateApiKeyMonthlyQuota(keyId, null);
      const rowNull = db.prepare('SELECT monthly_quota FROM api_keys WHERE id = ?').get(keyId) as { monthly_quota: number | null };
      expect(rowNull.monthly_quota).toBeNull();
    });

    it('recordApiKeyUsage validates non-negative count', async () => {
      await expect(recordApiKeyUsage(keyId, '2026-10', -1)).rejects.toThrow('request_count must be non-negative');

      await recordApiKeyUsage(keyId, '2026-10', 100);
      const count = await getApiKeyUsage(keyId, '2026-10');
      expect(count).toBe(100);
    });
  });
});

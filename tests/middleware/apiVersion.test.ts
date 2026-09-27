import { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import app from '../../src/app';
import { apiVersion } from '../../src/middleware/apiVersion';
import { getVersionInfo } from '../../src/version';
import allowlist from '../../src/config/apiVersioning';

describe('apiVersion middleware', () => {
  const expectedMajor = getVersionInfo().version.split('.')[0] ?? '1';

  // ─── Unit tests with mock req / res ─────────────────────────────────────────
  describe('unit tests (isolated middleware)', () => {
    it('sets X-API-Version header to major version on res', () => {
      const req = {} as Request;
      const setHeader = jest.fn();
      const res = { setHeader } as unknown as Response;
      const next = jest.fn() as NextFunction;

      apiVersion(req, res, next);

      expect(setHeader).toHaveBeenCalledTimes(1);
      expect(setHeader).toHaveBeenCalledWith('X-API-Version', expectedMajor);
    });

    it('calls next() exactly once with no arguments', () => {
      const req = {} as Request;
      const setHeader = jest.fn();
      const res = { setHeader } as unknown as Response;
      const next = jest.fn() as NextFunction;

      apiVersion(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
    });

    it('sets the header before calling next()', () => {
      const req = {} as Request;
      let headerSetWhenNextCalled = false;
      const res = {
        setHeader: jest.fn(() => {
          headerSetWhenNextCalled = true;
        }),
      } as unknown as Response;
      const next = jest.fn(() => {
        expect(headerSetWhenNextCalled).toBe(true);
      }) as NextFunction;

      apiVersion(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Integration tests via app (supertest) ──────────────────────────────────
  describe('integration tests via app', () => {
    it('includes X-API-Version header on GET /version', async () => {
      const res = await request(app).get('/version');

      expect(res.status).toBe(200);
      expect(res.headers['x-api-version']).toBe(expectedMajor);
      expect(res.body).toHaveProperty('version');
    });

    it('includes X-API-Version header on GET /health', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.headers['x-api-version']).toBe(expectedMajor);
    });

    it('includes X-API-Version header on 404 responses (proves global pre-route execution)', async () => {
      const res = await request(app).get('/this-path-does-not-exist');

      expect(res.status).toBe(404);
      expect(res.headers['x-api-version']).toBe(expectedMajor);
    });

    it('includes X-API-Version on allowlisted apiVersioning divergent routes', async () => {
      for (const allowlistedPath of allowlist) {
        const res = await request(app).get(`/api/v2${allowlistedPath}`);
        expect(res.headers['x-api-version']).toBe(expectedMajor);
      }
    });
  });
});

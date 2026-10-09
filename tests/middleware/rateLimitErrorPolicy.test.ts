import { Request, Response, NextFunction } from 'express';
import { rateLimit, walletRateLimit, playerRateLimit } from '../../src/middleware/rateLimit';
import { RateLimitStore } from '../../src/middleware/rateLimitStore';

function makeReqRes(ip = '127.0.0.1') {
  const req = { ip } as unknown as Request;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
  } as unknown as Response;
  const next = jest.fn() as NextFunction;
  return { req, res, next };
}

class FailingStore implements RateLimitStore {
  async increment(_key: string, _windowMs: number): Promise<{ count: number; resetAt: number }> {
    throw new Error('Simulated Redis outage');
  }
}

describe('Rate limiter error policy handling (issue #61)', () => {
  it('returns 503 when errorPolicy is "closed" and store fails', async () => {
    const store = new FailingStore();
    const mw = rateLimit({
      store,
      errorPolicy: 'closed',
    });

    const { req, res, next } = makeReqRes('1.2.3.4');
    await mw(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: 'SERVICE_UNAVAILABLE',
      })
    );
  });

  it('falls back to in-memory store when errorPolicy is "local" and store fails', async () => {
    const store = new FailingStore();
    const mw = rateLimit({
      store,
      errorPolicy: 'local',
      max: 2,
      windowMs: 60_000,
      name: 'test-local-fallback',
    });

    const ip = '5.6.7.8';

    // First request passes through fallback in-memory store
    const first = makeReqRes(ip);
    await mw(first.req, first.res, first.next);
    expect(first.next).toHaveBeenCalledTimes(1);
    expect(first.res.status).not.toHaveBeenCalled();

    // Second request passes
    const second = makeReqRes(ip);
    await mw(second.req, second.res, second.next);
    expect(second.next).toHaveBeenCalledTimes(1);

    // Third request exceeds limit on fallback in-memory store -> 429
    const third = makeReqRes(ip);
    await mw(third.req, third.res, third.next);
    expect(third.next).not.toHaveBeenCalled();
    expect(third.res.status).toHaveBeenCalledWith(429);
  });

  it('fails open (calls next()) when errorPolicy is "open" and store fails', async () => {
    const store = new FailingStore();
    const mw = rateLimit({
      store,
      errorPolicy: 'open',
    });

    const { req, res, next } = makeReqRes('9.10.11.12');
    await mw(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('walletRateLimit honors errorPolicy="closed"', async () => {
    const store = new FailingStore();
    const mw = walletRateLimit({
      store,
      errorPolicy: 'closed',
    });

    const req = { ip: '127.0.0.1', account: 'G_TEST_WALLET' } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    await mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('playerRateLimit honors errorPolicy="closed"', async () => {
    const store = new FailingStore();
    const mw = playerRateLimit({
      store,
      errorPolicy: 'closed',
    });

    const req = { ip: '127.0.0.1', body: { playerId: 'player-123' } } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    await mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
  });
});

import { Request, Response, NextFunction } from 'express';
import config from '../config';
import { RateLimitStore } from './rateLimitStore';
import { InMemoryRateLimitStore } from './inMemoryRateLimitStore';
import { RedisRateLimitStore } from './redisRateLimitStore';
import { getRedisClient } from '../services/redis';
import { logger } from '../utils/logger';
import { ErrorCode } from '../utils/errorCodes';

function createStore(): RateLimitStore {
  const redis = getRedisClient();
  if (redis) {
    return new RedisRateLimitStore(redis);
  }
  return new InMemoryRateLimitStore();
}

const defaultStore: RateLimitStore = createStore();
const fallbackLocalStore: RateLimitStore = new InMemoryRateLimitStore();

export interface RateLimitOptions {
  windowMs?: number; // time window in ms (default: config.rateLimit.windowMs)
  max?: number;      // max requests per window per IP (default: config.rateLimit.max)
  store?: RateLimitStore; // override default store (useful for tests)
  /** Return a stable subject key instead of the request IP for identity-based limits. */
  keyGenerator?: (req: Request) => string | undefined;
  /**
   * Namespace distinguishing this limiter's counters from every other
   * rateLimit() instance sharing the same default store.
   */
  name?: string;
  /**
   * Error policy when backing store encounters an error.
   * - 'open': allow requests (fail-open)
   * - 'closed': reject with 503 (fail-closed)
   * - 'local': fall back to per-instance in-memory counters
   * Default: config.rateLimitErrorPolicy (or 'open') for general limiters,
   *          config.authRateLimitErrorPolicy for auth limiters.
   */
  errorPolicy?: 'open' | 'closed' | 'local';
}

async function handleStoreError({
  err,
  identifier,
  identifierType,
  errorPolicy,
  namespace,
  key,
  windowMs,
  max,
  res,
  next,
}: {
  err: unknown;
  identifier: string;
  identifierType: 'ip' | 'wallet' | 'playerId';
  errorPolicy: 'open' | 'closed' | 'local';
  namespace: string;
  key: string;
  windowMs: number;
  max: number;
  res: Response;
  next: NextFunction;
}): Promise<void> {
  if (errorPolicy === 'closed') {
    logger.warn(`[rate-limit] store error (${identifierType}), failing closed (503)`, { [identifierType]: identifier, err });
    res.status(503).json({
      success: false,
      error: 'Service temporarily unavailable, please try again later',
      code: ErrorCode.SERVICE_UNAVAILABLE,
    });
    return;
  }

  if (errorPolicy === 'local') {
    logger.warn(`[rate-limit] store error (${identifierType}), falling back to in-memory store`, { [identifierType]: identifier, err });
    try {
      const { count, resetAt } = await fallbackLocalStore.increment(`${namespace}:${key}`, windowMs);
      if (count > max) {
        const now = Date.now();
        const retryAfterSec = Math.ceil(Math.max(0, resetAt - now) / 1000);
        res.set('Retry-After', String(retryAfterSec || 1));
        const errorMessage =
          identifierType === 'playerId'
            ? 'Too many milestone submissions for this player, please try again later'
            : 'Too many requests, please try again later';
        res.status(429).json({
          success: false,
          error: errorMessage,
          code: ErrorCode.RATE_LIMITED,
        });
        return;
      }
      next();
    } catch (fallbackErr) {
      logger.warn(`[rate-limit] fallback store error (${identifierType}), failing open`, { [identifierType]: identifier, fallbackErr });
      next();
    }
    return;
  }

  // Default: fail open
  logger.warn(`[rate-limit] store error (${identifierType}), failing open`, { [identifierType]: identifier, err });
  next();
}

/**
 * Simple in-process or Redis-backed IP-based rate limiter.
 * Configurable via windowMs and max; excess requests return HTTP 429.
 */
export function rateLimit(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs ?? config.rateLimit.windowMs;
  const max = options.max ?? config.rateLimit.max;
  const store = options.store ?? defaultStore;
  const namespace = options.name ?? 'default';
  const errorPolicy: 'open' | 'closed' | 'local' =
    options.errorPolicy ??
    (namespace.startsWith('auth:')
      ? (config.authRateLimitErrorPolicy || 'closed')
      : (config.rateLimitErrorPolicy || 'open'));

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!config.rateLimit.enabled) {
      next();
      return;
    }
    const ip = req.ip ?? 'unknown';

    try {
      const key = options.keyGenerator?.(req) || `ip:${ip}`;
      const { count, resetAt } = await store.increment(`${namespace}:${key}`, windowMs);

      if (count > max) {
        const now = Date.now();
        const retryAfterSec = Math.ceil(Math.max(0, resetAt - now) / 1000);
        res.set('Retry-After', String(retryAfterSec || 1));
        res.status(429).json({
          success: false,
          error: 'Too many requests, please try again later',
          code: ErrorCode.RATE_LIMITED,
        });
        return;
      }
      next();
    } catch (err) {
      const key = options.keyGenerator?.(req) || `ip:${ip}`;
      await handleStoreError({
        err,
        identifier: ip,
        identifierType: 'ip',
        errorPolicy,
        namespace,
        key,
        windowMs,
        max,
        res,
        next,
      });
    }
  };
}

/**
 * Rate limiter keyed by a `player_id` extracted from the validated request
 * body (`req.body.playerId`).
 */
export function playerRateLimit(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs ?? config.milestonePlayerRateLimit.windowMs;
  const max = options.max ?? config.milestonePlayerRateLimit.max;
  const store = options.store ?? defaultStore;
  const namespace = options.name ?? 'milestone-submit:player';
  const errorPolicy: 'open' | 'closed' | 'local' =
    options.errorPolicy ?? (config.rateLimitErrorPolicy || 'open');

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!config.rateLimit.enabled) {
      next();
      return;
    }

    const body = req.body as Record<string, unknown>;
    const playerId = body?.playerId as string | undefined;
    if (!playerId || typeof playerId !== 'string') {
      next();
      return;
    }

    try {
      const { count, resetAt } = await store.increment(`${namespace}:${playerId}`, windowMs);

      if (count > max) {
        const now = Date.now();
        const retryAfterSec = Math.ceil(Math.max(0, resetAt - now) / 1000);
        res.set('Retry-After', String(retryAfterSec || 1));
        res.status(429).json({
          success: false,
          error: 'Too many milestone submissions for this player, please try again later',
          code: ErrorCode.RATE_LIMITED,
        });
        return;
      }
      next();
    } catch (err) {
      await handleStoreError({
        err,
        identifier: playerId,
        identifierType: 'playerId',
        errorPolicy,
        namespace,
        key: playerId,
        windowMs,
        max,
        res,
        next,
      });
    }
  };
}

/**
 * Simple in-process or Redis-backed wallet-based rate limiter.
 */
export function walletRateLimit(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs ?? config.rateLimit.windowMs;
  const max = options.max ?? config.rateLimit.max;
  const store = options.store ?? defaultStore;
  const namespace = options.name ?? 'default';
  const errorPolicy: 'open' | 'closed' | 'local' =
    options.errorPolicy ?? (config.rateLimitErrorPolicy || 'open');

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!config.rateLimit.enabled) {
      next();
      return;
    }
    const wallet = req.account;
    if (!wallet) {
      next();
      return;
    }

    try {
      const { count, resetAt } = await store.increment(`${namespace}:wallet:${wallet}`, windowMs);

      if (count > max) {
        const now = Date.now();
        const retryAfterSec = Math.ceil(Math.max(0, resetAt - now) / 1000);
        res.set('Retry-After', String(retryAfterSec || 1));
        res.status(429).json({
          success: false,
          error: 'Too many requests, please try again later',
          code: ErrorCode.RATE_LIMITED,
        });
        return;
      }
      next();
    } catch (err) {
      await handleStoreError({
        err,
        identifier: wallet,
        identifierType: 'wallet',
        errorPolicy,
        namespace,
        key: `wallet:${wallet}`,
        windowMs,
        max,
        res,
        next,
      });
    }
  };
}

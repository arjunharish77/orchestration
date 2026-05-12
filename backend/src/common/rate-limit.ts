import IORedis from 'ioredis';

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitRequest = {
  ip?: string;
  path: string;
};

type RateLimitResponse = {
  status: (code: number) => { json: (body: unknown) => void };
};

type NextFunction = () => void;

const buckets = new Map<string, Bucket>();
let redisClient: IORedis | null | undefined;

export function simpleRateLimit(options: { windowMs: number; max: number; pathPrefixes: string[] }) {
  return async (request: RateLimitRequest, response: RateLimitResponse, next: NextFunction) => {
    if (!options.pathPrefixes.some((prefix) => request.path.startsWith(prefix))) return next();

    const key = `${request.ip}:${request.path}`;
    const redis = getRedisClient();
    if (redis) {
      try {
        const redisKey = `rate-limit:${key}`;
        const count = await redis.incr(redisKey);
        if (count === 1) await redis.pexpire(redisKey, options.windowMs);
        if (count > options.max) {
          response.status(429).json({ message: 'Too many requests' });
          return;
        }
        return next();
      } catch {
        // Fall back to local limiting if Redis is temporarily unavailable.
      }
    }

    const now = Date.now();
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > options.max) {
      response.status(429).json({ message: 'Too many requests' });
      return;
    }

    next();
  };
}

function getRedisClient() {
  if (!process.env.REDIS_URL) return null;
  if (redisClient !== undefined) return redisClient;
  redisClient = new IORedis(process.env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false
  });
  redisClient.on('error', () => undefined);
  return redisClient;
}

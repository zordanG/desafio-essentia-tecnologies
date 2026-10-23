import { RedisInstance } from './redis.js';
import { randomUUID } from 'crypto';
import { logger } from './logger.js';

type RateLimiterType = 'perRoute' | 'perUser' | 'perIp';

const defaultTimespan = 1000 * 60; // 1 minute

const luaScript = `
    local key = KEYS[1]
    local now = tonumber(ARGV[1])
    local windowStart = tonumber(ARGV[2])
    local limit = tonumber(ARGV[3])
    local ttl = tonumber(ARGV[4])
    local member = ARGV[5]

    redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)
    
    local count = redis.call('ZCARD', key)
    
    if count < limit then
        redis.call('ZADD', key, now, member)
        redis.call('PEXPIRE', key, ttl)
        return 1
    end
    
    return 0
`;

class RateLimiter {
  private path: string;
  private type: RateLimiterType;
  private limit: number;
  private timespan: number;

  constructor(
    path: string,
    type: RateLimiterType,
    limit: number = 10,
    timespanInMilis: number = defaultTimespan,
  ) {
    this.path = path;
    this.type = type;
    this.limit = limit;
    this.timespan = timespanInMilis;
  }

  async check(): Promise<boolean> {
    try {
      const redis = await RedisInstance.getInstance();
      const now = Date.now();
      const windowStart = now - this.timespan;

      const result = await redis.eval(luaScript, {
        keys: [this.path],
        arguments: [
          now.toString(),
          windowStart.toString(),
          this.limit.toString(),
          this.timespan.toString(),
          `${now}-${randomUUID()}`,
        ],
      });

      return result === 1;
    } catch (error) {
      logger.error('Rate limiter error', { error });
      return true; // Fail open
    }
  }

  static perRoute(service: string, route: string): RateLimiter {
    const path = `rl:${service}:${route}:route`;
    return new RateLimiter(path, 'perRoute', 200);
  }

  static perUser(service: string, route: string, userId: string): RateLimiter {
    const path = `rl:${service}:${route}:user:${userId}`;
    return new RateLimiter(path, 'perUser');
  }

  static perIp(service: string, route: string, ip: string): RateLimiter {
    const path = `rl:${service}:${route}:ip:${ip}`;
    return new RateLimiter(path, 'perIp');
  }
}

export { RateLimiter };

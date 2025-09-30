import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis;

  constructor(private configService: ConfigService) {
    this.redis = new Redis(this.configService.get('REDIS_URL') || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.redis.on('connect', () => {
      this.logger.log('Connected to Redis');
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error:', error);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.error(`Error getting cache key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.redis.setex(key, ttlSeconds, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
    } catch (error) {
      this.logger.error(`Error setting cache key ${key}:`, error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.error(`Error deleting cache key ${key}:`, error);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      this.logger.error(`Error deleting cache pattern ${pattern}:`, error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Error checking cache key ${key}:`, error);
      return false;
    }
  }

  getUserCacheKey(userId: string): string {
    return `user:${userId}`;
  }

  getUserByUsernameCacheKey(username: string): string {
    return `user:username:${username}`;
  }

  getUserByEmailCacheKey(email: string): string {
    return `user:email:${email}`;
  }

  getUserRolesCacheKey(userId: string): string {
    return `user:${userId}:roles`;
  }

  getUserPermissionsCacheKey(userId: string): string {
    return `user:${userId}:permissions`;
  }

  getUserSearchCacheKey(searchParams: string): string {
    return `user:search:${Buffer.from(searchParams).toString('base64')}`;
  }

  readonly TTL = {
    USER_DATA: 15 * 60, 
    USER_ROLES: 30 * 60,
    USER_PERMISSIONS: 30 * 60,
    USER_SEARCH: 5 * 60,
    JWT_VALIDATION: 10 * 60,
  };

  async onModuleDestroy() {
    await this.redis.quit();
  }

  get redisClient() {
    return this.redis;
  }
}


import { Controller, Get, UseGuards } from '@nestjs/common';
import { CacheService } from './cache.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('redis-keys')
@UseGuards(JwtAuthGuard)
export class RedisKeysController {
  constructor(private readonly cacheService: CacheService) {}

  @Get()
  async getRedisKeys() {
    try {
      const keys = await this.cacheService.redisClient.keys('*');
      return {
        success: true,
        keys: keys,
        count: keys.length
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  @Get('user-keys')
  async getUserKeys() {
    try {
      const keys = await this.cacheService.redisClient.keys('user:*');
      return {
        success: true,
        keys: keys,
        count: keys.length
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

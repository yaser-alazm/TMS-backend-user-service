import { Controller, Get } from '@nestjs/common';
import { CacheTestService } from './cache-test.service';

@Controller('cache-test')
export class CacheTestController {
  constructor(private readonly cacheTestService: CacheTestService) {}

  @Get('basic')
  async testBasicCache() {
    return await this.cacheTestService.testCache();
  }

  @Get('user')
  async testUserCache() {
    return await this.cacheTestService.testUserCache();
  }

  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'cache-test',
      timestamp: new Date().toISOString(),
    };
  }
}

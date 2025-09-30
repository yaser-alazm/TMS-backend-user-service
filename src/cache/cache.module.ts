import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheService } from './cache.service';
import { CacheTestService } from './cache-test.service';
import { CacheTestController } from './cache-test.controller';
import { RedisKeysController } from './redis-keys.controller';

@Module({
  imports: [ConfigModule],
  providers: [CacheService, CacheTestService],
  controllers: [CacheTestController, RedisKeysController],
  exports: [CacheService],
})
export class CacheModule {}


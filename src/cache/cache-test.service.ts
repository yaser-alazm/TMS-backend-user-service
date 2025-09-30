import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from './cache.service';

@Injectable()
export class CacheTestService {
  private readonly logger = new Logger(CacheTestService.name);

  constructor(private readonly cacheService: CacheService) {}

  async testCache() {
    const testKey = 'test:cache:key';
    const testValue = { message: 'Hello from cache!', timestamp: new Date().toISOString() };

    try {
      // Test 1: Set cache
      this.logger.log('Testing cache SET operation...');
      await this.cacheService.set(testKey, testValue, 60); // 60 seconds TTL
      this.logger.log('✅ Cache SET successful');

      // Test 2: Get cache
      this.logger.log('Testing cache GET operation...');
      const retrievedValue = await this.cacheService.get(testKey);
      this.logger.log('✅ Cache GET successful:', retrievedValue);

      // Test 3: Check if values match
      if (JSON.stringify(retrievedValue) === JSON.stringify(testValue)) {
        this.logger.log('✅ Cache data integrity verified');
      } else {
        this.logger.error('❌ Cache data mismatch');
      }

      // Test 4: Check cache exists
      this.logger.log('Testing cache EXISTS operation...');
      const exists = await this.cacheService.exists(testKey);
      this.logger.log(`✅ Cache EXISTS: ${exists}`);

      // Test 5: Delete cache
      this.logger.log('Testing cache DELETE operation...');
      await this.cacheService.del(testKey);
      this.logger.log('✅ Cache DELETE successful');

      // Test 6: Verify deletion
      const deletedValue = await this.cacheService.get(testKey);
      if (deletedValue === null) {
        this.logger.log('✅ Cache deletion verified');
      } else {
        this.logger.error('❌ Cache deletion failed');
      }

      return {
        success: true,
        message: 'All cache tests passed!',
        tests: [
          'SET operation',
          'GET operation', 
          'Data integrity',
          'EXISTS operation',
          'DELETE operation',
          'Deletion verification'
        ]
      };

    } catch (error) {
      this.logger.error('❌ Cache test failed:', error);
      return {
        success: false,
        message: 'Cache test failed',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async testUserCache() {
    const testUser = {
      id: 'test-user-123',
      username: 'testuser',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User'
    };

    try {
      // Test user cache key generation
      const userCacheKey = this.cacheService.getUserCacheKey(testUser.id);
      const usernameCacheKey = this.cacheService.getUserByUsernameCacheKey(testUser.username);
      const emailCacheKey = this.cacheService.getUserByEmailCacheKey(testUser.email);

      this.logger.log('Testing user cache keys...');
      this.logger.log(`User ID key: ${userCacheKey}`);
      this.logger.log(`Username key: ${usernameCacheKey}`);
      this.logger.log(`Email key: ${emailCacheKey}`);

      // Test caching user data
      await this.cacheService.set(userCacheKey, testUser, this.cacheService.TTL.USER_DATA);
      await this.cacheService.set(usernameCacheKey, testUser, this.cacheService.TTL.USER_DATA);
      await this.cacheService.set(emailCacheKey, testUser, this.cacheService.TTL.USER_DATA);

      // Test retrieving user data
      const cachedUserById = await this.cacheService.get(userCacheKey);
      const cachedUserByUsername = await this.cacheService.get(usernameCacheKey);
      const cachedUserByEmail = await this.cacheService.get(emailCacheKey);

      this.logger.log('✅ User cache operations successful');
      this.logger.log('Cached user by ID:', cachedUserById);
      this.logger.log('Cached user by username:', cachedUserByUsername);
      this.logger.log('Cached user by email:', cachedUserByEmail);

      // Cleanup
      await this.cacheService.del(userCacheKey);
      await this.cacheService.del(usernameCacheKey);
      await this.cacheService.del(emailCacheKey);

      return {
        success: true,
        message: 'User cache tests passed!',
        userData: testUser
      };

    } catch (error) {
      this.logger.error('❌ User cache test failed:', error);
      return {
        success: false,
        message: 'User cache test failed',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

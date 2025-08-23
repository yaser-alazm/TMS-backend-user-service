import { Injectable, Logger } from '@nestjs/common';
import {
  KafkaService,
  UpdateUserDto,
  UserCreatedDto,
  UserCreatedEvent,
  UserUpdatedEvent,
  UserDeletedEvent,
} from '@yatms/common';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UserEventService {
  private readonly logger = new Logger(UserEventService.name);

  constructor(private readonly kafkaService: KafkaService) {}

  async publishUserCreated(userData: UserCreatedDto): Promise<void> {
    if (!userData) {
      this.logger.error('Invalid user data for publishing user created event');
      return;
    }
    const event: UserCreatedEvent = {
      eventId: uuidv4(),
      eventType: 'USER_CREATED',
      timestamp: new Date(),
      source: 'user-service',
      version: '1.0',
      data: {
        userId: userData.id,
        username: userData.username,
        email: userData.email,
        roles: userData.roles,
      },
    };

    await this.kafkaService.publishEvent('user-events', event);
    this.logger.log(`User created event published: ${event.eventId}`);
  }

  async publishUserUpdated(
    userId: string,
    changes: UpdateUserDto,
  ): Promise<void> {
    const event: UserUpdatedEvent = {
      eventId: uuidv4(),
      eventType: 'USER_UPDATED',
      timestamp: new Date(),
      source: 'user-service',
      version: '1.0',
      data: { userId, changes },
    };

    await this.kafkaService.publishEvent('user-events', event);
    this.logger.log(`User updated event published: ${event.eventId}`);
  }

  async publishUserDeleted(userId: string): Promise<void> {
    const event: UserDeletedEvent = {
      eventId: uuidv4(),
      eventType: 'USER_DELETED',
      timestamp: new Date(),
      source: 'user-service',
      version: '1.0',
      data: { userId },
    };

    await this.kafkaService.publishEvent('user-events', event);
    this.logger.log(`User deleted event published: ${event.eventId}`);
  }
}

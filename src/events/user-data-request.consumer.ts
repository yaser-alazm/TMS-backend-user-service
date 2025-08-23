import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaService, UserDataRequestEvent } from '@yatms/common';
import { UsersService } from '../users/users.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UserDataRequestConsumer implements OnModuleInit {
  private readonly logger = new Logger(UserDataRequestConsumer.name);

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly usersService: UsersService,
  ) {}

  async onModuleInit() {
    try {
      const consumer = await this.kafkaService.createConsumer(
        'user-service-data-requests',
        ['user-requests'],
      );

      await consumer.run({
        eachMessage: async ({ message }) => {
          try {
            if (!message.value) return;

            const parsedEvent = JSON.parse(
              message.value.toString(),
            ) as UserDataRequestEvent;

            if (parsedEvent.eventType !== 'USER_DATA_REQUEST') {
              return;
            }

            this.logger.log(
              `Received user data request: ${parsedEvent.data.requestId}`,
            );

            try {
              // Get filters from the request
              const filters = parsedEvent.data.filters || {};

              // Get users from the database
              const usersResult = await this.usersService.findAll({
                page: 1,
                limit: 100,
                roles: filters.roles,
                isActive: filters.isActive,
                sortBy: 'createdAt',
                sortOrder: 'desc',
              });

              // Send success response
              await this.kafkaService.publishEvent('user-responses', {
                eventId: uuidv4(),
                eventType: 'USER_DATA_RESPONSE',
                timestamp: new Date(),
                source: 'user-service',
                version: '1.0',
                data: {
                  requestId: parsedEvent.data.requestId,
                  success: true,
                  users: usersResult.users,
                },
              });

              this.logger.log(
                `Sent user data response for request: ${parsedEvent.data.requestId}`,
              );
            } catch (error) {
              // Send error response
              await this.kafkaService.publishEvent('user-responses', {
                eventId: uuidv4(),
                eventType: 'USER_DATA_RESPONSE',
                timestamp: new Date(),
                source: 'user-service',
                version: '1.0',
                data: {
                  requestId: parsedEvent.data.requestId,
                  success: false,
                  error:
                    error instanceof Error
                      ? error.message
                      : 'Error fetching users',
                },
              });

              this.logger.error(
                `Error processing user data request: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              );
            }
          } catch (error) {
            this.logger.error(
              `Failed to process message: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        },
      });

      this.logger.log('User data request consumer initialized');
    } catch (error) {
      this.logger.error(
        `Failed to initialize consumer: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

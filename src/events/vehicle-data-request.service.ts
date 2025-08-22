import { Injectable, Logger } from '@nestjs/common';
import { isVehicleDataResponseEvent, KafkaService } from '@yatms/common';
import { v4 as uuidv4 } from 'uuid';
import { VehicleFilterDto } from '@yatms/common';

@Injectable()
export class VehicleDataRequestService {
  private readonly logger = new Logger(VehicleDataRequestService.name);
  private responseCallbacks = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (reason?: any) => void;
      timer: NodeJS.Timeout;
    }
  >();

  constructor(private readonly kafkaService: KafkaService) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.setupResponseConsumer();
  }

  async fetchAllVehicles(filterDto: VehicleFilterDto) {
    return this.requestVehicleData('ALL', undefined, filterDto);
  }

  async fetchVehiclesByOwner(ownerId: string) {
    return this.requestVehicleData('BY_OWNER', ownerId);
  }

  private async requestVehicleData(
    requestType: 'ALL' | 'BY_OWNER' | 'BY_ID',
    vehicleId?: string,
    filterDto?: VehicleFilterDto,
  ) {
    const requestId = uuidv4();

    try {
      const responsePromise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.responseCallbacks.delete(requestId);
          reject(new Error('Vehicle data request timed out'));
        }, 10000);

        this.responseCallbacks.set(requestId, { resolve, reject, timer });
      });

      await this.kafkaService.publishEvent('vehicle-requests', {
        eventId: uuidv4(),
        eventType: 'VEHICLE_DATA_REQUEST',
        timestamp: new Date(),
        source: 'user-service',
        version: '1.0',
        data: {
          requestId,
          requestType,
          requestedBy: 'user-service',
          filters: {
            ...(filterDto || {}),
            ...(vehicleId ? { vehicleId } : {}),
            ...(requestType === 'BY_OWNER' ? { ownerId: vehicleId } : {}),
          },
        },
      });

      return responsePromise;
    } catch (error) {
      this.logger.error(
        `Error requesting vehicle data: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  private async setupResponseConsumer() {
    try {
      const consumer = await this.kafkaService.createConsumer(
        'user-service-vehicle-responses',
        ['vehicle-responses'],
      );

      await consumer.run({
        // eslint-disable-next-line @typescript-eslint/require-await
        eachMessage: async ({ message }) => {
          try {
            if (!message.value) {
              this.logger.warn('Received empty message');
              return;
            }

            const parsedEvent: unknown = JSON.parse(message.value.toString());

            if (!isVehicleDataResponseEvent(parsedEvent)) {
              return;
            }

            const requestId = parsedEvent.data.requestId;
            const callback = this.responseCallbacks.get(requestId);

            if (callback) {
              clearTimeout(callback.timer);
              this.responseCallbacks.delete(requestId);

              if (parsedEvent.data.success) {
                callback.resolve(parsedEvent.data.vehicles);
              } else {
                callback.reject(
                  new Error(
                    parsedEvent.data.error || 'Failed to fetch vehicle data',
                  ),
                );
              }
            }
          } catch (error) {
            this.logger.error(
              `Error processing vehicle response: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        },
      });

      this.logger.log('Vehicle data response consumer started');
    } catch (error) {
      this.logger.error(
        `Failed to setup vehicle response consumer: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

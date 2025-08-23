import { Module, forwardRef } from '@nestjs/common';
import { UserEventService } from './user-event.service';
import { VehicleDataRequestService } from './vehicle-data-request.service';
import { KafkaService } from '@yatms/common';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [forwardRef(() => UsersModule)],
  providers: [UserEventService, VehicleDataRequestService, KafkaService],
  exports: [UserEventService, VehicleDataRequestService],
})
export class EventsModule {}

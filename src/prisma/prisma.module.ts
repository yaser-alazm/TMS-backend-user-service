import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Makes the service available throughout the application
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // Export so other modules can use it
})
export class PrismaModule {}

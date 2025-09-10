import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Query,
  UsePipes,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import {
  CreateUserDto,
  UpdateUserDto,
  UserFilterDto,
  createUserSchema,
  updateUserSchema,
  userFilterSchema,
  createZodValidationPipe,
  VehicleFilterDto,
  AuthGuard,
} from '@yatms/common';
import { VehicleDataRequestService } from '../events/vehicle-data-request.service';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly vehicleDataRequestService: VehicleDataRequestService,
  ) {}

  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'user-service',
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  @UsePipes(createZodValidationPipe(createUserSchema))
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @UsePipes(createZodValidationPipe(userFilterSchema))
  findAll(@Query() filterDto: UserFilterDto) {
    return this.usersService.findAll(filterDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Put(':id')
  @UsePipes(createZodValidationPipe(updateUserSchema))
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Get(':id/vehicles')
  async getUserVehicles(@Param('id') userId: string) {
    // Verify user exists first
    await this.usersService.findOne(userId);
    return this.vehicleDataRequestService.fetchVehiclesByOwner(userId);
  }

  @Get('vehicles/all')
  async getAllVehicles(@Query() filterDto: VehicleFilterDto) {
    return this.vehicleDataRequestService.fetchAllVehicles(filterDto);
  }
}

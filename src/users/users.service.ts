import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserEventService } from '../events/user-event.service';
import * as bcrypt from 'bcrypt';
import {
  CreateUserDto,
  UpdateUserDto,
  UserCreatedDto,
  UserFilterDto,
} from '@yatms/common';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userEventService: UserEventService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const { password, roles = [], ...userData } = createUserDto;

    // Check if user exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: userData.email }, { username: userData.username }],
      },
    });

    if (existingUser) {
      throw new BadRequestException(
        'User with this email or username already exists',
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create roles if they don't exist
    const roleObjects = await Promise.all(
      roles.map(async (roleName) => {
        const role = await this.prisma.role.findUnique({
          where: { name: roleName },
        });

        if (!role) {
          return this.prisma.role.create({
            data: { name: roleName },
          });
        }
        return role;
      }),
    );

    // Create user with roles
    const user = await this.prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,
        roles: {
          connect: roleObjects.map((role) => ({ id: role.id })),
        },
      },
      include: {
        roles: true,
        permissions: true,
      },
    });
    console.log('User created:', user);

    // Publish event
    const eventUser: UserCreatedDto = {
      ...user,
      roles: user.roles.map((role) => role.name),
    };
    await this.userEventService.publishUserCreated(eventUser);

    return user;
  }

  async findAll(filterDto: UserFilterDto) {
    const { page, limit, search, roles, isActive, sortBy, sortOrder } =
      filterDto;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = {};

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (roles?.length) {
      where.roles = {
        some: { name: { in: roles } },
      };
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        include: { roles: true, permissions: true },
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.user.count({ where }),
    ]);

    // Remove passwords from response
    const usersWithoutPasswords = users.map(({ password: _, ...user }) => user);

    return {
      users: usersWithoutPasswords,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: true,
        permissions: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async findByUsername(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: {
        roles: true,
        permissions: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with username ${username} not found`);
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const { password, roles, ...userData } = updateUserDto;

    // Check if user exists
    await this.findOne(id);

    const updateData: Record<string, any> = { ...userData };

    // Hash password if provided
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Update roles if provided
    let roleConnections: Record<string, any> | undefined;
    if (roles && roles.length > 0) {
      const roleObjects = await Promise.all(
        roles.map(async (roleName) => {
          const role = await this.prisma.role.findUnique({
            where: { name: roleName },
          });

          if (!role) {
            return this.prisma.role.create({
              data: { name: roleName },
            });
          }
          return role;
        }),
      );

      roleConnections = {
        set: roleObjects.map((role) => ({ id: role.id })),
      };
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        ...updateData,
        ...(roleConnections ? { roles: roleConnections } : {}),
      },
      include: {
        roles: true,
        permissions: true,
      },
    });

    // Publish event
    await this.userEventService.publishUserUpdated(id, updateUserDto);

    return updatedUser;
  }

  async remove(id: string) {
    // Check if user exists
    await this.findOne(id);

    const user = await this.prisma.user.delete({
      where: { id },
    });

    // Publish event
    await this.userEventService.publishUserDeleted(id);

    return user;
  }
}

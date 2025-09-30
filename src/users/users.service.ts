import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserEventService } from '../events/user-event.service';
import { CacheService } from '../cache/cache.service';
import * as bcrypt from 'bcrypt';
import {
  CreateUserDto,
  UpdateUserDto,
  UserCreatedDto,
  UserFilterDto,
} from '@yatms/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userEventService: UserEventService,
    private readonly cacheService: CacheService,
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

    // Cache the new user
    const { password: _, ...userWithoutPassword } = user;
    await this.cacheService.set(
      this.cacheService.getUserCacheKey(user.id), 
      userWithoutPassword, 
      this.cacheService.TTL.USER_DATA
    );

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

    const where: Prisma.UserWhereInput = {};

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
    // Try cache first
    const cacheKey = this.cacheService.getUserCacheKey(id);
    const cachedUser = await this.cacheService.get(cacheKey);
    
    if (cachedUser) {
      return cachedUser;
    }

    // Fetch from database
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

    // Cache the result (without password)
    const { password: _, ...userWithoutPassword } = user;
    await this.cacheService.set(cacheKey, userWithoutPassword, this.cacheService.TTL.USER_DATA);

    return user;
  }

  async findByUsername(username: string) {
    // Try cache first
    const cacheKey = this.cacheService.getUserByUsernameCacheKey(username);
    const cachedUser = await this.cacheService.get(cacheKey);
    
    if (cachedUser) {
      return cachedUser;
    }

    // Fetch from database
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

    // Cache the result (without password)
    const { password: _, ...userWithoutPassword } = user;
    await this.cacheService.set(cacheKey, userWithoutPassword, this.cacheService.TTL.USER_DATA);

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

    // Invalidate cache
    await this.invalidateUserCache(id, updatedUser);

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

    // Invalidate cache
    await this.invalidateUserCache(id, user);

    // Publish event
    await this.userEventService.publishUserDeleted(id);

    return user;
  }

  private async invalidateUserCache(userId: string, user?: any) {
    try {
      // Invalidate user cache keys
      await this.cacheService.del(this.cacheService.getUserCacheKey(userId));
      
      if (user) {
        // Invalidate username and email cache keys
        if (user.username) {
          await this.cacheService.del(this.cacheService.getUserByUsernameCacheKey(user.username));
        }
        if (user.email) {
          await this.cacheService.del(this.cacheService.getUserByEmailCacheKey(user.email));
        }
      }

      // Invalidate role and permission caches
      await this.cacheService.del(this.cacheService.getUserRolesCacheKey(userId));
      await this.cacheService.del(this.cacheService.getUserPermissionsCacheKey(userId));

      // Invalidate search caches (pattern-based)
      await this.cacheService.delPattern('user:search:*');
    } catch (error) {
      // Log error but don't fail the operation
      console.error('Error invalidating user cache:', error);
    }
  }
}

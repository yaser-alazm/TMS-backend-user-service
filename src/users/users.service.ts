import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

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
    return this.prisma.user.create({
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
  }

  async findAll(skip = 0, take = 10) {
    return this.prisma.user.findMany({
      skip,
      take,
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
        roles: true,
        permissions: true,
      },
    });
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

    return this.prisma.user.update({
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
  }

  async remove(id: string) {
    // Check if user exists
    await this.findOne(id);

    return this.prisma.user.delete({
      where: { id },
    });
  }
}

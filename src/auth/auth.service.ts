import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import {
  CreateUserDto,
  LoginDto,
  SafeUserWithRelations,
  AuthResponse,
  UserContext,
} from '@yatms/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async login(
    credentials: LoginDto,
  ): Promise<AuthResponse & { accessToken: string; refreshToken: string }> {
    const user = await this.validateUser(credentials);
    const { password: _, ...safeUser } = user;
    const payload = this.createJwtPayload(safeUser);
    const token = this.jwtService.sign(payload);

    // Generate refresh token
    const refreshToken = await this.generateRefreshToken(user.id);

    return {
      user: {
        userId: user.id,
        email: user.email,
        roles: user.roles.map((role) => role.name),
      },
      refreshToken: refreshToken.token,
      accessToken: token,
    };
  }

  async register(
    credentials: CreateUserDto,
  ): Promise<AuthResponse & { accessToken: string; refreshToken: string }> {
    const user = await this.usersService.create(credentials);

    const payload = this.createJwtPayload(user);
    const token = this.jwtService.sign(payload);

    const refreshToken = await this.generateRefreshToken(user.id);

    return {
      user: {
        userId: user.id,
        email: user.email,
        roles: user.roles.map((role) => role.name),
      },
      refreshToken: refreshToken.token,
      accessToken: token,
    };
  }

  async refreshToken(
    refreshTokenStr: string | undefined,
  ): Promise<AuthResponse & { accessToken: string; refreshToken: string }> {
    if (!refreshTokenStr) {
      throw new UnauthorizedException('Refresh token is required');
    }

    try {
      const refreshTokenRecord = await this.prisma.refreshToken.findUnique({
        where: { token: refreshTokenStr },
        include: { user: { include: { roles: true, permissions: true } } },
      });

      if (!refreshTokenRecord || refreshTokenRecord.expiresAt < new Date()) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      const { password: _, ...safeUser } = refreshTokenRecord.user;
      const payload = this.createJwtPayload(safeUser);
      const newAccessToken = this.jwtService.sign(payload);
      const newRefreshToken = await this.rotateRefreshToken(
        refreshTokenRecord.id,
      );

      return {
        user: {
          userId: refreshTokenRecord.user.id,
          email: refreshTokenRecord.user.email,
          roles: refreshTokenRecord.user.roles.map((role) => role.name),
        },
        refreshToken: newRefreshToken.token,
        accessToken: newAccessToken,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Failed to refresh token');
    }
  }

  // Helper method to generate a refresh token
  private async generateRefreshToken(userId: string) {
    // Delete any existing refresh tokens for this user
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    // Create a new refresh token
    return this.prisma.refreshToken.create({
      data: {
        token: uuidv4(),
        userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });
  }

  // Helper method to rotate refresh token
  private async rotateRefreshToken(oldTokenId: string) {
    // Get the old token to preserve the userId
    const oldToken = await this.prisma.refreshToken.findUnique({
      where: { id: oldTokenId },
    });

    if (!oldToken) {
      throw new NotFoundException('Refresh token not found');
    }

    // Create a new refresh token first
    const newToken = await this.prisma.refreshToken.create({
      data: {
        token: uuidv4(),
        userId: oldToken.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Delete the old token after creating the new one to avoid race conditions
    await this.prisma.refreshToken.delete({
      where: { id: oldTokenId },
    });

    return newToken;
  }

  private async validateUser(credentials: LoginDto): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { username: credentials.username },
      include: { roles: true, permissions: true },
    });
    
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    
    const isPasswordValid = await bcrypt.compare(
      credentials.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  createJwtPayload(user: SafeUserWithRelations): UserContext {
    return {
      userId: user.id,
      email: user.email,
      roles: user.roles.map((role) => role.name),
    };
  }
}

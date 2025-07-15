import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import { JwtPayload, UserWithRelations, TokenResponse } from './types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async register(registerDto: RegisterDto) {
    try {
      // Check if user exists
      const existingUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            { email: registerDto.email },
            { username: registerDto.username },
          ],
        },
      });

      if (existingUser) {
        throw new BadRequestException(
          'User with this email or username already exists',
        );
      }

      // Create user with default role
      const user = await this.usersService.create({
        ...registerDto,
        roles: ['user'], // Default role
      });

      // Generate tokens
      const tokens = await this.generateTokens(user);

      this.logger.log(`User registered successfully: ${user.username}`);

      return {
        message: 'User registered successfully',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          roles: user.roles?.map((role) => role.name) || [],
        },
        ...tokens,
      };
    } catch (error) {
      this.logger.error('Registration failed:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Registration failed');
    }
  }

  async login(loginDto: LoginDto) {
    const { username, password } = loginDto;

    try {
      // Find user by username or email
      const user = await this.prisma.user.findFirst({
        where: {
          OR: [{ username: username }, { email: username }],
        },
        include: {
          roles: true,
          permissions: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Check if user is active
      if (!user.isActive) {
        throw new UnauthorizedException('Account is deactivated');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Update last login
      await this.usersService.update(user.id, {
        lastLogin: new Date(),
      });

      // Generate tokens
      const tokens = await this.generateTokens(user);

      this.logger.log(`User logged in successfully: ${user.username}`);

      return {
        message: 'Login successful',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          roles: user.roles.map((role) => role.name),
          permissions:
            user.permissions?.map((permission) => permission.name) || [],
        },
        ...tokens,
      };
    } catch (error) {
      this.logger.error(`Login failed for user: ${username}`, error);

      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  async logout(userId: string): Promise<{ message: string }> {
    try {
      // Invalidate all refresh tokens for this user
      await this.prisma.refreshToken.deleteMany({
        where: { userId },
      });

      this.logger.log(`User logged out successfully: ${userId}`);
      return { message: 'Logged out successfully' };
    } catch (error) {
      this.logger.error(`Logout failed for user: ${userId}`, error);
      throw new BadRequestException('Logout failed');
    }
  }

  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    try {
      const storedToken = await this.prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: {
          user: {
            include: {
              roles: true,
              permissions: true,
            },
          },
        },
      });

      if (!storedToken || storedToken.expiresAt < new Date()) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(storedToken.user);

      // Delete old refresh token
      await this.prisma.refreshToken.delete({
        where: { token: refreshToken },
      });

      this.logger.log(
        `Token refreshed successfully for user: ${storedToken.user.username}`,
      );
      return tokens;
    } catch (error) {
      this.logger.error('Token refresh failed:', error);

      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        // Don't reveal if email exists
        return {
          message: 'If email exists, reset instructions have been sent',
        };
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour

      // Store reset token
      await this.prisma.passwordResetToken.create({
        data: {
          token: resetToken,
          userId: user.id,
          expiresAt,
        },
      });

      // TODO: Send email with reset link
      // await this.emailService.sendPasswordReset(user.email, resetToken);

      this.logger.log(`Password reset requested for email: ${email}`);
      return { message: 'If email exists, reset instructions have been sent' };
    } catch (error) {
      this.logger.error(`Password reset failed for email: ${email}`, error);
      return { message: 'If email exists, reset instructions have been sent' };
    }
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    try {
      const resetToken = await this.prisma.passwordResetToken.findUnique({
        where: { token },
        include: { user: true },
      });

      if (!resetToken || resetToken.expiresAt < new Date()) {
        throw new BadRequestException('Invalid or expired reset token');
      }

      // Update password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      });

      // Delete reset token
      await this.prisma.passwordResetToken.delete({
        where: { token },
      });

      this.logger.log(
        `Password reset successfully for user: ${resetToken.user.username}`,
      );
      return { message: 'Password reset successfully' };
    } catch (error) {
      this.logger.error('Password reset failed:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Password reset failed');
    }
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password,
      );
      if (!isCurrentPasswordValid) {
        throw new BadRequestException('Current password is incorrect');
      }

      // Update password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await this.prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      this.logger.log(
        `Password changed successfully for user: ${user.username}`,
      );
      return { message: 'Password changed successfully' };
    } catch (error) {
      this.logger.error(`Password change failed for user: ${userId}`, error);

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException('Password change failed');
    }
  }

  private async generateTokens(
    user: UserWithRelations,
  ): Promise<TokenResponse> {
    try {
      const payload: JwtPayload = {
        sub: user.id,
        username: user.username,
        roles: user.roles?.map((role) => role.name) || [],
      };

      const accessToken = this.jwtService.sign(payload);
      const refreshToken = crypto.randomBytes(64).toString('hex');

      // Store refresh token
      await this.prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      return {
        access_token: accessToken,
        refresh_token: refreshToken,
      };
    } catch (error) {
      this.logger.error('Token generation failed:', error);
      throw new BadRequestException('Token generation failed');
    }
  }
}

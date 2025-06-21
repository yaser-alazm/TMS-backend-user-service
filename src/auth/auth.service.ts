import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from './types';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService, // Properly inject JwtService
  ) {}

  async login(loginDto: LoginDto) {
    const { username, password } = loginDto;

    try {
      const user = await this.usersService.findByUsername(username);

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Update last login time
      await this.usersService.update(user.id, {
        lastLogin: new Date(),
      });

      // Generate JWT with properly typed payload
      const payload: JwtPayload = {
        sub: user.id,
        username: user.username,
        roles: user.roles.map((role) => role.name),
      };

      return {
        access_token: this.jwtService.sign(payload),
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          roles: user.roles,
        },
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid credentials');
    }
  }
}

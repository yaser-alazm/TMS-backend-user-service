import { Body, Controller, Post, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto, LoginDto } from '@yatms/common';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(
    @Body() credentials: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.login(credentials, response);
  }

  @Post('register')
  register(@Body() userData: CreateUserDto) {
    return this.authService.register(userData);
  }

  @Post('refresh')
  refreshToken(
    @Body() refreshData: { refreshToken?: string },
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.refreshToken(refreshData.refreshToken, response);
  }
}

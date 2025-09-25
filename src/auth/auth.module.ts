import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwksController, KeysHealthController } from './jwks.controller';
import { UsersModule } from 'src/users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        privateKey: configService.get<string>('JWT_PRIVATE_KEY_PEM'),
        publicKey: configService.get<string>('JWT_PUBLIC_KEY_PEM'),
        signOptions: { 
          expiresIn: '60m',
          algorithm: 'RS256',
          keyid: configService.get<string>('JWT_KID'),
          issuer: configService.get<string>('JWT_ISSUER'),
        },
        verifyOptions: {
          algorithms: ['RS256'],
          issuer: configService.get<string>('JWT_ISSUER'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, JwksController, KeysHealthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}

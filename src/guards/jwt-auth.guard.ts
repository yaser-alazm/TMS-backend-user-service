import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { CustomJWTPayload } from '@yatms/common';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private publicKey: string;
  private issuer: string;

  constructor(private configService: ConfigService) {
    this.issuer = this.configService.get<string>('JWT_ISSUER') || 'yatms-user-service-dev';
    this.publicKey = this.configService.get<string>('JWT_PUBLIC_KEY_PEM') || '';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Skip authentication for whitelisted paths
    if (this.isWhitelistedPath(request.url)) {
      return true;
    }

    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }


    try {
      if (!this.publicKey) {
        throw new Error('JWT public key not configured');
      }


      const payload = jwt.verify(token, this.publicKey, {
        algorithms: ['RS256'],
        issuer: this.issuer,
      }) as CustomJWTPayload;

      // Add user context to request
      request['user'] = {
        userId: payload.userId,
        email: payload.email,
        roles: payload.roles,
      };

      return true;
    } catch (error) {
      console.error('JWT validation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Invalid token';
      throw new UnauthorizedException(`Authentication failed: ${errorMessage}`);
    }
  }

        private extractToken(request: Request): string | undefined {
          
          // HTTP-only cookie
          const accessToken = request.cookies?.access_token;
          if (accessToken) return accessToken;
          
          return undefined;
        }

  private isWhitelistedPath(path: string): boolean {
    const whitelistedPaths = [
      '/auth/login',
      '/auth/register',
      '/auth/refresh',
      '/auth/logout',
      '/users/health',
      '/cache-test',
      '/redis-keys',
      '/.well-known/jwks.json',
    ];
    
    return whitelistedPaths.some(whitelistedPath => path.startsWith(whitelistedPath));
  }
}

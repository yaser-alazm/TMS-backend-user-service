import { Request } from 'express';
import { User, Role, Permission } from '../../generated/prisma';

export interface RequestWithJWTUser extends Request {
  user: {
    id: string;
    username: string;
    roles: string[];
  };
}

export interface JwtPayload {
  sub: string;
  username: string;
  roles: string[];
  iat?: number;
  exp?: number;
}

export type UserWithRoles = User & {
  roles: Role[];
  permissions?: Permission[];
};

export type UserWithRelations = User & {
  roles: Role[];
  permissions: Permission[];
};

export interface AuthResponse {
  message: string;
  user: {
    id: string;
    username: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    roles: string[];
    permissions?: string[];
  };
  access_token: string;
  refresh_token: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
}

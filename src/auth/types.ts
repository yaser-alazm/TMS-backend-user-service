import { Request } from 'express';

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
}

import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export type AuthRole = 'admin' | 'staff' | 'client';

export interface AuthTokenPayload {
  sub: string;
  role: AuthRole;
  name: string;
  email: string;
  deviceId?: string;
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
}

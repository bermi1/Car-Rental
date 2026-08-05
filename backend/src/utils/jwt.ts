import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export type AuthRole = 'super_admin' | 'admin' | 'staff' | 'client';

export interface AuthTokenPayload {
  sub: string;
  role: AuthRole;
  name: string;
  email: string;
  /** The company an internal user belongs to. Absent for super admins and clients. */
  companyId?: string | null;
  deviceId?: string;
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
}

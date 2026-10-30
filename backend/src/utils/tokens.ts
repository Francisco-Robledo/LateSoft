import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export interface TokenPayload {
  sub: number;
  role: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'BARISTA' | 'CUSTOMER';
  branchId: number | null;
  assignedRoles?: Array<'ADMIN' | 'MANAGER' | 'CASHIER' | 'BARISTA' | 'CUSTOMER'>;
}

export function generateAccessToken(payload: TokenPayload): string {
  const options: SignOptions = {
    expiresIn: (env.JWT_ACCESS_EXPIRES_IN || '15m') as any,
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

export function verifyAccessToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  return decoded as unknown as TokenPayload;
}

export function generateOpaqueToken(): string {
  return crypto.randomBytes(40).toString('hex');
}

export function hashOpaqueToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateFamilyId(): string {
  return crypto.randomUUID();
}

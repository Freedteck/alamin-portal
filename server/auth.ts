import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { backendStore } from './store.ts';

const JWT_SECRET = (process.env.JWT_SECRET || '').trim();
if (JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters.');
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'teacher' | 'student';
  studentId?: string;
  teacherId?: string;
  authVersion: number;
}

export interface AuthAccountState extends AuthUser {
  isActive: boolean;
}

type AuthAccountResolver = (userId: string) => Promise<AuthAccountState | null>;

let resolveAuthAccount: AuthAccountResolver = (userId) =>
  backendStore.getCurrentAuthAccountFromDatabase(userId);

export function setAuthAccountResolver(resolver: AuthAccountResolver) {
  resolveAuthAccount = resolver;
}

function accountMatchesToken(account: AuthAccountState | null, user: AuthUser) {
  return Boolean(
    account &&
    account.isActive &&
    account.role === user.role &&
    account.authVersion === user.authVersion &&
    account.studentId === user.studentId &&
    account.teacherId === user.teacherId
  );
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function signAuthToken(user: AuthUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      studentId: user.studentId,
      teacherId: user.teacherId,
      authVersion: user.authVersion ?? 1
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyAuthToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (
      !decoded?.sub ||
      !['admin', 'teacher', 'student'].includes(decoded.role) ||
      !Number.isSafeInteger(decoded.authVersion)
    ) return null;
    return {
      id: String(decoded.sub),
      email: String(decoded.email || ''),
      name: String(decoded.name || ''),
      role: decoded.role,
      studentId: decoded.studentId,
      teacherId: decoded.teacherId,
      authVersion: decoded.authVersion
    };
  } catch {
    return null;
  }
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const queryToken = req.query?.token;
  if (typeof queryToken === 'string' && queryToken.trim()) {
    return queryToken.trim();
  }
  return null;
}

export async function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (token) {
    const user = verifyAuthToken(token);
    if (user) {
      try {
        const account = await resolveAuthAccount(user.id);
        if (accountMatchesToken(account, user)) {
          req.user = user;
        }
      } catch (error) {
        console.error('[Al-Amin Auth] Failed to validate optional user account:', error);
        return next(error);
      }
    }
  }
  next();
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication token required.' });
  }
  const user = verifyAuthToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
  try {
    const account = await resolveAuthAccount(user.id);
    if (!accountMatchesToken(account, user)) {
      return res.status(401).json({ error: 'Your account or session is no longer active. Please sign in again.' });
    }
  } catch (error) {
    console.error('[Al-Amin Auth] Failed to validate authenticated user account:', error);
    return res.status(503).json({ error: 'Authentication could not be verified. Please try again.' });
  }
  req.user = user;
  next();
}

export function requireRole(...roles: Array<'admin' | 'teacher' | 'student'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Requires one of: ${roles.join(', ')}.`
      });
    }
    next();
  };
}

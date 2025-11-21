import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { Session } from '../../models/Session.js';
import { User } from '../../models/User.js';
import { AppError } from './errorHandler.js';
import type { IUserDocument } from '../../types/index.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: IUserDocument;
      sessionId?: string;
    }
  }
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    // Get token from cookie or Authorization header
    const token = req.cookies?.session || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
    }

    // Find session by hashed token
    const tokenHash = hashToken(token);
    const session = await Session.findOne({
      tokenHash,
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      throw new AppError(401, 'Invalid or expired session', 'SESSION_EXPIRED');
    }

    // Get user
    const user = await User.findById(session.userId);
    if (!user) {
      throw new AppError(401, 'User not found', 'USER_NOT_FOUND');
    }

    // Attach to request
    req.user = user;
    req.sessionId = session._id.toString();

    next();
  } catch (error) {
    next(error);
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.session || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return next();
  }

  // If token exists, try to authenticate
  authenticate(req, _res, next);
}

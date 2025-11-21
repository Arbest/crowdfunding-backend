import type { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';
import { UserRole } from '../../types/index.js';

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'Authentication required', 'UNAUTHORIZED'));
    }

    const hasRole = roles.some((role) => req.user!.roles.includes(role));

    if (!hasRole) {
      return next(new AppError(403, 'Insufficient permissions', 'FORBIDDEN'));
    }

    next();
  };
}

export function requireFounder(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new AppError(401, 'Authentication required', 'UNAUTHORIZED'));
  }

  if (!req.user.roles.includes(UserRole.FOUNDER) && !req.user.roles.includes(UserRole.ADMIN)) {
    return next(new AppError(403, 'Founder role required', 'FORBIDDEN'));
  }

  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new AppError(401, 'Authentication required', 'UNAUTHORIZED'));
  }

  if (!req.user.roles.includes(UserRole.ADMIN)) {
    return next(new AppError(403, 'Admin role required', 'FORBIDDEN'));
  }

  next();
}

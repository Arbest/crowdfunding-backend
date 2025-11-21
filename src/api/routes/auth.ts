import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, validate } from '../middlewares/index.js';
import { registerSchema, loginSchema } from '../../validators/schemas.js';
import * as authService from '../../services/authService.js';

const router = Router();

// POST /api/auth/register
router.post(
  '/register',
  validate({ body: registerSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user, token, expiresAt } = await authService.register(req.body);

      // Set session cookie
      res.cookie('session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: expiresAt,
      });

      res.status(201).json({
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          roles: user.roles,
        },
        token,
        expiresAt,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  validate({ body: loginSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = req.ip;
      const userAgent = req.get('User-Agent');

      const { user, token, expiresAt } = await authService.login(req.body, ip, userAgent);

      res.cookie('session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: expiresAt,
      });

      res.json({
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          roles: user.roles,
        },
        token,
        expiresAt,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/auth/logout
router.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.logout(req.sessionId!);

    res.clearCookie('session');
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/refresh
router.post('/refresh', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { expiresAt } = await authService.refreshSession(req.sessionId!);

    res.json({ expiresAt });
  } catch (error) {
    next(error);
  }
});

export default router;

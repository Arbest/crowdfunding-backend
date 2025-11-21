import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, validate } from '../middlewares/index.js';
import { updateUserSchema, paginationSchema, objectIdSchema } from '../../validators/schemas.js';
import * as userService from '../../services/userService.js';

const router = Router();

// GET /api/users/me
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({
      id: req.user!._id,
      email: req.user!.email,
      firstName: req.user!.firstName,
      lastName: req.user!.lastName,
      roles: req.user!.roles,
      stats: req.user!.stats,
      createdAt: req.user!.createdAt,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/users/me
router.patch(
  '/me',
  authenticate,
  validate({ body: updateUserSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await userService.updateUser(req.user!._id.toString(), req.body);

      res.json({
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/users/me/contributions
router.get(
  '/me/contributions',
  authenticate,
  validate({ query: paginationSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = req.query as unknown as { page: number; limit: number };
      const result = await userService.getUserContributions(req.user!._id.toString(), page, limit);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/users/me/projects
router.get(
  '/me/projects',
  authenticate,
  validate({ query: paginationSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = req.query as unknown as { page: number; limit: number };
      const result = await userService.getUserProjects(req.user!._id.toString(), page, limit);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/users/:id (public profile)
router.get(
  '/:id',
  validate({ params: objectIdSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await userService.getPublicProfile(req.params.id);

      res.json(user);
    } catch (error) {
      next(error);
    }
  }
);

export default router;

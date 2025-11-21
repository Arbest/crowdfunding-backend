import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, requireAdmin, validate } from '../middlewares/index.js';
import {
  adminProjectQuerySchema,
  rejectProjectSchema,
  paginationSchema,
  objectIdSchema,
  updateUserRolesSchema,
} from '../../validators/schemas.js';
import * as projectService from '../../services/projectService.js';
import * as userService from '../../services/userService.js';
import * as auditService from '../../services/auditService.js';
import { Project } from '../../models/Project.js';
import { User } from '../../models/User.js';
import { Contribution } from '../../models/Contribution.js';
import { ContributionStatus, ProjectStatus } from '../../types/index.js';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate, requireAdmin);

// GET /api/admin/projects/pending
router.get(
  '/projects/pending',
  validate({ query: paginationSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = req.query as unknown as { page: number; limit: number };
      const result = await projectService.getPendingProjects(page, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/admin/projects/:id/publish
router.post(
  '/projects/:id/publish',
  validate({ params: objectIdSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const project = await projectService.publishProject(req.params.id, req.user!._id.toString());
      res.json(project);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/admin/projects/:id/reject
router.post(
  '/projects/:id/reject',
  validate({ params: objectIdSchema, body: rejectProjectSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const project = await projectService.rejectProject(
        req.params.id,
        req.user!._id.toString(),
        req.body.reason
      );
      res.json(project);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/admin/users
router.get(
  '/users',
  validate({ query: paginationSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = req.query as unknown as { page: number; limit: number };
      const result = await userService.getAllUsers(page, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/admin/users/:id/roles
router.patch(
  '/users/:id/roles',
  validate({ params: objectIdSchema, body: updateUserRolesSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await userService.updateUserRoles(req.params.id, req.body.roles);
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

// GET /api/admin/audit-logs
router.get(
  '/audit-logs',
  validate({ query: paginationSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await auditService.getAuditLogs(req.query as Record<string, unknown>);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/admin/stats
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      totalUsers,
      totalProjects,
      activeProjects,
      pendingProjects,
      totalContributions,
      successfulContributions,
    ] = await Promise.all([
      User.countDocuments(),
      Project.countDocuments(),
      Project.countDocuments({ status: ProjectStatus.ACTIVE }),
      Project.countDocuments({ status: ProjectStatus.PENDING_APPROVAL }),
      Contribution.countDocuments(),
      Contribution.countDocuments({ status: ContributionStatus.SUCCEEDED }),
    ]);

    // Calculate total raised
    const totalRaisedResult = await Contribution.aggregate([
      { $match: { status: ContributionStatus.SUCCEEDED } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const totalRaised = totalRaisedResult[0]?.total || 0;

    res.json({
      users: {
        total: totalUsers,
      },
      projects: {
        total: totalProjects,
        active: activeProjects,
        pending: pendingProjects,
      },
      contributions: {
        total: totalContributions,
        successful: successfulContributions,
        totalRaised,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;

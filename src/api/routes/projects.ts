import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, optionalAuth, requireFounder, validate } from '../middlewares/index.js';
import {
  createProjectSchema,
  updateProjectSchema,
  projectQuerySchema,
  objectIdSchema,
  createRewardSchema,
  updateRewardSchema,
  rewardIdSchema,
  projectIdSchema,
} from '../../validators/schemas.js';
import * as projectService from '../../services/projectService.js';
import * as rewardService from '../../services/rewardService.js';

const router = Router();

// GET /api/projects
router.get(
  '/',
  validate({ query: projectQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await projectService.getProjects(req.query as Record<string, unknown>);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/projects/:id
router.get(
  '/:id',
  validate({ params: objectIdSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const project = await projectService.getProjectById(req.params.id);
      res.json(project);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/projects
router.post(
  '/',
  authenticate,
  requireFounder,
  validate({ body: createProjectSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const project = await projectService.createProject(req.user!._id.toString(), req.body);
      res.status(201).json(project);
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/projects/:id
router.patch(
  '/:id',
  authenticate,
  validate({ params: objectIdSchema, body: updateProjectSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const project = await projectService.updateProject(
        req.params.id,
        req.user!._id.toString(),
        req.body
      );
      res.json(project);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/projects/:id
router.delete(
  '/:id',
  authenticate,
  validate({ params: objectIdSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await projectService.deleteProject(req.params.id, req.user!._id.toString());
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/projects/:id/submit
router.post(
  '/:id/submit',
  authenticate,
  validate({ params: objectIdSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const project = await projectService.submitForApproval(req.params.id, req.user!._id.toString());
      res.json(project);
    } catch (error) {
      next(error);
    }
  }
);

// ============ REWARDS ============

// GET /api/projects/:projectId/rewards
router.get(
  '/:projectId/rewards',
  validate({ params: projectIdSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rewards = await rewardService.getProjectRewards(req.params.projectId);
      res.json(rewards);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/projects/:projectId/rewards
router.post(
  '/:projectId/rewards',
  authenticate,
  validate({ params: projectIdSchema, body: createRewardSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reward = await rewardService.addReward(
        req.params.projectId,
        req.user!._id.toString(),
        req.body
      );
      res.status(201).json(reward);
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/projects/:projectId/rewards/:rewardId
router.patch(
  '/:projectId/rewards/:rewardId',
  authenticate,
  validate({ params: rewardIdSchema, body: updateRewardSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reward = await rewardService.updateReward(
        req.params.projectId,
        req.params.rewardId,
        req.user!._id.toString(),
        req.body
      );
      res.json(reward);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/projects/:projectId/rewards/:rewardId
router.delete(
  '/:projectId/rewards/:rewardId',
  authenticate,
  validate({ params: rewardIdSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await rewardService.deleteReward(
        req.params.projectId,
        req.params.rewardId,
        req.user!._id.toString()
      );
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;

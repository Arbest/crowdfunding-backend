import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, optionalAuth, validate } from '../middlewares/index.js';
import { createContributionSchema, objectIdSchema } from '../../validators/schemas.js';
import * as contributionService from '../../services/contributionService.js';
import * as paymentService from '../../services/paymentService.js';

const router = Router();

// POST /api/contributions
router.post(
  '/',
  optionalAuth,
  validate({ body: createContributionSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id.toString() || null;
      const contribution = await contributionService.createContribution(userId, req.body);

      // Create payment intent
      const { clientSecret } = await paymentService.createPaymentIntent(contribution._id.toString());

      res.status(201).json({
        contribution,
        clientSecret,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/contributions/:id
router.get(
  '/:id',
  authenticate,
  validate({ params: objectIdSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contribution = await contributionService.getContributionById(
        req.params.id,
        req.user!._id.toString()
      );
      res.json(contribution);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/contributions/:id/refund
router.post(
  '/:id/refund',
  authenticate,
  validate({ params: objectIdSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contribution = await contributionService.requestRefund(
        req.params.id,
        req.user!._id.toString()
      );
      res.json({
        message: 'Refund request submitted',
        contribution,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

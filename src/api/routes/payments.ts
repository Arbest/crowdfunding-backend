import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import express from 'express';
import * as paymentService from '../../services/paymentService.js';

const router = Router();

// Stripe webhook needs raw body
router.post(
  '/webhook/stripe',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signature = req.headers['stripe-signature'] as string;
      const rawBody = req.body.toString();
      const payload = JSON.parse(rawBody);

      await paymentService.handleStripeWebhook(payload, rawBody, signature);

      res.json({ received: true });
    } catch (error) {
      console.error('Stripe webhook error:', error);
      // Return 200 to prevent retries for processing errors
      res.status(200).json({ received: true, error: 'Processing error' });
    }
  }
);

// GoPay webhook
router.post('/webhook/gopay', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await paymentService.handleGopayWebhook(req.body);

    res.json({ received: true });
  } catch (error) {
    console.error('GoPay webhook error:', error);
    res.status(200).json({ received: true, error: 'Processing error' });
  }
});

export default router;

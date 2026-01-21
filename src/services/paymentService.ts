import crypto from 'crypto';
import Stripe from 'stripe';
import { PaymentEvent } from '../models/PaymentEvent.js';
import { Contribution } from '../models/Contribution.js';
import { Project } from '../models/Project.js';
import { AppError } from '../api/middlewares/errorHandler.js';
import { PaymentProvider, ContributionStatus } from '../types/index.js';
import * as contributionService from './contributionService.js';

// Initialize Stripe client
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey)
  : null;

interface WebhookPayload {
  type: string;
  data: Record<string, unknown>;
}

// Stripe webhook verification (simplified)
export function verifyStripeSignature(payload: string, signature: string, secret: string): boolean {
  try {
    const parts = signature.split(',');
    const timestamp = parts.find((p) => p.startsWith('t='))?.split('=')[1];
    const v1 = parts.find((p) => p.startsWith('v1='))?.split('=')[1];

    if (!timestamp || !v1) return false;

    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

    return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
}

export async function handleStripeWebhook(
  payload: WebhookPayload,
  rawBody: string,
  signature: string
): Promise<void> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  // Verify signature if secret is configured
  const signatureValid = secret ? verifyStripeSignature(rawBody, signature, secret) : true;

  // Get external event ID
  const externalEventId = (payload.data as Record<string, unknown>)?.id as string || crypto.randomUUID();

  // Store event for idempotency
  const existingEvent = await PaymentEvent.findOne({
    provider: PaymentProvider.STRIPE,
    externalEventId,
  });

  if (existingEvent) {
    // Already processed
    return;
  }

  // Create event record
  const event = await PaymentEvent.create({
    provider: PaymentProvider.STRIPE,
    externalEventId,
    type: payload.type,
    payload: payload.data,
    signatureValid,
    receivedAt: new Date(),
  });

  // Process based on event type
  try {
    switch (payload.type) {
      case 'payment_intent.succeeded': {
        const intentId = (payload.data as Record<string, unknown>)?.id as string;
        const contribution = await Contribution.findOne({ 'payment.intentId': intentId });

        if (contribution) {
          await contributionService.markContributionSucceeded(contribution._id.toString(), {
            provider: PaymentProvider.STRIPE,
            intentId,
            chargeId: (payload.data as Record<string, unknown>)?.latest_charge as string,
            raw: payload.data,
          });

          event.contributionId = contribution._id;
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const intentId = (payload.data as Record<string, unknown>)?.id as string;
        const contribution = await Contribution.findOne({ 'payment.intentId': intentId });

        if (contribution) {
          await contributionService.markContributionFailed(contribution._id.toString());
          event.contributionId = contribution._id;
        }
        break;
      }

      default:
        // Unknown event type, just log it
        break;
    }

    event.processedAt = new Date();
    await event.save();
  } catch (error) {
    console.error('Error processing webhook:', error);
    throw error;
  }
}

export async function handleGopayWebhook(payload: WebhookPayload): Promise<void> {
  const externalEventId = (payload.data as Record<string, unknown>)?.id as string || crypto.randomUUID();

  // Store event
  const existingEvent = await PaymentEvent.findOne({
    provider: PaymentProvider.GOPAY,
    externalEventId,
  });

  if (existingEvent) {
    return;
  }

  await PaymentEvent.create({
    provider: PaymentProvider.GOPAY,
    externalEventId,
    type: payload.type,
    payload: payload.data,
    signatureValid: true, // TODO: Implement GoPay signature verification
    receivedAt: new Date(),
    processedAt: new Date(),
  });

  // TODO: Implement GoPay-specific logic
}

// Create payment intent (for Stripe)
export async function createPaymentIntent(contributionId: string): Promise<{ clientSecret: string }> {
  const contribution = await Contribution.findById(contributionId);

  if (!contribution) {
    throw new AppError(404, 'Contribution not found', 'CONTRIBUTION_NOT_FOUND');
  }

  // If contribution already has a payment intent, return existing clientSecret
  if (contribution.payment?.intentId && contribution.status === ContributionStatus.INITIATED) {
    // Retrieve existing payment intent to get clientSecret
    if (stripe) {
      try {
        const existingIntent = await stripe.paymentIntents.retrieve(contribution.payment.intentId);
        if (existingIntent.client_secret) {
          return { clientSecret: existingIntent.client_secret };
        }
      } catch {
        // Intent doesn't exist or expired, create new one
      }
    }
  }

  // Check if Stripe is configured
  if (!stripe) {
    throw new AppError(500, 'Payment provider not configured', 'PAYMENT_PROVIDER_NOT_CONFIGURED');
  }

  // Get project for metadata
  const project = await Project.findById(contribution.projectId);

  // Convert amount to smallest currency unit (e.g., cents for USD, haléře for CZK)
  const amountInSmallestUnit = Math.round(contribution.amount * 100);

  try {
    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInSmallestUnit,
      currency: contribution.currency.toLowerCase(),
      metadata: {
        contributionId: contribution._id.toString(),
        projectId: contribution.projectId.toString(),
        projectTitle: project?.title || 'Unknown Project',
        rewardId: contribution.rewardId || '',
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    if (!paymentIntent.client_secret) {
      throw new AppError(500, 'Failed to create payment intent', 'PAYMENT_INTENT_CREATION_FAILED');
    }

    // Store intent ID on contribution
    contribution.payment = {
      provider: PaymentProvider.STRIPE,
      intentId: paymentIntent.id,
    };
    contribution.status = ContributionStatus.PENDING;
    await contribution.save();

    return { clientSecret: paymentIntent.client_secret };
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      console.error('Stripe error:', error.message);
      throw new AppError(400, `Payment error: ${error.message}`, 'STRIPE_ERROR');
    }
    throw error;
  }
}

// Create refund for a contribution
export async function createRefund(contributionId: string): Promise<void> {
  const contribution = await Contribution.findById(contributionId);

  if (!contribution) {
    throw new AppError(404, 'Contribution not found', 'CONTRIBUTION_NOT_FOUND');
  }

  if (contribution.status !== ContributionStatus.SUCCEEDED) {
    throw new AppError(400, 'Can only refund succeeded contributions', 'INVALID_CONTRIBUTION_STATUS');
  }

  if (!contribution.payment?.intentId) {
    throw new AppError(400, 'No payment intent found', 'NO_PAYMENT_INTENT');
  }

  if (!stripe) {
    throw new AppError(500, 'Payment provider not configured', 'PAYMENT_PROVIDER_NOT_CONFIGURED');
  }

  try {
    await stripe.refunds.create({
      payment_intent: contribution.payment.intentId,
    });

    // Mark contribution as refunded
    await contributionService.markContributionRefunded(contribution._id.toString());
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      console.error('Stripe refund error:', error.message);
      throw new AppError(400, `Refund error: ${error.message}`, 'STRIPE_REFUND_ERROR');
    }
    throw error;
  }
}

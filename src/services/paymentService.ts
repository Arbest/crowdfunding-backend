import crypto from 'crypto';
import { PaymentEvent } from '../models/PaymentEvent.js';
import { Contribution } from '../models/Contribution.js';
import { AppError } from '../api/middlewares/errorHandler.js';
import { PaymentProvider } from '../types/index.js';
import * as contributionService from './contributionService.js';

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

  // In real implementation, this would call Stripe API
  // For now, return mock data
  const mockClientSecret = `pi_${crypto.randomBytes(16).toString('hex')}_secret_${crypto.randomBytes(16).toString('hex')}`;

  // Store intent ID on contribution
  contribution.payment = {
    provider: PaymentProvider.STRIPE,
    intentId: mockClientSecret.split('_secret_')[0],
  };
  await contribution.save();

  return { clientSecret: mockClientSecret };
}

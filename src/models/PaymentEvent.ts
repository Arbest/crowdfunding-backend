import mongoose, { Schema, Model } from 'mongoose';
import { IPaymentEventDocument, PaymentProvider } from '../types/index.js';

const paymentEventSchema = new Schema<IPaymentEventDocument>(
  {
    provider: {
      type: String,
      enum: Object.values(PaymentProvider),
      required: true,
    },
    externalEventId: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    signatureValid: {
      type: Boolean,
      required: true,
    },
    receivedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    contributionId: {
      type: Schema.Types.ObjectId,
      ref: 'Contribution',
      default: null,
      index: true,
    },
  },
  {
    timestamps: false,
    collection: 'paymentEvents',
  }
);

// Unique compound index for idempotency
paymentEventSchema.index({ provider: 1, externalEventId: 1 }, { unique: true });

// Index for finding unprocessed events
paymentEventSchema.index({ processedAt: 1, receivedAt: 1 });

export const PaymentEvent: Model<IPaymentEventDocument> = mongoose.model<IPaymentEventDocument>(
  'PaymentEvent',
  paymentEventSchema
);

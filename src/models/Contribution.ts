import mongoose, { Schema, Model } from 'mongoose';
import { IContributionDocument, ContributionStatus, PaymentProvider } from '../types/index.js';

const paymentRawSchema = new Schema(
  {
    method: String,
    brand: String,
    last4: String,
  },
  { _id: false, strict: false }
);

const paymentSchema = new Schema(
  {
    provider: {
      type: String,
      enum: Object.values(PaymentProvider),
      required: true,
    },
    intentId: {
      type: String,
      required: true,
    },
    chargeId: {
      type: String,
    },
    raw: {
      type: paymentRawSchema,
    },
  },
  { _id: false }
);

const contributionSchema = new Schema<IContributionDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    rewardId: {
      type: String,
      default: null,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    currency: {
      type: String,
      required: true,
      default: 'CZK',
    },
    status: {
      type: String,
      enum: Object.values(ContributionStatus),
      default: ContributionStatus.INITIATED,
      index: true,
    },
    payment: {
      type: paymentSchema,
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'contributions',
  }
);

// Compound indexes
contributionSchema.index({ projectId: 1, status: 1 });
contributionSchema.index({ userId: 1, status: 1 });
contributionSchema.index({ projectId: 1, userId: 1 });
contributionSchema.index({ 'payment.intentId': 1 });

export const Contribution: Model<IContributionDocument> = mongoose.model<IContributionDocument>(
  'Contribution',
  contributionSchema
);

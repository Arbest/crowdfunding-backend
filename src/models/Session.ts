import mongoose, { Schema, Model } from 'mongoose';
import { ISessionDocument } from '../types/index.js';

const sessionSchema = new Schema<ISessionDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    ip: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'sessions',
  }
);

// Compound index for efficient session lookup
sessionSchema.index({ userId: 1, expiresAt: 1 });

// TTL index for automatic session cleanup
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session: Model<ISessionDocument> = mongoose.model<ISessionDocument>('Session', sessionSchema);

import mongoose, { Schema, Model } from 'mongoose';
import { IUserDocument, UserRole } from '../types/index.js';

const userStatsSchema = new Schema(
  {
    totalContributed: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalProjectsOwned: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const userSchema = new Schema<IUserDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    roles: {
      type: [String],
      enum: Object.values(UserRole),
      default: [UserRole.USER],
    },
    stats: {
      type: userStatsSchema,
      default: () => ({
        totalContributed: 0,
        totalProjectsOwned: 0,
      }),
    },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

// Virtual for full name
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Ensure virtuals are included in JSON
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

export const User: Model<IUserDocument> = mongoose.model<IUserDocument>('User', userSchema);

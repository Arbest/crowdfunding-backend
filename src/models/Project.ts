import mongoose, { Schema, Model } from 'mongoose';
import { IProjectDocument, ProjectStatus, ProjectCategory } from '../types/index.js';

const rewardSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: 'CZK',
    },
    limit: {
      type: Number,
      default: null,
      min: 0,
    },
    backersCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    _id: false,
    timestamps: true,
  }
);

const projectStatsSchema = new Schema(
  {
    currentAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    backerCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const projectSchema = new Schema<IProjectDocument>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    shortDescription: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: Object.values(ProjectCategory),
      required: true,
      index: true,
    },
    images: {
      type: [String],
      default: [],
    },
    targetAmount: {
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
      enum: Object.values(ProjectStatus),
      default: ProjectStatus.DRAFT,
      index: true,
    },
    stats: {
      type: projectStatsSchema,
      default: () => ({
        currentAmount: 0,
        backerCount: 0,
      }),
    },
    rewards: {
      type: [rewardSchema],
      default: [],
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    deadlineAt: {
      type: Date,
      required: true,
    },
    endedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'projects',
  }
);

// Compound indexes
projectSchema.index({ status: 1, category: 1 });
projectSchema.index({ status: 1, deadlineAt: 1 });
projectSchema.index({ ownerId: 1, status: 1 });

// Virtual for funding progress percentage
projectSchema.virtual('fundingProgress').get(function () {
  if (this.targetAmount === 0) return 0;
  return Math.round((this.stats.currentAmount / this.targetAmount) * 100);
});

// Virtual for checking if project is funded
projectSchema.virtual('isFunded').get(function () {
  return this.stats.currentAmount >= this.targetAmount;
});

projectSchema.set('toJSON', { virtuals: true });
projectSchema.set('toObject', { virtuals: true });

export const Project: Model<IProjectDocument> = mongoose.model<IProjectDocument>('Project', projectSchema);

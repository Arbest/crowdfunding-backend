import { Contribution } from '../models/Contribution.js';
import { Project } from '../models/Project.js';
import { User } from '../models/User.js';
import { AppError } from '../api/middlewares/errorHandler.js';
import { ContributionStatus, ProjectStatus, AuditEntityType, AuditSource, PaymentProvider } from '../types/index.js';
import type { IContributionDocument } from '../types/index.js';
import * as auditService from './auditService.js';

interface CreateContributionInput {
  projectId: string;
  rewardId?: string | null;
  amount: number;
  currency?: string;
}

export async function createContribution(
  userId: string | null,
  input: CreateContributionInput
): Promise<IContributionDocument> {
  const { projectId, rewardId, amount, currency = 'CZK' } = input;

  // Get project
  const project = await Project.findById(projectId);

  if (!project) {
    throw new AppError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }

  if (project.status !== ProjectStatus.ACTIVE) {
    throw new AppError(400, 'Project is not active', 'PROJECT_NOT_ACTIVE');
  }

  if (new Date() > project.deadlineAt) {
    throw new AppError(400, 'Project deadline has passed', 'PROJECT_ENDED');
  }

  // Validate reward if provided
  if (rewardId) {
    const reward = project.rewards.find((r) => r.id === rewardId);

    if (!reward) {
      throw new AppError(404, 'Reward not found', 'REWARD_NOT_FOUND');
    }

    if (amount < reward.price) {
      throw new AppError(400, `Minimum amount for this reward is ${reward.price} ${reward.currency}`, 'AMOUNT_TOO_LOW');
    }

    if (reward.limit !== null && reward.backersCount >= reward.limit) {
      throw new AppError(400, 'This reward is no longer available', 'REWARD_SOLD_OUT');
    }
  }

  // Create contribution
  const contribution = await Contribution.create({
    userId,
    projectId,
    rewardId,
    amount,
    currency,
    status: ContributionStatus.INITIATED,
  });

  await auditService.log({
    entity: { type: AuditEntityType.CONTRIBUTION, id: contribution._id },
    action: 'contribution.created',
    actorUserId: userId,
    source: AuditSource.PUBLIC_API,
    dataAfter: contribution.toObject(),
  });

  return contribution;
}

export async function getContributionById(
  contributionId: string,
  userId?: string
): Promise<IContributionDocument> {
  const contribution = await Contribution.findById(contributionId).populate(
    'projectId',
    'title shortDescription images'
  );

  if (!contribution) {
    throw new AppError(404, 'Contribution not found', 'CONTRIBUTION_NOT_FOUND');
  }

  // Only owner can view their contribution details
  if (userId && contribution.userId?.toString() !== userId) {
    throw new AppError(403, 'Not authorized', 'FORBIDDEN');
  }

  return contribution;
}

export async function markContributionSucceeded(
  contributionId: string,
  paymentData: {
    provider: PaymentProvider;
    intentId: string;
    chargeId?: string;
    raw?: Record<string, unknown>;
  }
): Promise<IContributionDocument> {
  const contribution = await Contribution.findById(contributionId);

  if (!contribution) {
    throw new AppError(404, 'Contribution not found', 'CONTRIBUTION_NOT_FOUND');
  }

  if (contribution.status === ContributionStatus.SUCCEEDED) {
    return contribution; // Idempotent
  }

  const dataBefore = contribution.toObject();

  contribution.status = ContributionStatus.SUCCEEDED;
  contribution.paidAt = new Date();
  contribution.payment = paymentData;
  await contribution.save();

  // Update project stats
  await Project.findByIdAndUpdate(contribution.projectId, {
    $inc: {
      'stats.currentAmount': contribution.amount,
      'stats.backerCount': 1,
    },
  });

  // Update reward backers count if applicable
  if (contribution.rewardId) {
    await Project.updateOne(
      { _id: contribution.projectId, 'rewards.id': contribution.rewardId },
      { $inc: { 'rewards.$.backersCount': 1 } }
    );
  }

  // Update user stats if logged in
  if (contribution.userId) {
    await User.findByIdAndUpdate(contribution.userId, {
      $inc: { 'stats.totalContributed': contribution.amount },
    });
  }

  await auditService.log({
    entity: { type: AuditEntityType.CONTRIBUTION, id: contribution._id },
    action: 'contribution.succeeded',
    actorUserId: null, // System/webhook
    source: AuditSource.WEBHOOK,
    dataBefore,
    dataAfter: contribution.toObject(),
  });

  return contribution;
}

export async function markContributionFailed(contributionId: string): Promise<IContributionDocument> {
  const contribution = await Contribution.findById(contributionId);

  if (!contribution) {
    throw new AppError(404, 'Contribution not found', 'CONTRIBUTION_NOT_FOUND');
  }

  const dataBefore = contribution.toObject();

  contribution.status = ContributionStatus.FAILED;
  await contribution.save();

  await auditService.log({
    entity: { type: AuditEntityType.CONTRIBUTION, id: contribution._id },
    action: 'contribution.failed',
    actorUserId: null,
    source: AuditSource.WEBHOOK,
    dataBefore,
    dataAfter: contribution.toObject(),
  });

  return contribution;
}

export async function requestRefund(contributionId: string, userId: string): Promise<IContributionDocument> {
  const contribution = await Contribution.findById(contributionId);

  if (!contribution) {
    throw new AppError(404, 'Contribution not found', 'CONTRIBUTION_NOT_FOUND');
  }

  if (contribution.userId?.toString() !== userId) {
    throw new AppError(403, 'Not authorized', 'FORBIDDEN');
  }

  if (contribution.status !== ContributionStatus.SUCCEEDED) {
    throw new AppError(400, 'Can only refund successful contributions', 'INVALID_STATUS');
  }

  // In real implementation, this would trigger refund via payment provider
  // For now, just mark as refund requested

  await auditService.log({
    entity: { type: AuditEntityType.CONTRIBUTION, id: contribution._id },
    action: 'contribution.refund_requested',
    actorUserId: userId,
    source: AuditSource.DASHBOARD,
    dataBefore: contribution.toObject(),
  });

  return contribution;
}

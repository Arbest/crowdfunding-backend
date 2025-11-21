import crypto from 'crypto';
import { Project } from '../models/Project.js';
import { AppError } from '../api/middlewares/errorHandler.js';
import { ProjectStatus, AuditEntityType, AuditSource } from '../types/index.js';
import type { IReward } from '../types/index.js';
import * as auditService from './auditService.js';

function generateRewardId(): string {
  return crypto.randomUUID();
}

interface CreateRewardInput {
  title: string;
  description: string;
  price: number;
  currency?: string;
  limit?: number | null;
}

interface UpdateRewardInput {
  title?: string;
  description?: string;
  price?: number;
  limit?: number | null;
}

export async function addReward(projectId: string, userId: string, input: CreateRewardInput): Promise<IReward> {
  const project = await Project.findById(projectId);

  if (!project) {
    throw new AppError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }

  if (project.ownerId.toString() !== userId) {
    throw new AppError(403, 'Not authorized', 'FORBIDDEN');
  }

  if (project.status !== ProjectStatus.DRAFT) {
    throw new AppError(400, 'Can only add rewards to draft projects', 'INVALID_STATUS');
  }

  const reward: IReward = {
    id: generateRewardId(),
    title: input.title,
    description: input.description,
    price: input.price,
    currency: input.currency || 'CZK',
    limit: input.limit ?? null,
    backersCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  project.rewards.push(reward);
  await project.save();

  await auditService.log({
    entity: { type: AuditEntityType.REWARD, id: project._id },
    action: 'reward.created',
    actorUserId: userId,
    source: AuditSource.DASHBOARD,
    dataAfter: { projectId, reward },
  });

  return reward;
}

export async function updateReward(
  projectId: string,
  rewardId: string,
  userId: string,
  input: UpdateRewardInput
): Promise<IReward> {
  const project = await Project.findById(projectId);

  if (!project) {
    throw new AppError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }

  if (project.ownerId.toString() !== userId) {
    throw new AppError(403, 'Not authorized', 'FORBIDDEN');
  }

  if (project.status !== ProjectStatus.DRAFT) {
    throw new AppError(400, 'Can only edit rewards on draft projects', 'INVALID_STATUS');
  }

  const rewardIndex = project.rewards.findIndex((r) => r.id === rewardId);

  if (rewardIndex === -1) {
    throw new AppError(404, 'Reward not found', 'REWARD_NOT_FOUND');
  }

  const dataBefore = { ...project.rewards[rewardIndex] };

  if (input.title !== undefined) project.rewards[rewardIndex].title = input.title;
  if (input.description !== undefined) project.rewards[rewardIndex].description = input.description;
  if (input.price !== undefined) project.rewards[rewardIndex].price = input.price;
  if (input.limit !== undefined) project.rewards[rewardIndex].limit = input.limit;
  project.rewards[rewardIndex].updatedAt = new Date();

  await project.save();

  await auditService.log({
    entity: { type: AuditEntityType.REWARD, id: project._id },
    action: 'reward.updated',
    actorUserId: userId,
    source: AuditSource.DASHBOARD,
    dataBefore: { projectId, reward: dataBefore },
    dataAfter: { projectId, reward: project.rewards[rewardIndex] },
  });

  return project.rewards[rewardIndex];
}

export async function deleteReward(projectId: string, rewardId: string, userId: string): Promise<void> {
  const project = await Project.findById(projectId);

  if (!project) {
    throw new AppError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }

  if (project.ownerId.toString() !== userId) {
    throw new AppError(403, 'Not authorized', 'FORBIDDEN');
  }

  if (project.status !== ProjectStatus.DRAFT) {
    throw new AppError(400, 'Can only delete rewards from draft projects', 'INVALID_STATUS');
  }

  const rewardIndex = project.rewards.findIndex((r) => r.id === rewardId);

  if (rewardIndex === -1) {
    throw new AppError(404, 'Reward not found', 'REWARD_NOT_FOUND');
  }

  const deletedReward = project.rewards[rewardIndex];
  project.rewards.splice(rewardIndex, 1);
  await project.save();

  await auditService.log({
    entity: { type: AuditEntityType.REWARD, id: project._id },
    action: 'reward.deleted',
    actorUserId: userId,
    source: AuditSource.DASHBOARD,
    dataBefore: { projectId, reward: deletedReward },
  });
}

export async function getProjectRewards(projectId: string): Promise<IReward[]> {
  const project = await Project.findById(projectId).select('rewards');

  if (!project) {
    throw new AppError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }

  return project.rewards;
}

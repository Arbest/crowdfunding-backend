import { User } from '../models/User.js';
import { Contribution } from '../models/Contribution.js';
import { Project } from '../models/Project.js';
import { AppError } from '../api/middlewares/errorHandler.js';
import { ContributionStatus, ProjectStatus, UserRole } from '../types/index.js';
import type { IUserDocument } from '../types/index.js';

interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
}

export async function updateUser(userId: string, input: UpdateUserInput): Promise<IUserDocument> {
  const user = await User.findByIdAndUpdate(userId, { $set: input }, { new: true });

  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  return user;
}

export async function getUserById(userId: string): Promise<IUserDocument> {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  return user;
}

export async function getPublicProfile(userId: string) {
  const user = await User.findById(userId).select('firstName lastName createdAt stats');

  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  return user;
}

export async function getUserContributions(userId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;

  const [contributions, total] = await Promise.all([
    Contribution.find({ userId, status: ContributionStatus.SUCCEEDED })
      .populate('projectId', 'title shortDescription images status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Contribution.countDocuments({ userId, status: ContributionStatus.SUCCEEDED }),
  ]);

  return {
    data: contributions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getUserProjects(userId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;

  const [projects, total] = await Promise.all([
    Project.find({ ownerId: userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Project.countDocuments({ ownerId: userId }),
  ]);

  return {
    data: projects,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// Admin functions
export async function getAllUsers(page = 1, limit = 20) {
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find().select('-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(),
  ]);

  return {
    data: users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function updateUserRoles(userId: string, roles: UserRole[]): Promise<IUserDocument> {
  const user = await User.findByIdAndUpdate(userId, { $set: { roles } }, { new: true });

  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  return user;
}

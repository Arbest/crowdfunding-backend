import { Project } from '../models/Project.js';
import { User } from '../models/User.js';
import { AppError } from '../api/middlewares/errorHandler.js';
import { ProjectStatus, ProjectCategory, AuditEntityType, AuditSource } from '../types/index.js';
import type { IProjectDocument, IReward } from '../types/index.js';
import * as auditService from './auditService.js';

interface CreateProjectInput {
  title: string;
  shortDescription: string;
  description: string;
  category: ProjectCategory;
  targetAmount: number;
  currency?: string;
  deadlineAt: Date;
  images?: string[];
}

interface UpdateProjectInput {
  title?: string;
  shortDescription?: string;
  description?: string;
  category?: ProjectCategory;
  targetAmount?: number;
  deadlineAt?: Date;
  images?: string[];
}

interface ProjectQuery {
  status?: ProjectStatus;
  category?: ProjectCategory;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function createProject(ownerId: string, input: CreateProjectInput): Promise<IProjectDocument> {
  const project = await Project.create({
    ownerId,
    ...input,
    status: ProjectStatus.DRAFT,
  });

  // Update user's project count
  await User.findByIdAndUpdate(ownerId, { $inc: { 'stats.totalProjectsOwned': 1 } });

  // Audit log
  await auditService.log({
    entity: { type: AuditEntityType.PROJECT, id: project._id },
    action: 'project.created',
    actorUserId: ownerId,
    source: AuditSource.DASHBOARD,
    dataAfter: project.toObject(),
  });

  return project;
}

export async function updateProject(
  projectId: string,
  userId: string,
  input: UpdateProjectInput
): Promise<IProjectDocument> {
  const project = await Project.findById(projectId);

  if (!project) {
    throw new AppError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }

  if (project.ownerId.toString() !== userId) {
    throw new AppError(403, 'Not authorized to update this project', 'FORBIDDEN');
  }

  if (project.status !== ProjectStatus.DRAFT) {
    throw new AppError(400, 'Can only edit draft projects', 'INVALID_STATUS');
  }

  const dataBefore = project.toObject();
  Object.assign(project, input);
  await project.save();

  await auditService.log({
    entity: { type: AuditEntityType.PROJECT, id: project._id },
    action: 'project.updated',
    actorUserId: userId,
    source: AuditSource.DASHBOARD,
    dataBefore,
    dataAfter: project.toObject(),
  });

  return project;
}

export async function deleteProject(projectId: string, userId: string): Promise<void> {
  const project = await Project.findById(projectId);

  if (!project) {
    throw new AppError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }

  if (project.ownerId.toString() !== userId) {
    throw new AppError(403, 'Not authorized to delete this project', 'FORBIDDEN');
  }

  if (project.status !== ProjectStatus.DRAFT) {
    throw new AppError(400, 'Can only delete draft projects', 'INVALID_STATUS');
  }

  await project.deleteOne();

  await User.findByIdAndUpdate(userId, { $inc: { 'stats.totalProjectsOwned': -1 } });

  await auditService.log({
    entity: { type: AuditEntityType.PROJECT, id: project._id },
    action: 'project.deleted',
    actorUserId: userId,
    source: AuditSource.DASHBOARD,
    dataBefore: project.toObject(),
  });
}

export async function getProjectById(projectId: string): Promise<IProjectDocument> {
  const project = await Project.findById(projectId).populate('ownerId', 'firstName lastName');

  if (!project) {
    throw new AppError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }

  return project;
}

export async function getProjects(query: ProjectQuery) {
  const { status, category, search, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = query;

  const filter: Record<string, unknown> = {};

  // Only show active projects by default for public
  if (status) {
    filter.status = status;
  } else {
    filter.status = ProjectStatus.ACTIVE;
  }

  if (category) {
    filter.category = category;
  }

  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { shortDescription: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;
  const sort: Record<string, 1 | -1> = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [projects, total] = await Promise.all([
    Project.find(filter).populate('ownerId', 'firstName lastName').sort(sort).skip(skip).limit(limit),
    Project.countDocuments(filter),
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

// Status transitions
export async function submitForApproval(projectId: string, userId: string): Promise<IProjectDocument> {
  const project = await Project.findById(projectId);

  if (!project) {
    throw new AppError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }

  if (project.ownerId.toString() !== userId) {
    throw new AppError(403, 'Not authorized', 'FORBIDDEN');
  }

  if (project.status !== ProjectStatus.DRAFT) {
    throw new AppError(400, 'Project must be in draft status', 'INVALID_STATUS');
  }

  if (project.rewards.length === 0) {
    throw new AppError(400, 'Project must have at least one reward', 'NO_REWARDS');
  }

  const dataBefore = project.toObject();
  project.status = ProjectStatus.PENDING_APPROVAL;
  await project.save();

  await auditService.log({
    entity: { type: AuditEntityType.PROJECT, id: project._id },
    action: 'project.submitted_for_approval',
    actorUserId: userId,
    source: AuditSource.DASHBOARD,
    dataBefore,
    dataAfter: project.toObject(),
  });

  return project;
}

export async function publishProject(projectId: string, adminId: string): Promise<IProjectDocument> {
  const project = await Project.findById(projectId);

  if (!project) {
    throw new AppError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }

  if (project.status !== ProjectStatus.PENDING_APPROVAL) {
    throw new AppError(400, 'Project must be pending approval', 'INVALID_STATUS');
  }

  const dataBefore = project.toObject();
  project.status = ProjectStatus.ACTIVE;
  project.publishedAt = new Date();
  await project.save();

  await auditService.log({
    entity: { type: AuditEntityType.PROJECT, id: project._id },
    action: 'project.published',
    actorUserId: adminId,
    source: AuditSource.DASHBOARD,
    dataBefore,
    dataAfter: project.toObject(),
  });

  return project;
}

export async function rejectProject(
  projectId: string,
  adminId: string,
  reason: string
): Promise<IProjectDocument> {
  const project = await Project.findById(projectId);

  if (!project) {
    throw new AppError(404, 'Project not found', 'PROJECT_NOT_FOUND');
  }

  if (project.status !== ProjectStatus.PENDING_APPROVAL) {
    throw new AppError(400, 'Project must be pending approval', 'INVALID_STATUS');
  }

  const dataBefore = project.toObject();
  project.status = ProjectStatus.REJECTED;
  await project.save();

  await auditService.log({
    entity: { type: AuditEntityType.PROJECT, id: project._id },
    action: 'project.rejected',
    actorUserId: adminId,
    source: AuditSource.DASHBOARD,
    dataBefore,
    dataAfter: { ...project.toObject(), rejectionReason: reason },
  });

  return project;
}

export async function getPendingProjects(page = 1, limit = 20) {
  const skip = (page - 1) * limit;

  const [projects, total] = await Promise.all([
    Project.find({ status: ProjectStatus.PENDING_APPROVAL })
      .populate('ownerId', 'firstName lastName email')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit),
    Project.countDocuments({ status: ProjectStatus.PENDING_APPROVAL }),
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

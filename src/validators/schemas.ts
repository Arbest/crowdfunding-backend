import { z } from 'zod';
import { ProjectCategory, ProjectStatus, ContributionStatus, UserRole } from '../types/index.js';

// ============ AUTH ============

export const registerSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

// ============ USER ============

export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
});

export const updateUserRolesSchema = z.object({
  roles: z.array(z.nativeEnum(UserRole)),
});

// ============ PROJECT ============

export const createProjectSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(100),
  shortDescription: z.string().min(10).max(300),
  description: z.string().min(50, 'Description must be at least 50 characters'),
  category: z.nativeEnum(ProjectCategory),
  targetAmount: z.number().positive('Target amount must be positive'),
  currency: z.string().default('CZK'),
  deadlineAt: z.string().datetime().transform((s) => new Date(s)),
  images: z.array(z.string().url()).optional(),
});

export const updateProjectSchema = z.object({
  title: z.string().min(3).max(100).optional(),
  shortDescription: z.string().min(10).max(300).optional(),
  description: z.string().min(50).optional(),
  category: z.nativeEnum(ProjectCategory).optional(),
  targetAmount: z.number().positive().optional(),
  deadlineAt: z.string().datetime().transform((s) => new Date(s)).optional(),
  images: z.array(z.string().url()).optional(),
});

export const projectQuerySchema = z.object({
  status: z.nativeEnum(ProjectStatus).optional(),
  category: z.nativeEnum(ProjectCategory).optional(),
  search: z.string().optional(),
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().positive().max(100).default(20),
  sortBy: z.enum(['createdAt', 'deadlineAt', 'stats.currentAmount', 'stats.backerCount']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ============ REWARD ============

export const createRewardSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  price: z.number().positive(),
  currency: z.string().default('CZK'),
  limit: z.number().positive().nullable().optional(),
});

export const updateRewardSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(1000).optional(),
  price: z.number().positive().optional(),
  limit: z.number().positive().nullable().optional(),
});

// ============ CONTRIBUTION ============

export const createContributionSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  rewardId: z.string().nullable().optional(),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().default('CZK'),
});

// ============ ADMIN ============

export const adminProjectQuerySchema = z.object({
  status: z.nativeEnum(ProjectStatus).optional(),
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().positive().max(100).default(20),
});

export const rejectProjectSchema = z.object({
  reason: z.string().min(10, 'Rejection reason must be at least 10 characters'),
});

// ============ PAGINATION ============

export const paginationSchema = z.object({
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().positive().max(100).default(20),
});

export const objectIdSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
});

export const projectIdSchema = z.object({
  projectId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid project ID format'),
});

export const rewardIdSchema = z.object({
  projectId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid project ID format'),
  rewardId: z.string().min(1, 'Reward ID is required'),
});

import type { Types, Document } from 'mongoose';

// ============ ENUMS ============

export enum UserRole {
  USER = 'user',
  FOUNDER = 'founder',
  ADMIN = 'admin',
}

export enum ProjectStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pendingApproval',
  ACTIVE = 'active',
  SUCCESSFUL = 'successful',
  FAILED = 'failed',
  REJECTED = 'rejected',
}

export enum ProjectCategory {
  TECHNOLOGY = 'technology',
  DESIGN = 'design',
  ART = 'art',
  MUSIC = 'music',
  FILM = 'film',
  GAMES = 'games',
  PUBLISHING = 'publishing',
  FOOD = 'food',
  FASHION = 'fashion',
  OTHER = 'other',
}

export enum ContributionStatus {
  INITIATED = 'initiated',
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum PaymentProvider {
  STRIPE = 'stripe',
  GOPAY = 'gopay',
}

export enum AuditEntityType {
  PROJECT = 'project',
  REWARD = 'reward',
  CONTRIBUTION = 'contribution',
  USER = 'user',
}

export enum AuditSource {
  DASHBOARD = 'dashboard',
  PUBLIC_API = 'public_api',
  SYSTEM = 'system',
  WEBHOOK = 'webhook',
}

// ============ INTERFACES ============

// User
export interface IUserStats {
  totalContributed: number;
  totalProjectsOwned: number;
}

export interface IUser {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  roles: UserRole[];
  stats: IUserStats;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDocument extends IUser, Document {}

// Session
export interface ISession {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface ISessionDocument extends ISession, Document {}

// Project - Reward (embedded)
export interface IReward {
  id: string; // UUID
  title: string;
  description: string;
  price: number;
  currency: string;
  limit: number | null;
  backersCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Project - Stats (embedded)
export interface IProjectStats {
  currentAmount: number;
  backerCount: number;
}

export interface IProject {
  ownerId: Types.ObjectId;
  title: string;
  shortDescription: string;
  description: string;
  category: ProjectCategory;
  images: string[];
  targetAmount: number;
  currency: string;
  status: ProjectStatus;
  stats: IProjectStats;
  rewards: IReward[];
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  deadlineAt: Date;
  endedAt: Date | null;
}

export interface IProjectDocument extends IProject, Document {}

// Contribution - Payment (embedded)
export interface IPaymentRaw {
  method?: string;
  brand?: string;
  last4?: string;
  [key: string]: unknown;
}

export interface IPayment {
  provider: PaymentProvider;
  intentId: string;
  chargeId?: string;
  raw?: IPaymentRaw;
}

export interface IContribution {
  userId: Types.ObjectId | null;
  projectId: Types.ObjectId;
  rewardId: string | null;
  amount: number;
  currency: string;
  status: ContributionStatus;
  payment?: IPayment;
  createdAt: Date;
  updatedAt: Date;
  paidAt: Date | null;
}

export interface IContributionDocument extends IContribution, Document {}

// PaymentEvent
export interface IPaymentEvent {
  provider: PaymentProvider;
  externalEventId: string;
  type: string;
  payload: Record<string, unknown>;
  signatureValid: boolean;
  receivedAt: Date;
  processedAt: Date | null;
  contributionId: Types.ObjectId | null;
}

export interface IPaymentEventDocument extends IPaymentEvent, Document {}

// AuditLog
export interface IAuditEntity {
  type: AuditEntityType;
  id: Types.ObjectId;
}

export interface IAuditLog {
  entity: IAuditEntity;
  action: string;
  actorUserId: Types.ObjectId | null;
  source: AuditSource;
  dataBefore: Record<string, unknown>;
  dataAfter: Record<string, unknown>;
  createdAt: Date;
}

export interface IAuditLogDocument extends IAuditLog, Document {}

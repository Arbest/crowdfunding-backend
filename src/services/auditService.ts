import { AuditLog } from '../models/AuditLog.js';
import type { Types } from 'mongoose';
import type { AuditEntityType, AuditSource } from '../types/index.js';

interface LogInput {
  entity: {
    type: AuditEntityType;
    id: Types.ObjectId;
  };
  action: string;
  actorUserId: string | null;
  source: AuditSource;
  dataBefore?: unknown;
  dataAfter?: unknown;
}

export async function log(input: LogInput): Promise<void> {
  await AuditLog.create({
    entity: input.entity,
    action: input.action,
    actorUserId: input.actorUserId,
    source: input.source,
    dataBefore: input.dataBefore || {},
    dataAfter: input.dataAfter || {},
  });
}

interface AuditQuery {
  entityType?: AuditEntityType;
  entityId?: string;
  actorUserId?: string;
  action?: string;
  page?: number;
  limit?: number;
}

export async function getAuditLogs(query: AuditQuery) {
  const { entityType, entityId, actorUserId, action, page = 1, limit = 50 } = query;

  const filter: Record<string, unknown> = {};

  if (entityType) {
    filter['entity.type'] = entityType;
  }

  if (entityId) {
    filter['entity.id'] = entityId;
  }

  if (actorUserId) {
    filter.actorUserId = actorUserId;
  }

  if (action) {
    filter.action = { $regex: action, $options: 'i' };
  }

  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('actorUserId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  return {
    data: logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

import mongoose, { Schema, Model } from 'mongoose';
import { IAuditLogDocument, AuditEntityType, AuditSource } from '../types/index.js';

const auditEntitySchema = new Schema(
  {
    type: {
      type: String,
      enum: Object.values(AuditEntityType),
      required: true,
    },
    id: {
      type: Schema.Types.ObjectId,
      required: true,
    },
  },
  { _id: false }
);

const auditLogSchema = new Schema<IAuditLogDocument>(
  {
    entity: {
      type: auditEntitySchema,
      required: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    source: {
      type: String,
      enum: Object.values(AuditSource),
      required: true,
    },
    dataBefore: {
      type: Schema.Types.Mixed,
      default: {},
    },
    dataAfter: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'auditLogs',
  }
);

// Compound indexes for efficient querying
auditLogSchema.index({ 'entity.type': 1, 'entity.id': 1 });
auditLogSchema.index({ 'entity.type': 1, createdAt: -1 });
auditLogSchema.index({ actorUserId: 1, createdAt: -1 });

export const AuditLog: Model<IAuditLogDocument> = mongoose.model<IAuditLogDocument>('AuditLog', auditLogSchema);

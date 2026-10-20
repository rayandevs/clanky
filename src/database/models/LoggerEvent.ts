import { Schema, model } from 'mongoose';

export interface LoggerAttachmentEvidence {
  name: string;
  size: number;
  contentType: string | null;
}

export interface LoggerEventRecord {
  eventId: string;
  eventKey: string;
  guildId: string;
  eventType: string;
  category: string;
  source: 'gateway' | 'audit_log' | 'detector';
  occurredAt: Date;
  actorId: string | null;
  actorAttribution: 'self' | 'audit_log' | 'system' | 'unknown';
  targetUserId: string | null;
  channelId: string | null;
  roleId: string | null;
  messageId: string | null;
  summary: string;
  evidence: {
    content?: string;
    beforeContent?: string;
    attachments?: LoggerAttachmentEvidence[];
    changedFields?: string[];
    linkCount?: number;
    relatedEventIds?: string[];
    relatedMessageIds?: string[];
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  riskReasons: string[];
  incidentId: string | null;
  incidentAlert: boolean;
  alertRoleIds: string[];
  evidenceHash: string;
  delivery: {
    status: 'pending' | 'sending' | 'delivered' | 'failed' | 'not_configured';
    channelId: string | null;
    attempts: number;
    nextAttemptAt: Date | null;
    leaseUntil: Date | null;
    lastError: string | null;
    messageId: string | null;
  };
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const loggerEventSchema = new Schema<LoggerEventRecord>(
  {
    eventId: { type: String, required: true, unique: true },
    eventKey: { type: String, required: true, unique: true },
    guildId: { type: String, required: true },
    eventType: { type: String, required: true },
    category: { type: String, required: true },
    source: { type: String, enum: ['gateway', 'audit_log', 'detector'], required: true },
    occurredAt: { type: Date, required: true },
    actorId: { type: String, default: null },
    actorAttribution: { type: String, enum: ['self', 'audit_log', 'system', 'unknown'], required: true },
    targetUserId: { type: String, default: null },
    channelId: { type: String, default: null },
    roleId: { type: String, default: null },
    messageId: { type: String, default: null },
    summary: { type: String, required: true, maxlength: 500 },
    evidence: { type: Schema.Types.Mixed, default: {} },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'low' },
    riskScore: { type: Number, min: 0, max: 100, default: 0 },
    riskReasons: { type: [String], default: [] },
    incidentId: { type: String, default: null },
    incidentAlert: { type: Boolean, default: false },
    alertRoleIds: { type: [String], default: [] },
    evidenceHash: { type: String, required: true, minlength: 64, maxlength: 64 },
    delivery: {
      status: { type: String, enum: ['pending', 'sending', 'delivered', 'failed', 'not_configured'], default: 'pending' },
      channelId: { type: String, default: null },
      attempts: { type: Number, default: 0 },
      nextAttemptAt: { type: Date, default: null },
      leaseUntil: { type: Date, default: null },
      lastError: { type: String, default: null, maxlength: 500 },
      messageId: { type: String, default: null },
    },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true, minimize: false },
);

loggerEventSchema.index({ guildId: 1, occurredAt: -1 });
loggerEventSchema.index({ guildId: 1, category: 1, occurredAt: -1 });
loggerEventSchema.index({ guildId: 1, eventType: 1, occurredAt: -1 });
loggerEventSchema.index({ guildId: 1, actorId: 1, occurredAt: -1 });
loggerEventSchema.index({ guildId: 1, incidentId: 1, occurredAt: 1 });
loggerEventSchema.index({ 'delivery.status': 1, 'delivery.nextAttemptAt': 1, 'delivery.leaseUntil': 1 });
loggerEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const LoggerEventModel = model<LoggerEventRecord>('LoggerEvent', loggerEventSchema);

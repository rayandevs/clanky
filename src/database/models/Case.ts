import { Schema, model } from 'mongoose';

export const CASE_TYPES = ['warn', 'timeout', 'untimeout', 'kick', 'ban', 'unban', 'purge'] as const;
export type CaseType = (typeof CASE_TYPES)[number];

export interface CaseRecord {
  guildId: string;
  caseId: number;
  type: CaseType;
  targetId: string;
  targetTag: string;
  moderatorId: string;
  reason: string | null;
  status?: 'active' | 'voided';
  notes?: Array<{ moderatorId: string; text: string; createdAt: Date }>;
  reportId?: string | null;
  appealId?: string | null;
  /** Duration in ms for timeouts. */
  duration: number | null;
  logMessageId: string | null;
  logChannelId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const caseSchema = new Schema<CaseRecord>(
  {
    guildId: { type: String, required: true },
    caseId: { type: Number, required: true },
    type: { type: String, enum: CASE_TYPES, required: true },
    targetId: { type: String, required: true },
    targetTag: { type: String, default: 'unknown' },
    moderatorId: { type: String, required: true },
    reason: { type: String, default: null },
    status: { type: String, enum: ['active', 'voided'], default: 'active' },
    notes: { type: [{ moderatorId: { type: String, required: true }, text: { type: String, required: true, maxlength: 1000 }, createdAt: { type: Date, required: true, default: Date.now } }], default: [] },
    reportId: { type: String, default: null },
    appealId: { type: String, default: null },
    duration: { type: Number, default: null },
    logMessageId: { type: String, default: null },
    logChannelId: { type: String, default: null },
  },
  { timestamps: true },
);

caseSchema.index({ guildId: 1, caseId: 1 }, { unique: true });
caseSchema.index({ guildId: 1, targetId: 1, createdAt: -1 });

export const CaseModel = model<CaseRecord>('Case', caseSchema);

import { Schema, model } from 'mongoose';

export const REPORT_REASONS = ['spam', 'harassment', 'nsfw', 'other'] as const;
export type ModerationReportReason = (typeof REPORT_REASONS)[number];
export type ModerationReportStatus = 'open' | 'in_review' | 'processing' | 'resolved' | 'dismissed';

export interface ModerationReportRecord {
  reportId: string;
  reportKey: string;
  guildId: string;
  reporterId: string;
  targetId: string;
  channelId: string;
  messageId: string;
  messageUrl: string;
  reason: ModerationReportReason;
  details: string | null;
  contentSnapshot: string;
  status: ModerationReportStatus;
  processingAt: Date | null;
  processingToken: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  caseId: number | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const reportSchema = new Schema<ModerationReportRecord>(
  {
    reportId: { type: String, required: true, unique: true },
    reportKey: { type: String, required: true, unique: true },
    guildId: { type: String, required: true },
    reporterId: { type: String, required: true },
    targetId: { type: String, required: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true },
    messageUrl: { type: String, required: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    details: { type: String, maxlength: 500, default: null },
    contentSnapshot: { type: String, maxlength: 1000, default: '' },
    status: { type: String, enum: ['open', 'in_review', 'processing', 'resolved', 'dismissed'], default: 'open' },
    processingAt: { type: Date, default: null },
    processingToken: { type: String, default: null, select: false },
    reviewedBy: { type: String, default: null },
    reviewNote: { type: String, maxlength: 500, default: null },
    caseId: { type: Number, default: null },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

reportSchema.index({ guildId: 1, status: 1, createdAt: -1 });
reportSchema.index({ guildId: 1, targetId: 1, createdAt: -1 });
reportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ModerationReportModel = model<ModerationReportRecord>('ModerationReport', reportSchema);

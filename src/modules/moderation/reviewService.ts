import { randomUUID } from 'node:crypto';
import { CaseModel, ModerationAppealModel, ModerationReportModel, type ModerationAppealRecord, type ModerationReportRecord, type ModerationReportReason } from '../../database/models/index.js';

const expiry = (days: number) => new Date(Date.now() + days * 86_400_000);

export async function createReport(input: {
  guildId: string;
  reporterId: string;
  targetId: string;
  channelId: string;
  messageId: string;
  messageUrl: string;
  reason: ModerationReportReason;
  details: string | null;
  contentSnapshot: string;
  retentionDays: number;
}): Promise<{ report: ModerationReportRecord; duplicate: boolean }> {
  const reportKey = `${input.guildId}:${input.reporterId}:${input.messageId}`;
  const reportId = randomUUID();
  const { retentionDays, ...stored } = input;
  const report = await ModerationReportModel.findOneAndUpdate(
    { reportKey },
    { $setOnInsert: { ...stored, reportId, reportKey, status: 'open', processingAt: null, processingToken: null, reviewedBy: null, reviewNote: null, caseId: null, expiresAt: expiry(retentionDays) } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).lean<ModerationReportRecord>();
  return { report, duplicate: report.reportId !== reportId };
}

export async function createAppeal(input: {
  guildId: string;
  caseId: number;
  targetId: string;
  statement: string;
  retentionDays: number;
}): Promise<{ appeal: ModerationAppealRecord; duplicate: boolean }> {
  const existing = await ModerationAppealModel.findOne({ guildId: input.guildId, caseId: input.caseId }).lean<ModerationAppealRecord>();
  if (existing) return { appeal: existing, duplicate: true };
  const appealId = randomUUID();
  try {
    const appeal = await ModerationAppealModel.create({
      appealId,
      guildId: input.guildId,
      caseId: input.caseId,
      targetId: input.targetId,
      statement: input.statement.trim().slice(0, 1000),
      status: 'submitted',
      reviewerId: null,
      reviewerNote: null,
      expiresAt: expiry(input.retentionDays),
    });
    await CaseModel.updateOne({ guildId: input.guildId, caseId: input.caseId }, { $set: { appealId } });
    return { appeal: appeal.toObject(), duplicate: false };
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    const appeal = await ModerationAppealModel.findOne({ guildId: input.guildId, caseId: input.caseId }).lean<ModerationAppealRecord>();
    if (!appeal) throw error;
    return { appeal, duplicate: true };
  }
}

export async function reviewReport(input: {
  guildId: string;
  reportId: string;
  reviewerId: string;
  status: 'open' | 'in_review' | 'resolved' | 'dismissed';
  note?: string | null;
  caseId?: number | null;
}): Promise<ModerationReportRecord | null> {
  return ModerationReportModel.findOneAndUpdate(
    { guildId: input.guildId, reportId: input.reportId, status: { $in: ['open', 'in_review'] } },
    { $set: { status: input.status, processingAt: null, processingToken: null, reviewedBy: input.reviewerId, reviewNote: input.note?.trim().slice(0, 500) || null, ...(input.caseId ? { caseId: input.caseId } : {}) } },
    { returnDocument: 'after' },
  ).lean<ModerationReportRecord>();
}

export async function beginReportAction(guildId: string, reportId: string, reviewerId: string): Promise<ModerationReportRecord | null> {
  return ModerationReportModel.findOneAndUpdate(
    { guildId, reportId, $or: [{ status: { $in: ['open', 'in_review'] } }, { status: 'processing', $or: [{ processingAt: { $lte: new Date(Date.now() - 5 * 60_000) } }, { processingAt: null }] }] },
    { $set: { status: 'processing', processingAt: new Date(), processingToken: randomUUID(), reviewedBy: reviewerId } },
    { returnDocument: 'after' },
  ).select('+processingToken').lean<ModerationReportRecord>();
}

export async function finishReportAction(input: {
  guildId: string;
  reportId: string;
  reviewerId: string;
  processingToken: string;
  status: 'in_review' | 'resolved' | 'dismissed';
  note?: string | null;
  caseId?: number | null;
}): Promise<ModerationReportRecord | null> {
  return ModerationReportModel.findOneAndUpdate(
    { guildId: input.guildId, reportId: input.reportId, status: 'processing', processingToken: input.processingToken },
    { $set: { status: input.status, processingAt: null, processingToken: null, reviewedBy: input.reviewerId, reviewNote: input.note?.trim().slice(0, 500) || null, ...(input.caseId ? { caseId: input.caseId } : {}) } },
    { returnDocument: 'after' },
  ).lean<ModerationReportRecord>();
}

export async function reviewAppeal(input: {
  guildId: string;
  appealId: string;
  reviewerId: string;
  status: 'submitted' | 'reviewing' | 'accepted' | 'denied';
  note?: string | null;
}): Promise<ModerationAppealRecord | null> {
  return ModerationAppealModel.findOneAndUpdate(
    { guildId: input.guildId, appealId: input.appealId, status: { $in: ['submitted', 'reviewing'] } },
    { $set: { status: input.status, reviewerId: input.reviewerId, reviewerNote: input.note?.trim().slice(0, 500) || null } },
    { returnDocument: 'after' },
  ).lean<ModerationAppealRecord>();
}

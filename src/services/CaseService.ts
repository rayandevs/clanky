import { CaseModel, type CaseRecord, type CaseType } from '../database/models/index.js';
import { guilds } from './GuildService.js';

export interface NewCase {
  guildId: string;
  type: CaseType;
  targetId: string;
  targetTag: string;
  moderatorId: string;
  reason: string | null;
  duration?: number | null;
  reportId?: string | null;
  appealId?: string | null;
}

class CaseService {
  async create(input: NewCase): Promise<CaseRecord> {
    const caseId = await guilds.nextCounter(input.guildId, 'cases');
    const doc = await CaseModel.create({ ...input, caseId, duration: input.duration ?? null });
    return doc.toObject();
  }

  async get(guildId: string, caseId: number): Promise<CaseRecord | null> {
    return CaseModel.findOne({ guildId, caseId }).lean<CaseRecord>();
  }

  async list(guildId: string, targetId: string | null, page: number, perPage = 6) {
    const filter = targetId ? { guildId, targetId } : { guildId };
    const [entries, total] = await Promise.all([
      CaseModel.find(filter).sort({ caseId: -1 }).skip(page * perPage).limit(perPage).lean<CaseRecord[]>(),
      CaseModel.countDocuments(filter),
    ]);
    return { entries, total, pages: Math.max(1, Math.ceil(total / perPage)) };
  }

  async setReason(guildId: string, caseId: number, reason: string): Promise<CaseRecord | null> {
    return CaseModel.findOneAndUpdate({ guildId, caseId }, { $set: { reason } }, { returnDocument: 'after' }).lean<CaseRecord>();
  }

  async addNote(guildId: string, caseId: number, moderatorId: string, text: string): Promise<CaseRecord | null> {
    return CaseModel.findOneAndUpdate(
      { guildId, caseId },
      { $push: { notes: { $each: [{ moderatorId, text: text.trim().slice(0, 1000), createdAt: new Date() }], $slice: -50 } } },
      { returnDocument: 'after' },
    ).lean<CaseRecord>();
  }

  async setStatus(guildId: string, caseId: number, status: 'active' | 'voided', note?: { moderatorId: string; text: string }): Promise<CaseRecord | null> {
    return CaseModel.findOneAndUpdate(
      { guildId, caseId },
      { $set: { status }, ...(note ? { $push: { notes: { $each: [{ ...note, text: note.text.trim().slice(0, 1000), createdAt: new Date() }], $slice: -50 } } } : {}) },
      { returnDocument: 'after' },
    ).lean<CaseRecord>();
  }

  async setLogMessage(guildId: string, caseId: number, channelId: string, messageId: string): Promise<void> {
    await CaseModel.updateOne({ guildId, caseId }, { $set: { logChannelId: channelId, logMessageId: messageId } });
  }

  async countWarnings(guildId: string, targetId: string, since?: Date): Promise<number> {
    return CaseModel.countDocuments({ guildId, targetId, type: 'warn', status: { $ne: 'voided' }, ...(since ? { createdAt: { $gte: since } } : {}) });
  }
}

export const cases = new CaseService();

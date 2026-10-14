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

  async setLogMessage(guildId: string, caseId: number, channelId: string, messageId: string): Promise<void> {
    await CaseModel.updateOne({ guildId, caseId }, { $set: { logChannelId: channelId, logMessageId: messageId } });
  }

  async delete(guildId: string, caseId: number): Promise<boolean> {
    const result = await CaseModel.deleteOne({ guildId, caseId });
    return result.deletedCount > 0;
  }

  async countWarnings(guildId: string, targetId: string): Promise<number> {
    return CaseModel.countDocuments({ guildId, targetId, type: 'warn' });
  }
}

export const cases = new CaseService();

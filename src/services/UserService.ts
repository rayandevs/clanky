import type { User } from 'discord.js';
import { version } from '../config/version.js';
import { DashboardSessionModel, GamePlayerModel, MemberModel, ReminderModel, UserModel, type UserRecord } from '../database/models/index.js';
import { UserPreferencesSchema, parseUserPreferences, type UserPreferences } from '../settings/schema.js';
import { TTLCache } from './cache.js';

function normalize(doc: UserRecord): UserRecord {
  return { ...doc, preferences: parseUserPreferences(doc.preferences) };
}

class UserService {
  private readonly cache = new TTLCache<string, UserRecord>(5 * 60_000);

  /** Get a user's record, creating it and syncing their profile when needed. */
  async get(user: User): Promise<UserRecord> {
    const cached = this.cache.get(user.id);
    if (cached && cached.username === user.username && cached.avatar === user.avatar) return cached;

    const doc = await UserModel.findOneAndUpdate(
      { userId: user.id },
      {
        $set: { username: user.username, globalName: user.globalName, avatar: user.avatar },
        // New users start "up to date" so they don't get an update notice.
        $setOnInsert: { lastSeenVersion: version.raw },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).lean<UserRecord>();

    const record = normalize(doc!);
    this.cache.set(user.id, record);
    return record;
  }

  async getById(userId: string): Promise<UserRecord | null> {
    const cached = this.cache.get(userId);
    if (cached) return cached;
    const doc = await UserModel.findOne({ userId }).lean<UserRecord>();
    if (!doc) return null;
    const record = normalize(doc);
    this.cache.set(userId, record);
    return record;
  }

  async preferences(userId: string): Promise<UserPreferences> {
    return (await this.getById(userId))?.preferences ?? UserPreferencesSchema.parse({});
  }

  async updatePreferences(userId: string, patch: Partial<UserPreferences>): Promise<UserPreferences> {
    const current = await this.preferences(userId);
    const next = UserPreferencesSchema.parse({ ...current, ...patch });
    await UserModel.updateOne({ userId }, { $set: { preferences: next } }, { upsert: true });
    this.cache.delete(userId);
    return next;
  }

  async trackCommand(userId: string): Promise<void> {
    await UserModel.updateOne({ userId }, { $inc: { 'stats.commandsUsed': 1 }, $set: { 'stats.lastCommandAt': new Date() } });
  }

  async markVersionSeen(userId: string): Promise<void> {
    await UserModel.updateOne({ userId }, { $set: { lastSeenVersion: version.raw } });
    this.cache.delete(userId);
  }

  /** Removes everything Clanky stores about a user. */
  async deleteAllData(userId: string): Promise<void> {
    await Promise.all([
      UserModel.deleteOne({ userId }),
      MemberModel.deleteMany({ userId }),
      ReminderModel.deleteMany({ userId }),
      GamePlayerModel.deleteOne({ userId }),
      DashboardSessionModel.deleteMany({ userId }),
    ]);
    this.cache.delete(userId);
  }

  invalidate(userId: string): void {
    this.cache.delete(userId);
  }
}

export const users = new UserService();

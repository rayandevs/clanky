import { Schema, model } from 'mongoose';
import { UserPreferencesSchema, type UserPreferences } from '../../settings/schema.js';

export interface UserRecord {
  userId: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  /** Validated by `UserPreferencesSchema` (see settings/schema.ts). */
  preferences: UserPreferences;
  stats: { commandsUsed: number; lastCommandAt: Date | null };
  /** Last bot version the user was told about. */
  lastSeenVersion: string | null;
  flags: { blacklisted: boolean; blacklistReason: string | null };
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserRecord>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    username: { type: String, default: 'unknown' },
    globalName: { type: String, default: null },
    avatar: { type: String, default: null },
    preferences: { type: Schema.Types.Mixed, default: () => UserPreferencesSchema.parse({}) },
    stats: {
      commandsUsed: { type: Number, default: 0 },
      lastCommandAt: { type: Date, default: null },
    },
    lastSeenVersion: { type: String, default: null },
    flags: {
      blacklisted: { type: Boolean, default: false },
      blacklistReason: { type: String, default: null },
    },
  },
  { timestamps: true, minimize: false },
);

export const UserModel = model<UserRecord>('User', userSchema);

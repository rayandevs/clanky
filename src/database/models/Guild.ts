import { Schema, model } from 'mongoose';
import { defaultGuildSettings, type GuildSettings } from '../../settings/schema.js';

export interface GuildRecord {
  guildId: string;
  name: string;
  icon: string | null;
  ownerId: string | null;
  /** Is Clanky currently in this server? */
  active: boolean;
  joinedAt: Date | null;
  leftAt: Date | null;
  /** Validated by `GuildSettingsSchema` (see settings/schema.ts). */
  settings: GuildSettings;
  counters: { cases: number; tickets: number; suggestions: number };
  meta: { lastAnnouncedVersion: string | null; locale: string; suggestionsDigestAt: Date | null };
  createdAt: Date;
  updatedAt: Date;
}

const guildSchema = new Schema<GuildRecord>(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: 'Unknown server' },
    icon: { type: String, default: null },
    ownerId: { type: String, default: null },
    active: { type: Boolean, default: true, index: true },
    joinedAt: { type: Date, default: null },
    leftAt: { type: Date, default: null },
    settings: { type: Schema.Types.Mixed, default: defaultGuildSettings },
    counters: {
      cases: { type: Number, default: 0 },
      tickets: { type: Number, default: 0 },
      suggestions: { type: Number, default: 0 },
    },
    meta: {
      lastAnnouncedVersion: { type: String, default: null },
      locale: { type: String, default: 'en-US' },
      suggestionsDigestAt: { type: Date, default: null },
    },
  },
  { timestamps: true, minimize: false },
);

export const GuildModel = model<GuildRecord>('Guild', guildSchema);

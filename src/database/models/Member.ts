import { Schema, model } from 'mongoose';

/** Per-server data for a user (leveling). */
export interface MemberRecord {
  guildId: string;
  userId: string;
  xp: number;
  level: number;
  messages: number;
  xpMessages: number;
  levelProgress: number;
  curvePreset: 'relaxed' | 'classic' | 'challenging';
  messageTrackingStartedAt: Date;
  lastXpAt: Date | null;
}

const memberSchema = new Schema<MemberRecord>(
  {
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 0 },
    messages: { type: Number, default: 0 },
    xpMessages: { type: Number, default: 0 },
    levelProgress: { type: Number, default: 0, min: 0, max: 1 },
    curvePreset: { type: String, enum: ['relaxed', 'classic', 'challenging'], default: 'classic' },
    messageTrackingStartedAt: { type: Date, default: Date.now },
    lastXpAt: { type: Date, default: null },
  },
  { timestamps: true },
);

memberSchema.index({ guildId: 1, userId: 1 }, { unique: true });
memberSchema.index({ guildId: 1, xp: -1 });
memberSchema.index({ guildId: 1, messages: -1 });
memberSchema.index({ guildId: 1, level: -1, levelProgress: -1, xp: -1 });

export const MemberModel = model<MemberRecord>('Member', memberSchema);

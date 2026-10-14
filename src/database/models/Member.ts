import { Schema, model } from 'mongoose';

/** Per-server data for a user (leveling). */
export interface MemberRecord {
  guildId: string;
  userId: string;
  xp: number;
  level: number;
  messages: number;
  lastXpAt: Date | null;
}

const memberSchema = new Schema<MemberRecord>(
  {
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 0 },
    messages: { type: Number, default: 0 },
    lastXpAt: { type: Date, default: null },
  },
  { timestamps: true },
);

memberSchema.index({ guildId: 1, userId: 1 }, { unique: true });
memberSchema.index({ guildId: 1, xp: -1 });

export const MemberModel = model<MemberRecord>('Member', memberSchema);

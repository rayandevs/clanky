import { Schema, model } from 'mongoose';

/** UTC daily aggregates; no message content is ever stored. */
export interface LevelActivityRecord {
  guildId: string;
  userId: string;
  day: string;
  messages: number;
  xp: number;
}

const levelActivitySchema = new Schema<LevelActivityRecord>(
  {
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    day: { type: String, required: true },
    messages: { type: Number, default: 0 },
    xp: { type: Number, default: 0 },
  },
  { timestamps: true },
);

levelActivitySchema.index({ guildId: 1, userId: 1, day: 1 }, { unique: true });
levelActivitySchema.index({ guildId: 1, day: 1 });

export const LevelActivityModel = model<LevelActivityRecord>('LevelActivity', levelActivitySchema);

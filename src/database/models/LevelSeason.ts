import { Schema, model } from 'mongoose';

export interface LevelSeasonRecord {
  guildId: string;
  seasonId: string;
  name: string;
  active: boolean;
  startedAt: Date;
  endedAt: Date | null;
  rewardRoleId: string | null;
  rewardTopCount: number;
  createdBy: string;
}

const levelSeasonSchema = new Schema<LevelSeasonRecord>(
  {
    guildId: { type: String, required: true },
    seasonId: { type: String, required: true },
    name: { type: String, required: true, maxlength: 80 },
    active: { type: Boolean, default: true },
    startedAt: { type: Date, required: true, default: Date.now },
    endedAt: { type: Date, default: null },
    rewardRoleId: { type: String, default: null },
    rewardTopCount: { type: Number, default: 3, min: 1, max: 100 },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);
levelSeasonSchema.index({ guildId: 1, seasonId: 1 }, { unique: true });
levelSeasonSchema.index({ guildId: 1, active: 1 }, { unique: true, partialFilterExpression: { active: true } });
levelSeasonSchema.index({ guildId: 1, startedAt: -1 });

export interface LevelSeasonScoreRecord {
  guildId: string;
  seasonId: string;
  userId: string;
  xp: number;
}

const levelSeasonScoreSchema = new Schema<LevelSeasonScoreRecord>(
  {
    guildId: { type: String, required: true },
    seasonId: { type: String, required: true },
    userId: { type: String, required: true },
    xp: { type: Number, default: 0 },
  },
  { timestamps: true },
);
levelSeasonScoreSchema.index({ guildId: 1, seasonId: 1, userId: 1 }, { unique: true });
levelSeasonScoreSchema.index({ guildId: 1, seasonId: 1, xp: -1 });

export const LevelSeasonModel = model<LevelSeasonRecord>('LevelSeason', levelSeasonSchema);
export const LevelSeasonScoreModel = model<LevelSeasonScoreRecord>('LevelSeasonScore', levelSeasonScoreSchema);

import { Schema, model } from 'mongoose';

export interface RaidChannelSnapshot {
  channelId: string;
  previousSlowmode: number;
  appliedSlowmode: number;
}

export interface RaidResponseRecord {
  guildId: string;
  startedBy: string;
  startedAt: Date;
  expiresAt: Date;
  status: 'active' | 'ended' | 'expired';
  channels: RaidChannelSnapshot[];
  endedAt: Date | null;
  endedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const snapshotSchema = new Schema<RaidChannelSnapshot>(
  {
    channelId: { type: String, required: true },
    previousSlowmode: { type: Number, min: 0, max: 21_600, required: true },
    appliedSlowmode: { type: Number, min: 0, max: 21_600, required: true },
  },
  { _id: false },
);

const raidSchema = new Schema<RaidResponseRecord>(
  {
    guildId: { type: String, required: true, unique: true },
    startedBy: { type: String, required: true },
    startedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    status: { type: String, enum: ['active', 'ended', 'expired'], default: 'active' },
    channels: { type: [snapshotSchema], default: [] },
    endedAt: { type: Date, default: null },
    endedBy: { type: String, default: null },
  },
  { timestamps: true },
);

raidSchema.index({ status:  1, expiresAt: 1 });

export const RaidResponseModel = model<RaidResponseRecord>('RaidResponse', raidSchema);

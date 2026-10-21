import { Schema, model } from 'mongoose';

export type ModerationAppealStatus = 'submitted' | 'reviewing' | 'accepted' | 'denied';

export interface ModerationAppealRecord {
  appealId: string;
  guildId: string;
  caseId: number;
  targetId: string;
  statement: string;
  status: ModerationAppealStatus;
  reviewerId: string | null;
  reviewerNote: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const appealSchema = new Schema<ModerationAppealRecord>(
  {
    appealId: { type: String, required: true, unique: true },
    guildId: { type: String, required: true },
    caseId: { type: Number, required: true },
    targetId: { type: String, required: true },
    statement: { type: String, required: true, maxlength: 1000 },
    status: { type: String, enum: ['submitted', 'reviewing', 'accepted', 'denied'], default: 'submitted' },
    reviewerId: { type: String, default: null },
    reviewerNote: { type: String, maxlength: 500, default: null },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

appealSchema.index({ guildId: 1, caseId: 1 }, { unique: true });
appealSchema.index({ guildId: 1, status: 1, createdAt: -1 });
appealSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ModerationAppealModel = model<ModerationAppealRecord>('ModerationAppeal', appealSchema);

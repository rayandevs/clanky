import { Schema, model } from 'mongoose';

/**
 * History of every settings change — made in Discord or (later) on the
 * dashboard. Lets admins see who changed what.
 */
export interface SettingsAuditRecord {
  guildId: string;
  actorId: string;
  source: 'bot' | 'dashboard' | 'system';
  section: string;
  before: unknown;
  after: unknown;
  createdAt: Date;
}

const auditSchema = new Schema<SettingsAuditRecord>(
  {
    guildId: { type: String, required: true, index: true },
    actorId: { type: String, required: true },
    source: { type: String, enum: ['bot', 'dashboard', 'system'], default: 'bot' },
    section: { type: String, required: true },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const SettingsAuditModel = model<SettingsAuditRecord>('SettingsAudit', auditSchema);

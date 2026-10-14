import { Schema, model } from 'mongoose';

export interface RolePanelRecord {
  guildId: string;
  panelId: string;
  channelId: string;
  messageId: string | null;
  title: string;
  description: string;
  /** "multiple": pick any; "single": only one role at a time. */
  mode: 'multiple' | 'single';
  roleIds: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const rolePanelSchema = new Schema<RolePanelRecord>(
  {
    guildId: { type: String, required: true, index: true },
    panelId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    messageId: { type: String, default: null },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    mode: { type: String, enum: ['multiple', 'single'], default: 'multiple' },
    roleIds: { type: [String], default: [] },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

export const RolePanelModel = model<RolePanelRecord>('RolePanel', rolePanelSchema);

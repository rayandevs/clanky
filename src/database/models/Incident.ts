import { Schema, model } from 'mongoose';

export interface IncidentNoteRecord {
  actorId: string;
  action: 'note' | 'status';
  status?: 'open' | 'investigating' | 'resolved' | 'false_alarm';
  text: string;
  createdAt: Date;
}

export interface IncidentRecord {
  incidentId: string;
  incidentKey: string;
  guildId: string;
  ruleId: string;
  title: string;
  summary: string;
  status: 'open' | 'investigating' | 'resolved' | 'false_alarm';
  severity: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  firstEventAt: Date;
  lastEventAt: Date;
  eventCount: number;
  affectedUserIds: string[];
  affectedChannelIds: string[];
  affectedRoleIds: string[];
  actorIds: string[];
  notes: IncidentNoteRecord[];
  resolvedAt: Date | null;
  lastAlertAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const incidentNoteSchema = new Schema<IncidentNoteRecord>(
  {
    actorId: { type: String, required: true },
    action: { type: String, enum: ['note', 'status'], required: true },
    status: { type: String, enum: ['open', 'investigating', 'resolved', 'false_alarm'], default: null },
    text: { type: String, required: true, maxlength: 1000 },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const incidentSchema = new Schema<IncidentRecord>(
  {
    incidentId: { type: String, required: true, unique: true },
    incidentKey: { type: String, required: true, unique: true },
    guildId: { type: String, required: true },
    ruleId: { type: String, required: true },
    title: { type: String, required: true, maxlength: 160 },
    summary: { type: String, required: true, maxlength: 1000 },
    status: { type: String, enum: ['open', 'investigating', 'resolved', 'false_alarm'], default: 'open' },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    riskScore: { type: Number, min: 0, max: 100, default: 0 },
    firstEventAt: { type: Date, required: true },
    lastEventAt: { type: Date, required: true },
    eventCount: { type: Number, min: 1, default: 1 },
    affectedUserIds: { type: [String], default: [] },
    affectedChannelIds: { type: [String], default: [] },
    affectedRoleIds: { type: [String], default: [] },
    actorIds: { type: [String], default: [] },
    notes: { type: [incidentNoteSchema], default: [] },
    resolvedAt: { type: Date, default: null },
    lastAlertAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true, minimize: false },
);

incidentSchema.index({ guildId: 1, status: 1, lastEventAt: -1 });
incidentSchema.index({ guildId: 1, ruleId: 1, firstEventAt: -1 });
incidentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const IncidentModel = model<IncidentRecord>('Incident', incidentSchema);

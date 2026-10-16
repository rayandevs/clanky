import { Schema, model } from 'mongoose';
import type { TicketAnswer } from './Ticket.js';

export interface TicketTranscriptRecord {
  guildId: string;
  ticketId: number;
  channelId: string;
  openerId: string;
  openerDisplayName: string;
  openerAvatarUrl: string | null;
  panelId: string;
  panelTitle: string;
  categoryId: string | null;
  categoryLabel: string | null;
  answers: TicketAnswer[];
  staffRoleIds: string[];
  claimedBy: string | null;
  claimedByName: string | null;
  closedBy: string;
  closedByName: string | null;
  closeReason: string | null;
  createdAt: Date;
  closedAt: Date;
  messageCount: number;
  truncated: boolean;
  expiresAt: Date | null;
}

export interface TranscriptAttachment {
  name: string;
  url: string;
  contentType: string | null;
  size: number;
  archiveId: string | null;
}

export interface TranscriptEmbed {
  title: string | null;
  description: string | null;
  fields: Array<{ name: string; value: string }>;
}

export interface TicketTranscriptMessageRecord {
  guildId: string;
  ticketId: number;
  messageId: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  isBot: boolean;
  content: string;
  embeds: TranscriptEmbed[];
  attachments: TranscriptAttachment[];
  createdAt: Date;
  expiresAt: Date | null;
}

const answerSchema = new Schema<TicketAnswer>(
  {
    questionId: { type: String, required: true },
    label: { type: String, required: true },
    answer: { type: String, required: true },
  },
  { _id: false },
);

const transcriptSchema = new Schema<TicketTranscriptRecord>(
  {
    guildId: { type: String, required: true },
    ticketId: { type: Number, required: true },
    channelId: { type: String, required: true },
    openerId: { type: String, required: true },
    openerDisplayName: { type: String, required: true },
    openerAvatarUrl: { type: String, default: null },
    panelId: { type: String, required: true },
    panelTitle: { type: String, required: true },
    categoryId: { type: String, default: null },
    categoryLabel: { type: String, default: null },
    answers: { type: [answerSchema], default: [] },
    staffRoleIds: { type: [String], default: [] },
    claimedBy: { type: String, default: null },
    claimedByName: { type: String, default: null },
    closedBy: { type: String, required: true },
    closedByName: { type: String, default: null },
    closeReason: { type: String, default: null },
    createdAt: { type: Date, required: true },
    closedAt: { type: Date, required: true },
    messageCount: { type: Number, required: true },
    truncated: { type: Boolean, default: false },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: false },
);
transcriptSchema.index({ guildId: 1, ticketId: 1 }, { unique: true });
transcriptSchema.index({ guildId: 1, closedAt: -1 });
transcriptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const embedSchema = new Schema<TranscriptEmbed>(
  {
    title: { type: String, default: null },
    description: { type: String, default: null },
    fields: { type: [{ name: String, value: String }], default: [] },
  },
  { _id: false },
);
const attachmentSchema = new Schema<TranscriptAttachment>(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
    contentType: { type: String, default: null },
    size: { type: Number, required: true },
    archiveId: { type: String, default: null },
  },
  { _id: false },
);
const messageSchema = new Schema<TicketTranscriptMessageRecord>(
  {
    guildId: { type: String, required: true },
    ticketId: { type: Number, required: true },
    messageId: { type: String, required: true },
    authorId: { type: String, required: true },
    authorName: { type: String, required: true },
    authorAvatarUrl: { type: String, default: null },
    isBot: { type: Boolean, default: false },
    content: { type: String, default: '' },
    embeds: { type: [embedSchema], default: [] },
    attachments: { type: [attachmentSchema], default: [] },
    createdAt: { type: Date, required: true },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: false },
);
messageSchema.index({ guildId: 1, ticketId: 1, createdAt: 1, messageId: 1 });
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const TicketTranscriptModel = model<TicketTranscriptRecord>('TicketTranscript', transcriptSchema);
export const TicketTranscriptMessageModel = model<TicketTranscriptMessageRecord>('TicketTranscriptMessage', messageSchema);

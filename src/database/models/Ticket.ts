import { Schema, model } from 'mongoose';

export interface TicketAnswer {
  questionId: string;
  label: string;
  answer: string;
}

export interface TicketRecord {
  guildId: string;
  ticketId: number;
  channelId: string;
  openerId: string;
  category: string | null;
  topic: string;
  panelId?: string;
  panelTitle?: string;
  answers?: TicketAnswer[];
  /** Resolved routing snapshot, so later settings edits don't reroute an open ticket. */
  staffRoleIds?: string[];
  logChannelId?: string | null;
  status: 'open' | 'closed';
  claimedBy: string | null;
  closedBy: string | null;
  closeReason: string | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ticketSchema = new Schema<TicketRecord>(
  {
    guildId: { type: String, required: true },
    ticketId: { type: Number, required: true },
    channelId: { type: String, required: true, index: true },
    openerId: { type: String, required: true },
    category: { type: String, default: null },
    topic: { type: String, default: '' },
    panelId: { type: String, default: 'general' },
    panelTitle: { type: String, default: 'Need help?' },
    answers: {
      type: [{ questionId: String, label: String, answer: String }],
      default: [],
    },
    staffRoleIds: { type: [String], default: undefined },
    logChannelId: { type: String, default: null },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    claimedBy: { type: String, default: null },
    closedBy: { type: String, default: null },
    closeReason: { type: String, default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

ticketSchema.index({ guildId: 1, ticketId: 1 }, { unique: true });
ticketSchema.index({ guildId: 1, openerId: 1, status: 1 });

export const TicketModel = model<TicketRecord>('Ticket', ticketSchema);

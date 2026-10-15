import { Schema, model } from 'mongoose';

export interface TicketPanelMessageRecord {
  guildId: string;
  panelId: string;
  channelId: string;
  messageId: string;
  createdAt: Date;
  updatedAt: Date;
}

const ticketPanelMessageSchema = new Schema<TicketPanelMessageRecord>(
  {
    guildId: { type: String, required: true },
    panelId: { type: String, required: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true },
  },
  { timestamps: true },
);

ticketPanelMessageSchema.index({ guildId: 1, panelId: 1, channelId: 1 }, { unique: true });

export const TicketPanelMessageModel = model<TicketPanelMessageRecord>('TicketPanelMessage', ticketPanelMessageSchema);

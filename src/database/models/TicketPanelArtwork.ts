import { Schema, model } from 'mongoose';

export interface TicketPanelArtworkRecord {
  guildId: string;
  panelId: string;
  contentType: 'image/png';
  data: Buffer;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const ticketPanelArtworkSchema = new Schema<TicketPanelArtworkRecord>(
  {
    guildId: { type: String, required: true },
    panelId: { type: String, required: true },
    contentType: { type: String, enum: ['image/png'], default: 'image/png' },
    data: { type: Schema.Types.Mixed, required: true },
    uploadedBy: { type: String, required: true },
  },
  { timestamps: true },
);

ticketPanelArtworkSchema.index({ guildId: 1, panelId: 1 }, { unique: true });

export const TicketPanelArtworkModel = model<TicketPanelArtworkRecord>('TicketPanelArtwork', ticketPanelArtworkSchema);

import { Schema, model } from 'mongoose';

export type WelcomeArtworkEvent = 'join' | 'leave';

export interface WelcomeArtworkRecord {
  guildId: string;
  event: WelcomeArtworkEvent;
  contentType: 'image/png';
  data: Buffer;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const welcomeArtworkSchema = new Schema<WelcomeArtworkRecord>(
  {
    guildId: { type: String, required: true },
    event: { type: String, enum: ['join', 'leave'], required: true },
    contentType: { type: String, enum: ['image/png'], default: 'image/png' },
    data: { type: Schema.Types.Mixed, required: true },
    uploadedBy: { type: String, required: true },
  },
  { timestamps: true },
);

welcomeArtworkSchema.index({ guildId: 1, event: 1 }, { unique: true });

export const WelcomeArtworkModel = model<WelcomeArtworkRecord>('WelcomeArtwork', welcomeArtworkSchema);

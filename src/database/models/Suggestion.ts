import { Schema, model } from 'mongoose';

export type SuggestionStatus = 'pending' | 'approved' | 'denied' | 'implemented';

export interface SuggestionRecord {
  guildId: string;
  suggestionId: number;
  authorId: string;
  title: string;
  content: string;
  status: SuggestionStatus;
  upvotes: string[];
  downvotes: string[];
  channelId: string;
  messageId: string | null;
  threadId: string | null;
  reviewerId: string | null;
  reviewNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const suggestionSchema = new Schema<SuggestionRecord>(
  {
    guildId: { type: String, required: true },
    suggestionId: { type: Number, required: true },
    authorId: { type: String, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'denied', 'implemented'], default: 'pending' },
    upvotes: { type: [String], default: [] },
    downvotes: { type: [String], default: [] },
    channelId: { type: String, required: true },
    messageId: { type: String, default: null },
    threadId: { type: String, default: null },
    reviewerId: { type: String, default: null },
    reviewNote: { type: String, default: null },
  },
  { timestamps: true },
);

suggestionSchema.index({ guildId: 1, suggestionId: 1 }, { unique: true });

export const SuggestionModel = model<SuggestionRecord>('Suggestion', suggestionSchema);

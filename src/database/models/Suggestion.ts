import { Schema, model } from 'mongoose';

export type SuggestionStatus = 'pending' | 'under_review' | 'planned' | 'in_progress' | 'approved' | 'denied' | 'implemented';
export type SuggestionPostStatus = 'queued' | 'posting' | 'posted' | 'failed';

export interface SuggestionReviewEvent {
  status: SuggestionStatus;
  note: string | null;
  reviewerId: string;
  changedAt: Date;
}

export interface SuggestionRecord {
  guildId: string;
  suggestionId: number;
  authorId: string;
  title: string;
  content: string;
  category: string | null;
  /** Snapshot: a later settings change must not reveal an anonymous post. */
  anonymous?: boolean;
  status: SuggestionStatus;
  upvotes: string[];
  downvotes: string[];
  channelId: string;
  messageId: string | null;
  threadId: string | null;
  reviewerId: string | null;
  reviewNote: string | null;
  reviewHistory: SuggestionReviewEvent[];
  postStatus: SuggestionPostStatus;
  postError: string | null;
  postAttemptedAt: Date | null;
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
    category: { type: String, default: null },
    anonymous: { type: Boolean, default: false },
    status: { type: String, enum: ['pending', 'under_review', 'planned', 'in_progress', 'approved', 'denied', 'implemented'], default: 'pending' },
    upvotes: { type: [String], default: [] },
    downvotes: { type: [String], default: [] },
    channelId: { type: String, required: true },
    messageId: { type: String, default: null },
    threadId: { type: String, default: null },
    reviewerId: { type: String, default: null },
    reviewNote: { type: String, default: null },
    reviewHistory: [{ status: { type: String, enum: ['pending', 'under_review', 'planned', 'in_progress', 'approved', 'denied', 'implemented'], required: true }, note: { type: String, default: null }, reviewerId: { type: String, required: true }, changedAt: { type: Date, default: Date.now } }],
    postStatus: { type: String, enum: ['queued', 'posting', 'posted', 'failed'], default: 'queued' },
    postError: { type: String, default: null },
    postAttemptedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

suggestionSchema.index({ guildId: 1, suggestionId: 1 }, { unique: true });
suggestionSchema.index({ guildId: 1, status: 1, createdAt: -1 });
suggestionSchema.index({ guildId: 1, authorId: 1, createdAt: -1 });

export const SuggestionModel = model<SuggestionRecord>('Suggestion', suggestionSchema);

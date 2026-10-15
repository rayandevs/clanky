import { Schema, model } from 'mongoose';

/**
 * A dashboard login. The browser only holds a random session ID in a
 * cookie; we store its SHA-256 hash here. Discord tokens are encrypted.
 */
export interface DashboardSessionRecord {
  /** sha256(session id) */
  sid: string;
  userId: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  /** AES-256-GCM encrypted OAuth2 tokens */
  tokens: string;
  tokenExpiresAt: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<DashboardSessionRecord>(
  {
    sid: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    username: { type: String, default: 'unknown' },
    globalName: { type: String, default: null },
    avatar: { type: String, default: null },
    tokens: { type: String, required: true },
    tokenExpiresAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const DashboardSessionModel = model<DashboardSessionRecord>('DashboardSession', sessionSchema);

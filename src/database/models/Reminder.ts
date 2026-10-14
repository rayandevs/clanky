import { Schema, model } from 'mongoose';

export interface ReminderRecord {
  userId: string;
  guildId: string | null;
  /** Channel to deliver to when the user prefers channel delivery. */
  channelId: string | null;
  content: string;
  dueAt: Date;
  delivered: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const reminderSchema = new Schema<ReminderRecord>(
  {
    userId: { type: String, required: true, index: true },
    guildId: { type: String, default: null },
    channelId: { type: String, default: null },
    content: { type: String, required: true },
    dueAt: { type: Date, required: true },
    delivered: { type: Boolean, default: false },
  },
  { timestamps: true },
);

reminderSchema.index({ delivered: 1, dueAt: 1 });

export const ReminderModel = model<ReminderRecord>('Reminder', reminderSchema);

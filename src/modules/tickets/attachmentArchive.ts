import type { Message } from 'discord.js';
import mongoose from 'mongoose';
import { createLogger } from '../../core/logger.js';

const log = createLogger('tickets');
const BUCKET_NAME = 'ticketTranscriptAttachments';
export const MAX_TRANSCRIPT_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export const MAX_TRANSCRIPT_ATTACHMENT_TOTAL_BYTES = 100 * 1024 * 1024;
export const MAX_TRANSCRIPT_ATTACHMENT_COUNT = 500;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const DELETE_BATCH_SIZE = 100;
const ALLOWED_HOSTS = new Set(['cdn.discordapp.com', 'media.discordapp.net']);

export class TicketAttachmentArchiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TicketAttachmentArchiveError';
  }
}

function getDb() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB is not connected; ticket attachments cannot be archived.');
  return db;
}

function getBucket() {
  return new mongoose.mongo.GridFSBucket(getDb(), { bucketName: BUCKET_NAME });
}

export async function archiveMessageAttachments(
  messages: Message[],
  guildId: string,
  ticketId: number,
  expiresAt: Date | null,
): Promise<Map<string, string>> {
  const references = new Map<string, string>();
  const createdIds: mongoose.mongo.ObjectId[] = [];
  let totalBytes = 0;
  let count = 0;
  const bucket = getBucket();

  try {
    for (const message of messages) {
      let index = 0;
      for (const attachment of message.attachments.values()) {
        const currentIndex = index++;
        count += 1;
        if (count > MAX_TRANSCRIPT_ATTACHMENT_COUNT) {
          throw new TicketAttachmentArchiveError(`This ticket has more than ${MAX_TRANSCRIPT_ATTACHMENT_COUNT} attachments. Remove some attachments before closing so every file can be archived.`);
        }
        if (!Number.isSafeInteger(attachment.size) || attachment.size < 0 || attachment.size > MAX_TRANSCRIPT_ATTACHMENT_BYTES) {
          throw new TicketAttachmentArchiveError('One or more attachments exceed the 25 MiB per-file transcript archive limit.');
        }
        totalBytes += attachment.size;
        if (totalBytes > MAX_TRANSCRIPT_ATTACHMENT_TOTAL_BYTES) {
          throw new TicketAttachmentArchiveError('This ticket exceeds the 100 MiB total transcript attachment archive limit. Remove some attachments before closing.');
        }

        let url: URL;
        try {
          url = new URL(attachment.url);
        } catch {
          throw new TicketAttachmentArchiveError('One or more attachments have an invalid source URL and could not be archived.');
        }
        if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) {
          throw new TicketAttachmentArchiveError('One or more attachments are not hosted on an approved Discord attachment domain.');
        }

        const response = await fetch(url, { signal: AbortSignal.timeout(20_000), redirect: 'error' }).catch(() => null);
        if (response?.status === 404) {
          throw new TicketAttachmentArchiveError('One or more attachments are no longer available from Discord. The ticket is still open; remove the affected message or file, then close it again.');
        }
        if (!response?.ok || !response.body) {
          throw new TicketAttachmentArchiveError('Discord could not provide one or more attachments for archiving. The ticket is still open; try again shortly.');
        }
        const contentLength = Number(response.headers.get('content-length') ?? 0);
        if (contentLength > MAX_TRANSCRIPT_ATTACHMENT_BYTES) {
          await response.body.cancel().catch(() => null);
          throw new TicketAttachmentArchiveError('One or more attachments exceed the 25 MiB per-file transcript archive limit.');
        }

        const chunks: Buffer[] = [];
        let downloadedBytes = 0;
        const reader = response.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = Buffer.from(value);
            downloadedBytes += chunk.length;
            if (downloadedBytes > MAX_TRANSCRIPT_ATTACHMENT_BYTES || totalBytes - attachment.size + downloadedBytes > MAX_TRANSCRIPT_ATTACHMENT_TOTAL_BYTES) {
              await reader.cancel().catch(() => null);
              throw new TicketAttachmentArchiveError('One or more attachments exceed the transcript archive size limits.');
            }
            chunks.push(chunk);
          }
        } finally {
          reader.releaseLock();
        }
        const bytes = Buffer.concat(chunks, downloadedBytes);
        totalBytes = totalBytes - attachment.size + bytes.length;
        if (bytes.length === 0) throw new TicketAttachmentArchiveError('One or more attachments were empty or unavailable and could not be archived.');

        const fileName = attachment.name.replace(/[\r\n\\/\0]/g, '_').slice(0, 180) || 'ticket-attachment';
        const contentType = attachment.contentType?.split(';')[0]?.trim().toLowerCase() || 'application/octet-stream';
        const stream = bucket.openUploadStream(fileName, {
          metadata: { guildId, ticketId, messageId: message.id, index: currentIndex, contentType, expiresAt },
        });
        const id = stream.id as mongoose.mongo.ObjectId;
        try {
          await new Promise<void>((resolve, reject) => {
            stream.once('error', reject);
            stream.once('finish', resolve);
            stream.end(bytes);
          });
        } catch (error) {
          await stream.abort().catch((abortError) => log.warn('Could not abort a partial ticket attachment archive', abortError));
          throw error;
        }
        createdIds.push(id);
        references.set(`${message.id}:${currentIndex}`, id.toString());
      }
    }
    return references;
  } catch (error) {
    await Promise.all(createdIds.map((id) => bucket.delete(id).catch((cleanupError) => log.warn('Could not remove a partial ticket attachment archive', cleanupError))));
    throw error;
  }
}

export async function deleteArchivedTranscriptAttachments(ids: string[]): Promise<void> {
  const bucket = getBucket();
  await Promise.all(ids.map(async (id) => {
    if (!mongoose.mongo.ObjectId.isValid(id)) return;
    await bucket.delete(new mongoose.mongo.ObjectId(id)).catch((error) => log.warn('Could not delete a ticket attachment archive', error));
  }));
}

export async function readArchivedTranscriptAttachment(id: string): Promise<Buffer | null> {
  if (!mongoose.mongo.ObjectId.isValid(id)) return null;
  const stream = getBucket().openDownloadStream(new mongoose.mongo.ObjectId(id));
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const value of stream as AsyncIterable<Buffer | Uint8Array>) {
      const chunk = Buffer.from(value);
      size += chunk.length;
      if (size > MAX_TRANSCRIPT_ATTACHMENT_BYTES) {
        stream.destroy();
        throw new Error('Archived transcript attachment exceeds the expected size limit.');
      }
      chunks.push(chunk);
    }
  } catch (error) {
    if ((error as { code?: number }).code === 0 || (error as { code?: string }).code === 'ENOENT') return null;
    throw error;
  }
  return Buffer.concat(chunks, size);
}

let cleanupTimer: NodeJS.Timeout | null = null;
let cleanupRunning = false;

export function startTranscriptAttachmentCleanup(): () => void {
  if (cleanupTimer) return () => undefined;
  const cleanup = async () => {
    if (cleanupRunning || !mongoose.connection.db) return;
    cleanupRunning = true;
    try {
      const files = getDb().collection(`${BUCKET_NAME}.files`);
      await files.createIndex({ 'metadata.expiresAt': 1 });
      const bucket = getBucket();
      while (true) {
        const expired = await files
          .find({ 'metadata.expiresAt': { $type: 'date', $lte: new Date() } }, { projection: { _id: 1 } })
          .limit(DELETE_BATCH_SIZE)
          .toArray();
        if (!expired.length) break;
        let failed = false;
        for (const file of expired) {
          try {
            await bucket.delete(file._id as mongoose.mongo.ObjectId);
          } catch (error) {
            failed = true;
            log.warn('Could not delete an expired ticket attachment archive', error);
          }
        }
        if (failed) break;
      }
    } catch (error) {
      log.warn('Could not clean up expired ticket attachment archives', error);
    } finally {
      cleanupRunning = false;
    }
  };
  void cleanup();
  cleanupTimer = setInterval(() => void cleanup(), CLEANUP_INTERVAL_MS);
  cleanupTimer.unref();
  return () => {
    if (cleanupTimer) clearInterval(cleanupTimer);
    cleanupTimer = null;
  };
}

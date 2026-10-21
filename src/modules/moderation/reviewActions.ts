import type { Guild } from 'discord.js';

export type ReportedMessageDeletion =
  | { status: 'deleted' }
  | { status: 'missing' }
  | { status: 'failed'; message: string };

export async function deleteReportedMessage(guild: Guild, channelId: string, messageId: string): Promise<ReportedMessageDeletion> {
  const channel = guild.channels.cache.get(channelId);
  if (!channel?.isTextBased()) return { status: 'failed', message: "I can't access the channel for that report. Check the channel permissions and keep the report open for follow-up." };
  try {
    await channel.messages.delete(messageId);
    return { status: 'deleted' };
  } catch (error) {
    const code = (error as { code?: unknown; rawError?: { code?: unknown } })?.code ?? (error as { rawError?: { code?: unknown } })?.rawError?.code;
    if (code === 10008 || code === '10008') return { status: 'missing' };
    if (code === 50013 || code === '50013') return { status: 'failed', message: "I don't have permission to delete that message. Check that I can manage messages in its channel." };
    return { status: 'failed', message: "I couldn't delete that message. The report remains open for follow-up." };
  }
}

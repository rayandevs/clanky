import { DiscordAPIError, type TextChannel } from 'discord.js';
import { TicketPanelMessageModel, type TicketPanelMessageRecord } from '../../database/models/index.js';
import type { GuildSettings, TicketPanelSetting } from '../../settings/schema.js';
import { v2 } from '../../ui/components.js';
import { ticketPanel } from './render.js';

export async function listTicketPanelMessages(guildId: string): Promise<TicketPanelMessageRecord[]> {
  return TicketPanelMessageModel.find({ guildId }).sort({ updatedAt: -1 }).lean<TicketPanelMessageRecord[]>();
}

/** Updates the known message in place; if no live message exists, posts and tracks one. */
export async function publishTicketPanel(
  channel: TextChannel,
  settings: GuildSettings,
  panelSettings: TicketPanelSetting,
  mode: 'publish' | 'update' = 'publish',
): Promise<'posted' | 'updated' | 'missing'> {
  const filter = { guildId: channel.guild.id, panelId: panelSettings.id, channelId: channel.id };
  const record = await TicketPanelMessageModel.findOne(filter).lean<TicketPanelMessageRecord>();
  if (record) {
    let message;
    try {
      message = await channel.messages.fetch(record.messageId);
    } catch (error) {
      if (!(error instanceof DiscordAPIError) || error.code !== 10008) throw error;
      await TicketPanelMessageModel.deleteOne(filter);
      if (mode === 'update') return 'missing';
    }
    if (message) {
      await message.edit(v2(ticketPanel(settings, panelSettings)));
      await TicketPanelMessageModel.updateOne(filter, { $set: { messageId: message.id } });
      return 'updated';
    }
  } else if (mode === 'update') {
    return 'missing';
  }

  const message = await channel.send(v2(ticketPanel(settings, panelSettings)));
  await TicketPanelMessageModel.findOneAndUpdate(filter, { $set: { messageId: message.id } }, { upsert: true, returnDocument: 'after' });
  return 'posted';
}

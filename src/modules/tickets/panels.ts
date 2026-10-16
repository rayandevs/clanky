import { AttachmentBuilder, DiscordAPIError, type TextChannel } from 'discord.js';
import { TicketPanelArtworkModel, TicketPanelMessageModel, type TicketPanelMessageRecord } from '../../database/models/index.js';
import { renderTicketPanelCard } from '../../render/ticketCards.js';
import type { GuildSettings, TicketPanelSetting } from '../../settings/schema.js';
import { v2 } from '../../ui/components.js';
import { ticketPanel } from './render.js';

export async function listTicketPanelMessages(guildId: string): Promise<TicketPanelMessageRecord[]> {
  return TicketPanelMessageModel.find({ guildId }).sort({ updatedAt: -1 }).lean<TicketPanelMessageRecord[]>();
}

async function panelArtwork(guildId: string, settings: GuildSettings, panel: TicketPanelSetting): Promise<Buffer | null> {
  if (panel.artwork.mode === 'none') return null;
  if (panel.artwork.mode === 'custom') {
    const asset = await TicketPanelArtworkModel.findOne({ guildId, panelId: panel.id }).lean();
    return asset ? Buffer.from(asset.data) : null;
  }
  return renderTicketPanelCard(settings.general.accentColor, panel.artwork.template);
}

/** The bot preview, bot publish command, and dashboard publisher share this exact payload. */
export async function ticketPanelPayload(settings: GuildSettings, panelSettings: TicketPanelSetting, ephemeral = false, guildId?: string) {
  const artwork = guildId ? await panelArtwork(guildId, settings, panelSettings) : panelSettings.artwork.mode === 'template'
    ? await renderTicketPanelCard(settings.general.accentColor, panelSettings.artwork.template)
    : null;
  const fileName = 'ticket-panel.png';
  return {
    ...v2(ticketPanel(settings, panelSettings, artwork ? `attachment://${fileName}` : undefined), { ephemeral }),
    ...(artwork ? { files: [new AttachmentBuilder(artwork, { name: fileName })] } : {}),
  };
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
      await message.edit({ ...await ticketPanelPayload(settings, panelSettings, false, channel.guild.id), attachments: [] });
      await TicketPanelMessageModel.updateOne(filter, { $set: { messageId: message.id } });
      return 'updated';
    }
  } else if (mode === 'update') {
    return 'missing';
  }

  const message = await channel.send(await ticketPanelPayload(settings, panelSettings, false, channel.guild.id));
  await TicketPanelMessageModel.findOneAndUpdate(filter, { $set: { messageId: message.id } }, { upsert: true, returnDocument: 'after' });
  return 'posted';
}

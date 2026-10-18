import { AttachmentBuilder, type GuildMember, type MessageCreateOptions, type PartialGuildMember } from 'discord.js';
import { WelcomeArtworkModel } from '../../database/models/index.js';
import type { GuildSettings } from '../../settings/schema.js';
import { panel, v2 } from '../../ui/components.js';
import { colors } from '../../ui/theme.js';
import { renderWelcomeCard, type WelcomeEventKind } from '../../render/welcomeCard.js';

export const JOIN_PLACEHOLDERS = '`{user}` mention · `{username}` username · `{displayname}` server display name · `{server}` server · `{count}` member count';
export const LEAVE_PLACEHOLDERS = '`{user}` mention · `{username}` username · `{displayname}` server display name · `{server}` server · `{count}` member count';
export const PLACEHOLDERS = JOIN_PLACEHOLDERS;

export function fillTemplate(template: string, member: GuildMember | PartialGuildMember, mention = true): string {
  return template
    .replaceAll('{user}', mention ? `<@${member.id}>` : member.displayName)
    .replaceAll('{username}', member.user?.username ?? 'Someone')
    .replaceAll('{displayname}', member.displayName)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{count}', member.guild.memberCount.toLocaleString());
}

/** Build the actual Discord payload for both live events and private previews. */
export async function welcomeMessage(
  member: GuildMember | PartialGuildMember,
  settings: GuildSettings,
  kind: WelcomeEventKind,
): Promise<MessageCreateOptions> {
  const config = settings.welcome[kind];
  const body = fillTemplate(config.message, member);
  const allowedMentions = { parse: [] as [], users: config.pingUser ? [member.id] : [] };

  if (config.format === 'container') {
    const container = panel({
      title: kind === 'join' ? 'Welcome!' : 'Goodbye',
      emoji: kind === 'join' ? 'welcome' : 'leave',
      description: body,
      accent: kind === 'join' ? settings.general.accentColor : colors.muted,
      thumbnail: config.artwork.showAvatar ? member.displayAvatarURL({ size: 256 }) : null,
    });
    return { ...v2(container), allowedMentions };
  }

  if (config.format === 'text') {
    return { content: body, allowedMentions };
  }

  let background: Buffer | null = null;
  if (config.artwork.background === 'custom') {
    const asset = await WelcomeArtworkModel.findOne({ guildId: member.guild.id, event: kind }).lean();
    if (asset) background = Buffer.from(asset.data);
  }
  const image = await renderWelcomeCard({
    event: kind,
    template: config.artwork.template,
    accent: settings.general.accentColor,
    displayName: member.displayName,
    avatarUrl: member.displayAvatarURL({ size: 256 }),
    serverName: member.guild.name,
    memberCount: member.guild.memberCount,
    message: config.format === 'image_only' ? fillTemplate(config.message, member, false) : '',
    showAvatar: config.artwork.showAvatar,
    showMemberCount: config.artwork.showMemberCount,
    showServerName: config.artwork.showServerName,
    background,
  });
  const filename = `${kind}-welcome.png`;
  const file = new AttachmentBuilder(image, { name: filename });
  return {
    ...(config.format === 'text_image' ? { content: body } : {}),
    files: [file],
    allowedMentions,
  };
}

import { PermissionFlagsBits, type Guild, type GuildMember } from 'discord.js';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Clanky } from '../client/Clanky.js';
import { env } from '../config/env.js';

/** Permissions Clanky asks for when it is invited. */
export const BOT_PERMISSIONS =
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.SendMessagesInThreads |
  PermissionFlagsBits.CreatePublicThreads |
  PermissionFlagsBits.EmbedLinks |
  PermissionFlagsBits.AttachFiles |
  PermissionFlagsBits.ReadMessageHistory |
  PermissionFlagsBits.UseExternalEmojis |
  PermissionFlagsBits.AddReactions |
  PermissionFlagsBits.ManageMessages |
  PermissionFlagsBits.ManageChannels |
  PermissionFlagsBits.ManageRoles |
  PermissionFlagsBits.ManageGuild |
  PermissionFlagsBits.ManageThreads |
  PermissionFlagsBits.KickMembers |
  PermissionFlagsBits.BanMembers |
  PermissionFlagsBits.ModerateMembers |
  PermissionFlagsBits.ViewAuditLog;

export const inviteUrl = (guildId?: string) => {
  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', env.DISCORD_CLIENT_ID);
  url.searchParams.set('scope', 'bot applications.commands');
  url.searchParams.set('permissions', BOT_PERMISSIONS.toString());
  if (guildId) {
    url.searchParams.set('guild_id', guildId);
    url.searchParams.set('disable_guild_select', 'true');
  }
  return url.toString();
};

const MANAGE = BigInt(PermissionFlagsBits.ManageGuild);
const ADMIN = BigInt(PermissionFlagsBits.Administrator);

/** Can this user manage the server, based on their OAuth guild entry? */
export const canManage = (g: { owner: boolean; permissions: string }) => {
  const perms = BigInt(g.permissions);
  return g.owner || (perms & ADMIN) === ADMIN || (perms & MANAGE) === MANAGE;
};

export interface ManagedGuild {
  guild: Guild;
  member: GuildMember;
}

/**
 * Resolves a server the logged-in user may manage. Checks live
 * permissions through the bot, so removed admins lose access right away.
 */
export async function managedGuild(client: Clanky, request: FastifyRequest, reply: FastifyReply): Promise<ManagedGuild | null> {
  const { guildId } = request.params as { guildId: string };
  const userId = request.session!.record.userId;
  const guild = /^\d{17,20}$/.test(guildId) ? client.guilds.cache.get(guildId) : undefined;
  if (!guild) {
    reply.code(404).send({ error: 'not_found', message: "Clanky isn't in that server." });
    return null;
  }
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member || !member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    reply.code(403).send({ error: 'forbidden', message: 'You need the Manage Server permission.' });
    return null;
  }
  return { guild, member };
}

import { PermissionFlagsBits, type GuildMember, type PermissionResolvable } from 'discord.js';

export const Perms = PermissionFlagsBits;

export function memberHas(member: GuildMember | null | undefined, permission: PermissionResolvable): boolean {
  return Boolean(member?.permissions.has(permission));
}

/**
 * Checks if `moderator` may act on `target`. Returns a short reason when
 * it isn't allowed, otherwise null.
 */
export function moderationBlocker(moderator: GuildMember, target: GuildMember, me: GuildMember): string | null {
  if (target.id === moderator.id) return "You can't do that to yourself.";
  if (target.id === me.id) return "I can't do that to myself.";
  if (target.id === target.guild.ownerId) return "You can't do that to the server owner.";
  if (moderator.id !== moderator.guild.ownerId && target.roles.highest.position >= moderator.roles.highest.position) {
    return 'That member has the same or a higher role than you.';
  }
  if (target.roles.highest.position >= me.roles.highest.position) {
    return 'That member has the same or a higher role than me.';
  }
  return null;
}

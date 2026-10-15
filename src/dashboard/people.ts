import type { Client } from 'discord.js';

export interface UserSummary {
  id: string;
  name: string;
  avatar: string;
}

/** Name + avatar for a user ID, from the cache or Discord. */
export async function userSummary(client: Client, id: string): Promise<UserSummary> {
  const user = client.users.cache.get(id) ?? (await client.users.fetch(id).catch(() => null));
  if (!user) return { id, name: 'Unknown user', avatar: `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(id) >> 22n) % 6}.png` };
  return { id, name: user.displayName, avatar: user.displayAvatarURL({ size: 64, extension: 'png' }) };
}

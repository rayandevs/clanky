import { z } from 'zod';
import { colors } from '../ui/theme.js';

/**
 * Guild settings schema — the single source of truth.
 *
 * Both the bot and the upcoming web dashboard read and write settings
 * through these schemas. Every field has a default, so documents created
 * by older versions are upgraded automatically when they are read.
 */

export const snowflake = z.string().regex(/^\d{17,20}$/);
const channel = snowflake.nullable().default(null);
const roles = (max: number) => z.array(snowflake).max(max).default([]);

export const LOG_EVENTS = ['messageDelete', 'messageEdit', 'memberJoin', 'memberLeave', 'memberRoles', 'nickname'] as const;
export type LogEvent = (typeof LOG_EVENTS)[number];

export const GeneralSettings = z.object({
  accentColor: z.number().int().min(0).max(0xffffff).default(colors.brand),
  /** Channel where Clanky posts "What's new" after updates. */
  updatesChannelId: channel,
});

export const ModerationSettings = z.object({
  enabled: z.boolean().default(true),
  logChannelId: channel,
  reportsChannelId: channel,
  dmOnAction: z.boolean().default(true),
  requireReason: z.boolean().default(false),
});

export const LoggingSettings = z.object({
  enabled: z.boolean().default(false),
  channelId: channel,
  events: z.array(z.enum(LOG_EVENTS)).default([...LOG_EVENTS]),
  ignoredChannelIds: roles(25),
});

export const WelcomeSettings = z.object({
  enabled: z.boolean().default(false),
  channelId: channel,
  message: z.string().min(1).max(1000).default('Welcome to **{server}**, {user}! You are member **#{count}** 🎉'),
  leaveEnabled: z.boolean().default(false),
  leaveMessage: z.string().min(1).max(1000).default('**{username}** left the server. 👋'),
  autoRoleIds: roles(5),
  showAvatar: z.boolean().default(true),
});

export const TicketCategory = z.object({
  id: z.string().min(1).max(20),
  label: z.string().min(1).max(50),
  description: z.string().max(100).default(''),
});

export const TicketSettings = z.object({
  enabled: z.boolean().default(false),
  /** Discord category channel where ticket channels are created. */
  parentId: channel,
  logChannelId: channel,
  staffRoleIds: roles(10),
  maxOpenPerUser: z.number().int().min(1).max(5).default(1),
  panelTitle: z.string().min(1).max(100).default('Need help?'),
  panelDescription: z.string().min(1).max(1000).default('Press the button below to open a private ticket with our team.'),
  categories: z.array(TicketCategory).max(10).default([]),
});

export const SuggestionSettings = z.object({
  enabled: z.boolean().default(false),
  channelId: channel,
  reviewerRoleIds: roles(10),
  anonymous: z.boolean().default(false),
  createThreads: z.boolean().default(true),
});

export const LevelReward = z.object({
  level: z.number().int().min(1).max(500),
  roleId: snowflake,
});

export const LevelingSettings = z.object({
  enabled: z.boolean().default(false),
  announce: z.enum(['off', 'current', 'channel']).default('current'),
  announceChannelId: channel,
  message: z.string().min(1).max(500).default('GG {user}, you reached **level {level}**! ⭐'),
  xpMin: z.number().int().min(1).max(100).default(15),
  xpMax: z.number().int().min(1).max(200).default(25),
  cooldownSeconds: z.number().int().min(0).max(3600).default(60),
  ignoredChannelIds: roles(25),
  rewards: z.array(LevelReward).max(20).default([]),
  stackRewards: z.boolean().default(true),
});

export const AutomodSettings = z.object({
  enabled: z.boolean().default(true),
  alertChannelId: channel,
  mentionLimit: z.number().int().min(2).max(50).default(5),
  blockedWords: z.array(z.string().min(1).max(60)).max(100).default([]),
  /** IDs of the native Discord AutoMod rules Clanky manages. */
  rules: z
    .object({
      invites: snowflake.nullable().default(null),
      mentionSpam: snowflake.nullable().default(null),
      spam: snowflake.nullable().default(null),
      keywords: snowflake.nullable().default(null),
    })
    .prefault({}),
});

const Toggle = z.object({ enabled: z.boolean().default(true) });

export const GamesSettings = z.object({
  enabled: z.boolean().default(true),
  /** Channels where games can be played. Empty means everywhere. */
  channelIds: roles(25),
});

export const GuildSettingsSchema = z.object({
  general: GeneralSettings.prefault({}),
  moderation: ModerationSettings.prefault({}),
  logging: LoggingSettings.prefault({}),
  welcome: WelcomeSettings.prefault({}),
  tickets: TicketSettings.prefault({}),
  suggestions: SuggestionSettings.prefault({}),
  leveling: LevelingSettings.prefault({}),
  automod: AutomodSettings.prefault({}),
  roles: Toggle.prefault({}),
  reminders: Toggle.prefault({}),
  polls: Toggle.prefault({}),
  games: GamesSettings.prefault({}),
});

export type GuildSettings = z.infer<typeof GuildSettingsSchema>;
export type SettingsSection = keyof GuildSettings;

/** Parses stored settings, falling back to defaults for any broken section. */
export function parseGuildSettings(input: unknown): GuildSettings {
  const result = GuildSettingsSchema.safeParse(input ?? {});
  if (result.success) return result.data;

  const source = (input ?? {}) as Record<string, unknown>;
  const repaired: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(GuildSettingsSchema.shape)) {
    const section = schema.safeParse(source[key]);
    repaired[key] = section.success ? section.data : schema.parse(undefined);
  }
  return repaired as GuildSettings;
}

export const defaultGuildSettings = (): GuildSettings => GuildSettingsSchema.parse({});

/* ─────────────────────────── User preferences ─────────────────────────── */

export const UserPreferencesSchema = z.object({
  /** Show informational replies (rank, help…) only to the user. */
  privateReplies: z.boolean().default(false),
  /** Ping the user in level-up messages. */
  levelUpPings: z.boolean().default(true),
  /** Where reminders are delivered. */
  reminderDelivery: z.enum(['dm', 'channel']).default('dm'),
  /** Show a short note after Clanky gets updated. */
  updateNotices: z.boolean().default(true),
  /** Locale for future translations. */
  locale: z.string().default('en-US'),
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

export function parseUserPreferences(input: unknown): UserPreferences {
  const result = UserPreferencesSchema.safeParse(input ?? {});
  return result.success ? result.data : UserPreferencesSchema.parse({});
}

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

export const LOG_EVENTS = [
  'messageDelete', 'messageEdit', 'messageBulkDelete', 'suspiciousLinks',
  'memberJoin', 'memberLeave', 'memberRoles', 'nickname',
  'memberBan', 'memberUnban', 'memberKick',
  'channelCreate', 'channelDelete', 'channelUpdate',
  'roleCreate', 'roleDelete', 'roleUpdate',
  'webhookCreate', 'webhookUpdate', 'webhookDelete',
] as const;
export type LogEvent = (typeof LOG_EVENTS)[number];
export const LOG_CATEGORIES = ['messages', 'members', 'moderation', 'server', 'integrations'] as const;
export type LogCategory = (typeof LOG_CATEGORIES)[number];
export const LOG_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type LogSeverity = (typeof LOG_SEVERITIES)[number];

const retentionDays = z.union([z.literal(0), z.literal(7), z.literal(30), z.literal(90), z.literal(180), z.literal(365)]);
export const LogRetentionSettings = z.object({
  messages: retentionDays.default(90),
  members: retentionDays.default(90),
  moderation: retentionDays.default(365),
  server: retentionDays.default(90),
  integrations: retentionDays.default(90),
}).prefault({});

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
  /** Count only active warnings created within this rolling window. */
  warningWindowDays: z.number().int().min(1).max(365).default(90),
  /** Each tier applies a timeout at its exact active-warning count. */
  warningEscalations: z.array(z.object({ warnings: z.number().int().min(2).max(20), durationSeconds: z.number().int().min(5).max(2_419_200) })).max(8).refine((tiers) => new Set(tiers.map((tier) => tier.warnings)).size === tiers.length, { message: 'Warning escalation thresholds must be unique.' }).default([]),
  /** Empty means raid response is not configured; admins select channels explicitly. */
  raidChannelIds: roles(25).refine((ids) => new Set(ids).size === ids.length, { message: 'Raid-response channels must be unique.' }),
  raidSlowmodeSeconds: z.number().int().min(5).max(21_600).default(10),
  reviewRetentionDays: z.union([z.literal(30), z.literal(90), z.literal(180), z.literal(365)]).default(180),
});

export const LoggingSettings = z.object({
  enabled: z.boolean().default(false),
  channelId: channel,
  events: z.array(z.enum(LOG_EVENTS)).default([...LOG_EVENTS]),
  categoryChannels: z.object({
    messages: channel,
    members: channel,
    moderation: channel,
    server: channel,
    integrations: channel,
  }).prefault({}),
  ignoredChannelIds: roles(25),
  ignoredRoleIds: roles(25),
  includeBots: z.boolean().default(false),
  recordMessageContent: z.boolean().default(false),
  recordAttachments: z.boolean().default(false),
  detectionEnabled: z.boolean().default(true),
  alertRoleIds: roles(25),
  alertMinimumSeverity: z.enum(['medium', 'high', 'critical']).default('high'),
  viewerRoleIds: roles(25),
  sensitiveEvidenceRoleIds: roles(25),
  retentionDays: LogRetentionSettings,
});

export const WelcomeArtworkSettings = z.object({
  template: z.enum(['celebration', 'minimal', 'soft']).default('celebration'),
  background: z.enum(['preset', 'custom']).default('preset'),
  showAvatar: z.boolean().default(true),
  showMemberCount: z.boolean().default(true),
  showServerName: z.boolean().default(true),
});

export const WelcomeEventSettings = z.object({
  channelId: channel,
  message: z.string().min(1).max(1000).default('Welcome to **{server}**, {user}! You are member **#{count}** 🎉'),
  format: z.enum(['container', 'text', 'text_image', 'image_only']).default('container'),
  pingUser: z.boolean().default(true),
  includeBots: z.boolean().default(true),
  artwork: WelcomeArtworkSettings.prefault({}),
});

export const WelcomeSettings = z.object({
  enabled: z.boolean().default(false),
  join: WelcomeEventSettings.prefault({
    message: 'Welcome to **{server}**, {user}! You are member **#{count}** 🎉',
  }),
  leaveEnabled: z.boolean().default(false),
  leave: WelcomeEventSettings.prefault({
    message: '**{username}** left the server. 👋',
    pingUser: false,
    artwork: { showAvatar: true },
  }),
  autoRoleIds: roles(5),
  waitForScreening: z.boolean().default(false),
});

export const TicketCategory = z.object({
  id: z.string().min(1).max(20),
  label: z.string().min(1).max(50),
  description: z.string().max(100).default(''),
});

export const TicketQuestion = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,19}$/),
  label: z.string().trim().min(1).max(45),
  description: z.string().max(100).default(''),
  placeholder: z.string().max(100).default(''),
  style: z.enum(['short', 'paragraph']).default('paragraph'),
  required: z.boolean().default(true),
  minLength: z.number().int().min(0).max(4000).default(0),
  maxLength: z.number().int().min(1).max(1000).default(1000),
}).refine((question) => question.minLength <= question.maxLength, { message: 'Minimum answer length must not exceed maximum length.' });
export type TicketQuestionSetting = z.infer<typeof TicketQuestion>;

export const TicketPanelArtwork = z.object({
  mode: z.enum(['none', 'template', 'custom']).default('template'),
  template: z.enum(['support', 'minimal']).default('support'),
}).default({ mode: 'template', template: 'support' });
export type TicketPanelArtworkSetting = z.infer<typeof TicketPanelArtwork>;

export const TicketPanelSettings = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,19}$/),
  title: z.string().trim().min(1).max(100).default('Need help?'),
  description: z.string().min(1).max(1000).default('Press the button below to open a private ticket with our team.'),
  questions: z.array(TicketQuestion).max(5).default(() => [{ id: 'topic', label: 'How can we help?', description: '', placeholder: '', style: 'paragraph' as const, required: true, minLength: 5, maxLength: 1000 }]),
  /** Null means inherit the server-wide setting. */
  parentId: channel,
  logChannelId: channel,
  staffRoleIds: roles(10).nullable().default(null),
  artwork: TicketPanelArtwork,
});
export type TicketPanelSetting = z.infer<typeof TicketPanelSettings>;

const DEFAULT_TICKET_PANEL = {
  id: 'general',
  title: 'Need help?',
  description: 'Press the button below to open a private ticket with our team.',
  questions: [{ id: 'topic', label: 'How can we help?', description: '', placeholder: '', style: 'paragraph' as const, required: true, minLength: 5, maxLength: 1000 }],
  parentId: null,
  logChannelId: null,
  staffRoleIds: null,
  artwork: { mode: 'template' as const, template: 'support' as const },
};

export const TicketSettings = z.object({
  enabled: z.boolean().default(false),
  /** Discord category channel where ticket channels are created. */
  parentId: channel,
  logChannelId: channel,
  staffRoleIds: roles(10),
  maxOpenPerUser: z.number().int().min(1).max(5).default(1),
  /** Retention for the dashboard's structured transcript copy; forever disables expiry. */
  transcriptRetentionDays: z.enum(['30', '90', '180', '365', 'forever']).default('90'),
  categories: z.array(TicketCategory).max(10).default([]),
  panels: z.array(TicketPanelSettings).min(1).max(3).default(() => [DEFAULT_TICKET_PANEL]),
}).superRefine((settings, ctx) => {
  const sharedModalComponents = settings.categories.length ? 1 : 0;
  const panelIds = new Set<string>();
  settings.panels.forEach((panel, index) => {
    if (panelIds.has(panel.id)) ctx.addIssue({ code: 'custom', path: ['panels', index, 'id'], message: 'Panel IDs must be unique.' });
    panelIds.add(panel.id);
    const questionIds = new Set<string>();
    panel.questions.forEach((question, questionIndex) => {
      if (questionIds.has(question.id)) ctx.addIssue({ code: 'custom', path: ['panels', index, 'questions', questionIndex, 'id'], message: 'Question IDs must be unique within a panel.' });
      questionIds.add(question.id);
    });
    if (panel.questions.length + sharedModalComponents > 5) {
      ctx.addIssue({ code: 'custom', path: ['panels', index, 'questions'], message: 'A ticket form can contain at most five modal fields, including the topic selector.' });
    }
    if (panel.questions.length + sharedModalComponents < 1) {
      ctx.addIssue({ code: 'custom', path: ['panels', index, 'questions'], message: 'Add at least one question or a ticket topic selector.' });
    }
  });
});

export const SuggestionSettings = z.object({
  enabled: z.boolean().default(false),
  channelId: channel,
  reviewerRoleIds: roles(10),
  /** Legacy/server-wide anonymity remains supported. */
  anonymous: z.boolean().default(false),
  allowAnonymousChoice: z.boolean().default(false),
  createThreads: z.boolean().default(true),
  categories: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  maxOpenPerUser: z.number().int().min(0).max(20).default(3),
  cooldownSeconds: z.number().int().min(0).max(604800).default(60),
  digestIntervalHours: z.union([z.literal(0), z.literal(24), z.literal(168)]).default(0),
  digestChannelId: channel,
}).superRefine((settings, ctx) => {
  if (new Set(settings.categories.map((item) => item.toLowerCase())).size !== settings.categories.length) {
    ctx.addIssue({ code: 'custom', path: ['categories'], message: 'Suggestion categories must be unique.' });
  }
});

export const LevelReward = z.object({
  level: z.number().int().min(1).max(500),
  roleId: snowflake,
});

export const RankCardSettings = z.object({
  theme: z.enum(['midnight', 'ember', 'forest', 'violet']).default('midnight'),
  accentColor: z.number().int().min(0).max(0xffffff).nullable().default(null),
  showServerIcon: z.boolean().default(true),
  showRank: z.boolean().default(true),
  showMessages: z.boolean().default(true),
  showXp: z.boolean().default(true),
});

export const LevelingSettings = z.object({
  enabled: z.boolean().default(false),
  announce: z.enum(['off', 'current', 'channel']).default('current'),
  announceChannelId: channel,
  message: z.string().min(1).max(500).default('GG {user}, you reached **level {level}**! ⭐'),
  xpMin: z.number().int().min(1).max(100).default(15),
  xpMax: z.number().int().min(1).max(200).default(25),
  cooldownSeconds: z.number().int().min(0).max(3600).default(60),
  curvePreset: z.enum(['relaxed', 'classic', 'challenging']).default('classic'),
  minMessageLength: z.number().int().min(0).max(500).default(0),
  ignoredChannelIds: roles(25),
  channelMultipliers: z.array(z.object({ channelId: snowflake, multiplier: z.number().min(1).max(3) })).max(25).default([]),
  roleMultipliers: z.array(z.object({ roleId: snowflake, multiplier: z.number().min(1).max(3) })).max(25).default([]),
  rewards: z.array(LevelReward).max(20).default([]),
  stackRewards: z.boolean().default(true),
  rankCard: RankCardSettings.default({ theme: 'midnight', accentColor: null, showServerIcon: true, showRank: true, showMessages: true, showXp: true }),
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
  const source = (input ?? {}) as Record<string, unknown>;
  const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const rawTickets = asRecord(source.tickets);
  const rawWelcome = asRecord(source.welcome);
  const hasLegacyWelcome = ['channelId', 'message', 'leaveMessage', 'showAvatar'].some((key) => key in rawWelcome);
  const legacyJoin = {
    channelId: rawWelcome.channelId,
    message: rawWelcome.message,
    artwork: { showAvatar: rawWelcome.showAvatar },
  };
  const legacyLeave = {
    channelId: null,
    message: rawWelcome.leaveMessage,
    pingUser: true,
    artwork: { showAvatar: rawWelcome.showAvatar ?? true },
  };
  const migrated: Record<string, unknown> = {
    ...source,
    welcome: {
      ...rawWelcome,
      join: rawWelcome.join ?? (hasLegacyWelcome ? legacyJoin : undefined),
      leave: rawWelcome.leave ?? (hasLegacyWelcome ? legacyLeave : undefined),
    },
    tickets: Array.isArray(rawTickets.panels) ? rawTickets : {
      ...rawTickets,
      panels: [
        {
          ...DEFAULT_TICKET_PANEL,
          title: typeof rawTickets.panelTitle === 'string' && rawTickets.panelTitle.trim() ? rawTickets.panelTitle : DEFAULT_TICKET_PANEL.title,
          description:
            typeof rawTickets.panelDescription === 'string' && rawTickets.panelDescription.trim()
              ? rawTickets.panelDescription
              : DEFAULT_TICKET_PANEL.description,
        },
      ],
    },
  };
  const result = GuildSettingsSchema.safeParse(migrated);
  if (result.success) return result.data;

  const repaired: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(GuildSettingsSchema.shape)) {
    const section = schema.safeParse(migrated[key]);
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

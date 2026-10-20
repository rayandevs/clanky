/**
 * Demo mode: a fake bot API so the dashboard can be previewed without
 * Discord or MongoDB. Used only by `npm run build:demo`.
 */
import { ApiError } from './api';
import type { Channel, GuildListItem, GuildSettings, Incident, IncidentStatus, LoggerEvent, Me, Meta, Overview, Release, Role, RuleKind, SalvagePlayer, SectionId, SettingsPayload, SuggestionQueueResponse, SuggestionStatus, TicketTranscriptDetailResponse, TicketTranscriptListResponse } from './types';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const id = (n: number) => `13${String(n).padStart(16, '0')}`;
const avatar = (n: number) => `https://cdn.discordapp.com/embed/avatars/${n % 6}.png`;
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

let loggedIn = true;
const postedTicketPanels = new Map<string, NonNullable<SettingsPayload['postedTicketPanels']>>();
const demoSeasons = new Map<string, Array<{ seasonId: string; name: string; active: boolean; startedAt: string; endedAt: string | null; rewardRoleId: string | null; rewardTopCount: number }>>();
const demoSuggestions = new Map<string, SuggestionQueueResponse['entries']>();
const demoLoggerData = new Map<string, { incidents: Incident[]; events: LoggerEvent[] }>();

function suggestionsFor(guildId: string) {
  if (!demoSuggestions.has(guildId)) demoSuggestions.set(guildId, [
    { suggestionId: 17, title: 'Add a channel for Salvage trades', content: 'People keep posting their shinies in general. A trade channel would keep things tidy.', category: 'Community', authorId: people[4]!.id, author: people[4]!, anonymous: false, status: 'pending', upvotes: [people[0]!.id, people[1]!.id, people[2]!.id], downvotes: [people[3]!.id], channelId: id(23), messageId: id(170), createdAt: hoursAgo(32), updatedAt: hoursAgo(32), reviewerId: null, reviewer: null, reviewNote: null, reviewHistory: [], postStatus: 'posted', postError: null },
    { suggestionId: 16, title: 'Monthly community game night', content: 'A relaxed game night would help new members meet people outside of general chat.', category: 'Events', authorId: people[3]!.id, author: people[3]!, anonymous: true, status: 'under_review', upvotes: [people[0]!.id, people[1]!.id, people[2]!.id, people[4]!.id], downvotes: [], channelId: id(23), messageId: id(160), createdAt: hoursAgo(78), updatedAt: hoursAgo(20), reviewerId: people[1]!.id, reviewer: people[1]!, reviewNote: 'Checking moderator availability and a good time slot.', reviewHistory: [{ status: 'under_review', note: 'Checking moderator availability and a good time slot.', reviewerId: people[1]!.id, reviewer: people[1]!, changedAt: hoursAgo(20) }], postStatus: 'posted', postError: null },
    { suggestionId: 15, title: 'Create a new-member guide', content: 'Collect links to the rules, roles and common questions in one pinned guide.', category: 'Features', authorId: people[2]!.id, author: people[2]!, anonymous: false, status: 'planned', upvotes: [people[0]!.id, people[1]!.id], downvotes: [], channelId: id(23), messageId: id(150), createdAt: hoursAgo(24 * 8), updatedAt: hoursAgo(24 * 2), reviewerId: people[0]!.id, reviewer: people[0]!, reviewNote: 'We will draft this after the next moderation update.', reviewHistory: [{ status: 'planned', note: 'We will draft this after the next moderation update.', reviewerId: people[0]!.id, reviewer: people[0]!, changedAt: hoursAgo(24 * 2) }], postStatus: 'posted', postError: null },
    { suggestionId: 14, title: 'Increase the size of the role menu', content: 'It would be easier to find the right role if the menu showed more context.', category: null, authorId: people[5]!.id, author: people[5]!, anonymous: false, status: 'pending', upvotes: [], downvotes: [], channelId: id(23), messageId: null, createdAt: hoursAgo(2), updatedAt: hoursAgo(2), reviewerId: null, reviewer: null, reviewNote: null, reviewHistory: [], postStatus: 'failed', postError: 'Missing permission to send messages in #suggestions.' },
  ]);
  return demoSuggestions.get(guildId)!;
}

function seasonsFor(guildId: string) {
  if (!demoSeasons.has(guildId)) demoSeasons.set(guildId, [
    { seasonId: '11111111-1111-4111-8111-111111111111', name: 'Autumn Sprint', active: true, startedAt: hoursAgo(24 * 9), endedAt: null, rewardRoleId: id(54), rewardTopCount: 3 },
    { seasonId: '22222222-2222-4222-8222-222222222222', name: 'Summer Scramble', active: false, startedAt: hoursAgo(24 * 70), endedAt: hoursAgo(24 * 40), rewardRoleId: id(55), rewardTopCount: 3 },
  ]);
  return demoSeasons.get(guildId)!;
}

function loggerDataFor(guildId: string) {
  if (!demoLoggerData.has(guildId)) {
    const incidentId = '7a7d6618-88b5-45e7-9b87-05aa095f1512';
    const linkIncidentId = 'f8529336-e93e-4303-83a9-4ec747f5ac54';
    const events: LoggerEvent[] = [
      { eventId: 'd1010f41-2fbf-4f48-84cb-2bec56a18d01', eventType: 'channelDelete', category: 'server', source: 'audit_log', occurredAt: hoursAgo(1), actorId: people[1]!.id, actorAttribution: 'audit_log', targetUserId: null, channelId: id(24), roleId: null, messageId: null, summary: `<@${people[1]!.id}> deleted a channel (object ${id(24)}).`, severity: 'high', riskScore: 85, riskReasons: ['channel_delete_burst'], incidentId, evidenceHash: '7f1630ae3d25729c5436ad7b9a19020a3c50da4b143164d58ed6b1d9c92351b0', integrityValid: true, delivery: { status: 'delivered', channelId: id(43), attempts: 1, nextAttemptAt: null, lastError: null, messageId: id(910) }, evidence: { changedFields: ['name'] } },
      { eventId: 'c9456ed3-0200-44dd-82a7-cfc3ac63da74', eventType: 'channelDelete', category: 'server', source: 'audit_log', occurredAt: hoursAgo(0.98), actorId: people[1]!.id, actorAttribution: 'audit_log', targetUserId: null, channelId: id(25), roleId: null, messageId: null, summary: `<@${people[1]!.id}> deleted a channel (object ${id(25)}).`, severity: 'high', riskScore: 85, riskReasons: ['channel_delete_burst'], incidentId, evidenceHash: '5a16aae8c63c373571a03f0554e0795371531b0cc5d2f341fccb6bfcc83a4900', integrityValid: true, delivery: { status: 'failed', channelId: id(43), attempts: 3, nextAttemptAt: hoursAgo(0.1), lastError: 'Missing permission to send messages.', messageId: null }, evidence: { changedFields: ['name', 'position'] } },
      { eventId: '7024e94e-18bd-4e37-9e0e-c4714dc7ad03', eventType: 'channelDelete', category: 'server', source: 'audit_log', occurredAt: hoursAgo(0.99), actorId: people[1]!.id, actorAttribution: 'audit_log', targetUserId: null, channelId: id(26), roleId: null, messageId: null, summary: `<@${people[1]!.id}> deleted a channel (object ${id(26)}).`, severity: 'high', riskScore: 85, riskReasons: ['channel_delete_burst'], incidentId, evidenceHash: '922a08d86f590e1999264de38bc5269c9326b8e551e3980001fe2e6c1d3fc2a5', integrityValid: true, delivery: { status: 'delivered', channelId: id(43), attempts: 1, nextAttemptAt: null, lastError: null, messageId: id(916) }, evidence: { changedFields: ['name'] } },
      { eventId: '935a26ca-0048-4e29-8d05-bc4c421aa839', eventType: 'memberBan', category: 'moderation', source: 'audit_log', occurredAt: hoursAgo(14), actorId: people[2]!.id, actorAttribution: 'audit_log', targetUserId: people[4]!.id, channelId: null, roleId: null, messageId: null, summary: `<@${people[2]!.id}> banned a member (object ${people[4]!.id}).`, severity: 'low', riskScore: 0, riskReasons: [], incidentId: null, evidenceHash: '81ca3e223f32e79b87927879812a34ee629e132c48af01e89b7d75aa50b04b0e', integrityValid: true, delivery: { status: 'delivered', channelId: id(41), attempts: 1, nextAttemptAt: null, lastError: null, messageId: id(911) }, evidence: { changedFields: [] } },
      { eventId: '0df51810-e0fb-4d80-a0e0-913c9d2e4b41', eventType: 'webhookCreate', category: 'integrations', source: 'audit_log', occurredAt: hoursAgo(0.6), actorId: people[3]!.id, actorAttribution: 'audit_log', targetUserId: null, channelId: id(21), roleId: null, messageId: null, summary: `<@${people[3]!.id}> created a webhook shortly before a link burst in the same channel.`, severity: 'low', riskScore: 0, riskReasons: [], incidentId: linkIncidentId, evidenceHash: 'cdf3f3f8627eb0c9c23b86caa710185b73f4f81d4fa99c96ef56bf14b11bcacd', integrityValid: true, delivery: { status: 'delivered', channelId: id(41), attempts: 1, nextAttemptAt: null, lastError: null, messageId: id(917) }, evidence: { changedFields: ['channelId'] } },
      { eventId: 'f89a91fd-d9fc-4c73-9cf0-0d7a24eeeb40', eventType: 'suspiciousLinks', category: 'messages', source: 'detector', occurredAt: hoursAgo(0.5), actorId: null, actorAttribution: 'unknown', targetUserId: people[5]!.id, channelId: id(21), roleId: null, messageId: id(912), summary: 'A recently created account sent link-containing messages 5 times within one minute. Message text is not included in this signal.', severity: 'critical', riskScore: 95, riskReasons: ['new_account_links_after_webhook'], incidentId: linkIncidentId, evidenceHash: '1f2b05e769331ea5072e91f4722fdbadeb392cbe929238282ee6631289f18900', integrityValid: false, delivery: { status: 'not_configured', channelId: null, attempts: 0, nextAttemptAt: null, lastError: 'No log channel is configured for this category.', messageId: null }, evidence: { linkCount: 5, relatedMessageIds: [id(912), id(913), id(914)] } },
    ];
    const incidents: Incident[] = [
      { incidentId, title: 'Rapid channel deletions', summary: 'Several channels were deleted within a short period. Review the timeline and actor attribution.', ruleId: 'channel_delete_burst', status: 'investigating', severity: 'high', riskScore: 85, firstEventAt: hoursAgo(1), lastEventAt: hoursAgo(0.98), eventCount: 3, affectedUserIds: [], affectedChannelIds: [id(24), id(25), id(26)], affectedRoleIds: [], actorIds: [people[1]!.id], notes: [{ actorId: people[0]!.id, action: 'status', status: 'investigating', text: 'Checking whether this was part of the planned channel cleanup.', createdAt: hoursAgo(0.8) }], resolvedAt: null },
      { incidentId: linkIncidentId, title: 'New-account link burst after webhook creation', summary: 'A recently created account posted repeated links soon after a webhook was created. This needs a human review.', ruleId: 'new_account_links_after_webhook', status: 'open', severity: 'critical', riskScore: 95, firstEventAt: hoursAgo(0.6), lastEventAt: hoursAgo(0.5), eventCount: 2, affectedUserIds: [people[5]!.id], affectedChannelIds: [id(21)], affectedRoleIds: [], actorIds: [], notes: [], resolvedAt: null },
    ];
    demoLoggerData.set(guildId, { incidents, events });
  }
  return demoLoggerData.get(guildId)!;
}

function demoCanManage(guildId: string): boolean {
  return guildId !== id(200);
}

function demoVisibleEvidence(event: LoggerEvent, canViewSensitive: boolean): LoggerEvent {
  if (canViewSensitive || !event.evidence) return event;
  return {
    ...event,
    evidence: {
      changedFields: event.evidence.changedFields,
      linkCount: event.evidence.linkCount,
      relatedEventIds: event.evidence.relatedEventIds,
      relatedMessageIds: event.evidence.relatedMessageIds,
    },
  };
}

function loggerListItem(event: LoggerEvent): Omit<LoggerEvent, 'evidence'> {
  const item = { ...event };
  delete item.evidence;
  return item;
}

const MODULES: Meta['modules'] = [
  { id: 'general', name: 'General', emoji: 'settings', description: 'Look and feel, update notes and modules.', toggleable: false, hasSettingsPage: true },
  { id: 'moderation', name: 'Moderation', emoji: 'shield', description: 'Warn, timeout, kick and ban with case history.', toggleable: true, hasSettingsPage: true },
  { id: 'automod', name: 'AutoMod', emoji: 'automod', description: 'Block invites, spam and bad words using Discord AutoMod.', toggleable: true, hasSettingsPage: true },
  { id: 'logging', name: 'Logging', emoji: 'log', description: 'Search event evidence, review grouped incidents, tune privacy and retry delivery.', toggleable: true, hasSettingsPage: true },
  { id: 'welcome', name: 'Welcome', emoji: 'welcome', description: 'Greet new members and give them roles.', toggleable: true, hasSettingsPage: true },
  { id: 'tickets', name: 'Tickets', emoji: 'ticket', description: 'Private support channels with transcripts.', toggleable: true, hasSettingsPage: true },
  { id: 'suggestions', name: 'Suggestions', emoji: 'suggestion', description: 'Let members share and vote on ideas.', toggleable: true, hasSettingsPage: true },
  { id: 'leveling', name: 'Leveling', emoji: 'level', description: 'Earn XP by chatting and unlock roles.', toggleable: true, hasSettingsPage: true },
  { id: 'roles', name: 'Role Panels', emoji: 'role', description: 'Let members pick their own roles.', toggleable: true, hasSettingsPage: false },
  { id: 'reminders', name: 'Reminders', emoji: 'reminder', description: 'Personal reminders.', toggleable: true, hasSettingsPage: false },
  { id: 'games', name: 'Games', emoji: 'game', description: 'Play Salvage: dig up loot, level up and collect.', toggleable: true, hasSettingsPage: true },
  { id: 'polls', name: 'Polls', emoji: 'poll', description: 'Quick native Discord polls.', toggleable: true, hasSettingsPage: false },
];

const meta: Meta = {
  bot: { name: 'Clanky', avatar: null, online: true, version: { raw: '0.1.0-beta.19', label: 'v0.1.0 Beta 19', codename: 'Spark' }, servers: 128, members: 48_210, commands: 25, uptime: 3 * 86_400_000 + 5 * 3_600_000, ping: 42 },
  dashboard: { version: { raw: '0.1.0-beta.5', label: 'v0.1.0 Beta 5', codename: 'Rench' } },
  game: { items: 44, zones: 4 },
  modules: MODULES,
  loginEnabled: true,
  feedbackEnabled: true,
  inviteUrl: 'https://discord.com/oauth2/authorize',
  supportUrl: null,
};

const me: Me = {
  user: { id: id(1), username: 'rayan', globalName: 'Rayan', avatar: avatar(1) },
  preferences: { privateReplies: false, levelUpPings: true, reminderDelivery: 'dm', updateNotices: true, locale: 'en-US' },
  stats: { commandsUsed: 1_284, since: hoursAgo(24 * 21) },
};

const guildList: GuildListItem[] = [
  { id: id(100), name: 'Rusty Bolts HQ', icon: null, owner: true, botIn: true, memberCount: 1_284, inviteUrl: null },
  { id: id(200), name: 'Scrap Collectors', icon: null, owner: false, botIn: true, memberCount: 342, inviteUrl: null, access: 'logs' },
  { id: id(300), name: 'Late Night Devs', icon: null, owner: true, botIn: false, memberCount: null, inviteUrl: 'https://discord.com/oauth2/authorize' },
];

const channels: Channel[] = [
  { id: id(10), name: 'Info', type: 4, parentId: null, position: 0, canSend: null },
  { id: id(11), name: 'welcome', type: 0, parentId: id(10), position: 1, canSend: true },
  { id: id(12), name: 'announcements', type: 5, parentId: id(10), position: 2, canSend: true },
  { id: id(13), name: 'rules', type: 0, parentId: id(10), position: 3, canSend: false },
  { id: id(20), name: 'Community', type: 4, parentId: null, position: 4, canSend: null },
  { id: id(21), name: 'general', type: 0, parentId: id(20), position: 5, canSend: true },
  { id: id(22), name: 'salvage', type: 0, parentId: id(20), position: 6, canSend: true },
  { id: id(23), name: 'suggestions', type: 0, parentId: id(20), position: 7, canSend: true },
  { id: id(24), name: 'memes', type: 0, parentId: id(20), position: 8, canSend: true },
  { id: id(25), name: 'Lounge', type: 2, parentId: id(20), position: 9, canSend: null },
  { id: id(30), name: 'Support', type: 4, parentId: null, position: 10, canSend: null },
  { id: id(31), name: 'help-desk', type: 0, parentId: id(30), position: 11, canSend: true },
  { id: id(40), name: 'Staff', type: 4, parentId: null, position: 12, canSend: null },
  { id: id(41), name: 'mod-log', type: 0, parentId: id(40), position: 13, canSend: true },
  { id: id(42), name: 'reports', type: 0, parentId: id(40), position: 14, canSend: true },
  { id: id(43), name: 'server-log', type: 0, parentId: id(40), position: 15, canSend: true },
  { id: id(44), name: 'ticket-log', type: 0, parentId: id(40), position: 16, canSend: true },
  { id: id(45), name: 'automod-alerts', type: 0, parentId: id(40), position: 17, canSend: true },
];

const roles: Role[] = [
  { id: id(50), name: 'Clanky', color: 0xe2702f, managed: true, assignable: false },
  { id: id(51), name: 'Admin', color: 0xf87171, managed: false, assignable: false },
  { id: id(52), name: 'Moderator', color: 0x60a5fa, managed: false, assignable: true },
  { id: id(53), name: 'Support Team', color: 0x4ade80, managed: false, assignable: true },
  { id: id(54), name: 'Scrap Legend', color: 0xf5c542, managed: false, assignable: true },
  { id: id(55), name: 'Bolt Collector', color: 0xc084fc, managed: false, assignable: true },
  { id: id(56), name: 'Regular', color: 0x9aa6b2, managed: false, assignable: true },
  { id: id(57), name: 'Member', color: 0, managed: false, assignable: true },
];

const defaults = (): GuildSettings => ({
  general: { accentColor: 0xe2702f, updatesChannelId: id(12) },
  moderation: { enabled: true, logChannelId: id(41), reportsChannelId: id(42), dmOnAction: true, requireReason: false },
  logging: {
    enabled: true,
    channelId: id(43),
    events: ['messageDelete', 'messageEdit', 'messageBulkDelete', 'suspiciousLinks', 'memberJoin', 'memberLeave', 'memberRoles', 'nickname', 'memberBan', 'memberUnban', 'memberKick', 'channelCreate', 'channelDelete', 'channelUpdate', 'roleCreate', 'roleDelete', 'roleUpdate', 'webhookCreate', 'webhookUpdate', 'webhookDelete'],
    categoryChannels: { messages: id(43), members: id(43), moderation: id(41), server: id(43), integrations: id(41) },
    ignoredChannelIds: [id(24)],
    ignoredRoleIds: [],
    includeBots: false,
    recordMessageContent: false,
    recordAttachments: false,
    detectionEnabled: true,
    alertRoleIds: [id(52)],
    alertMinimumSeverity: 'high',
    viewerRoleIds: [id(52)],
    sensitiveEvidenceRoleIds: [id(51)],
    retentionDays: { messages: 90, members: 90, moderation: 365, server: 90, integrations: 90 },
  },
  welcome: {
    enabled: true,
    join: {
      channelId: id(11),
      message: 'Welcome to **{server}**, {user}! You are member **#{count}** 🎉',
      format: 'container',
      pingUser: true,
      includeBots: false,
      artwork: { template: 'celebration', background: 'preset', showAvatar: true, showMemberCount: true, showServerName: true },
    },
    leaveEnabled: false,
    leave: {
      channelId: null,
      message: '**{username}** left the server. 👋',
      format: 'container',
      pingUser: false,
      includeBots: false,
      artwork: { template: 'soft', background: 'preset', showAvatar: false, showMemberCount: false, showServerName: true },
    },
    autoRoleIds: [id(57)],
    waitForScreening: false,
  },
  tickets: {
    enabled: true, parentId: id(30), logChannelId: id(44), staffRoleIds: [id(53)], maxOpenPerUser: 1, transcriptRetentionDays: '90',
    panels: [{
      id: 'general-support', title: 'Need help?', description: 'Press the button below to open a private ticket with our team.',
      questions: [{ id: 'topic', label: 'How can we help?', description: '', placeholder: 'Tell us a little about the issue', style: 'paragraph', required: true, minLength: 5, maxLength: 1000 }],
      parentId: null, logChannelId: null, staffRoleIds: null, artwork: { mode: 'template', template: 'support' },
    }],
    categories: [
      { id: 'support', label: 'General support', description: 'Questions about the server' },
      { id: 'report', label: 'Report a member', description: 'Something broke the rules' },
    ],
  },
  suggestions: { enabled: true, channelId: id(23), reviewerRoleIds: [id(52)], anonymous: false, allowAnonymousChoice: true, createThreads: true, categories: ['Community', 'Events', 'Features'], maxOpenPerUser: 3, cooldownSeconds: 60, digestIntervalHours: 24, digestChannelId: id(23) },
  leveling: {
    enabled: true, announce: 'current', announceChannelId: null, message: 'GG {user}, you reached **level {level}**! ⭐', xpMin: 15, xpMax: 25, cooldownSeconds: 60,
    curvePreset: 'classic', minMessageLength: 0, ignoredChannelIds: [id(24)], channelMultipliers: [{ channelId: id(22), multiplier: 1.5 }], roleMultipliers: [{ roleId: id(56), multiplier: 1.25 }],
    rewards: [{ level: 5, roleId: id(56) }, { level: 20, roleId: id(55) }, { level: 50, roleId: id(54) }], stackRewards: true,
    rankCard: { theme: 'midnight', accentColor: null, showServerIcon: true, showRank: true, showMessages: true, showXp: true },
  },
  automod: { enabled: true, alertChannelId: id(45), mentionLimit: 5, blockedWords: ['scam*', 'free nitro'], rules: { invites: 'r1', mentionSpam: 'r2', spam: null, keywords: 'r4' } },
  roles: { enabled: true },
  reminders: { enabled: true },
  polls: { enabled: true },
  games: { enabled: true, channelIds: [id(22)] },
});

const store = new Map<string, GuildSettings>();
const settingsOf = (guildId: string) => {
  if (!store.has(guildId)) store.set(guildId, defaults());
  return store.get(guildId)!;
};

const people = ['Rayan', 'Mira', 'Kofi', 'Nadia', 'Ollie', 'Juno', 'Tariq', 'Bea'].map((name, i) => ({ id: id(900 + i), name, avatar: avatar(i) }));

function overview(guildId: string): Overview {
  const g = guildList.find((x) => x.id === guildId)!;
  const s = settingsOf(guildId);
  const seed = [2, 0, 1, 3, 1, 0, 4, 2, 1, 5, 2, 3, 1, 2];
  return {
    guild: { id: g.id, name: g.name, icon: g.icon, memberCount: g.memberCount ?? 0, createdAt: hoursAgo(24 * 400), joinedAt: hoursAgo(24 * 21) },
    modules: MODULES.filter((m) => m.toggleable).map((m) => ({ id: m.id, enabled: (s[m.id] as { enabled?: boolean }).enabled ?? true })),
    stats: { casesTotal: 42, casesWeek: 7, openTickets: 3, ticketsTotal: 58, pendingSuggestions: 5, ranked: 614 },
    activity: seed.map((c, i) => ({ day: new Date(Date.now() - (13 - i) * 86_400_000).toISOString().slice(0, 10), cases: c, tickets: (c * 3 + i) % 5 })),
    missing: guildId === id(200) ? [{ name: 'Manage Roles', why: 'Auto roles and level rewards' }] : [],
    recentCases: [
      { caseId: 42, type: 'timeout', target: 'spammer#0', reason: 'Mention spam', moderator: people[1]!, createdAt: hoursAgo(2) },
      { caseId: 41, type: 'warn', target: 'loudguy', reason: 'Caps in #general', moderator: people[0]!, createdAt: hoursAgo(9) },
      { caseId: 40, type: 'ban', target: 'freenitro.lol', reason: 'Scam links', moderator: people[2]!, createdAt: hoursAgo(26) },
      { caseId: 39, type: 'kick', target: 'alt_account', reason: null, moderator: people[1]!, createdAt: hoursAgo(50) },
    ],
    audit: [
      { section: 'welcome', source: 'dashboard', actor: people[0]!, createdAt: hoursAgo(1) },
      { section: 'automod', source: 'bot', actor: people[1]!, createdAt: hoursAgo(5) },
      { section: 'leveling', source: 'dashboard', actor: people[0]!, createdAt: hoursAgo(30) },
      { section: 'tickets', source: 'bot', actor: people[2]!, createdAt: hoursAgo(72) },
    ],
    topChatters: people.slice(1, 6).map((user, i) => ({ user, messages: 18_400 - i * 2_350, level: 38 - i * 5, xp: 81_000 - i * 14_000 })),
    topPlayers: people.slice(2, 7).map((user, i) => ({ user, level: 38 - i * 5, xp: 61_000 - i * 9_000 })),
  };
}

const player: SalvagePlayer = {
  level: 11, xp: 1_930, currentXp: 55, neededXp: 325, credits: 8_580, lifetimeCredits: 24_310, digs: 401, streak: 6, bestStreak: 9, golemWins: 4, rank: 1,
  collected: 15, collectable: 44, shinies: 2, cooldown: 3.8, shinyOdds: 150,
  zone: { id: 'scrapyard', name: 'Scrapyard', emoji: '🏚️' }, tool: { id: 'steel_shovel', name: 'Steel Shovel', emoji: '⛏️' },
  title: 'Rookie Digger', theme: 'Hazard',
  bestFind: { name: 'Robot Arm', shiny: true, rarity: 'Epic', color: 0xc084fc, icon: '1f9be' },
  boosts: { luck: 24, xp: 49, bait: 0 },
  upgrades: [
    { id: 'turbo', name: 'Turbo Motor', emoji: '⚡', level: 2, max: 10 },
    { id: 'detector', name: 'Metal Detector', emoji: '📡', level: 0, max: 10 },
    { id: 'haggler', name: 'Haggler', emoji: '🤝', level: 1, max: 10 },
    { id: 'armor', name: 'Golem Armor', emoji: '🛡️', level: 0, max: 10 },
  ],
  badges: [
    { id: 'legend', name: 'Legend Finder', icon: '1f4a0', hint: 'Legendary find', earned: false },
    { id: 'shiny', name: 'Shiny', icon: '2728', hint: 'Find a shiny', earned: true },
    { id: 'slayer', name: 'Golem Slayer', icon: '1f47e', hint: 'Beat 10 golems', earned: false },
    { id: 'collector', name: 'Collector', icon: '1f4d6', hint: 'Full zone', earned: false },
    { id: 'streak', name: 'Dedicated', icon: '1f525', hint: '7 day streak', earned: true },
    { id: 'explorer', name: 'Explorer', icon: '1f680', hint: 'Space Dump', earned: false },
  ],
  zones: [
    { id: 'scrapyard', name: 'Scrapyard', emoji: '🏚️', level: 1, unlocked: true, found: 10, total: 11 },
    { id: 'junkcity', name: 'Junk City', emoji: '🌆', level: 10, unlocked: true, found: 5, total: 11 },
    { id: 'graveyard', name: 'Robot Graveyard', emoji: '⚰️', level: 25, unlocked: false, found: 0, total: 11 },
    { id: 'spacedump', name: 'Space Dump', emoji: '🌌', level: 50, unlocked: false, found: 0, total: 11 },
  ],
};

const changelog: { bot: Release[]; dashboard: Release[] } = {
  bot: [
    { version: '0.1.0-beta.19', date: '2026-10-20', title: 'A clearer view of server activity', highlights: ['Search a durable activity timeline and group related high-risk signals into incidents', 'Review affected members, channels, roles and moderator actions, with notes and retryable Discord delivery', 'Choose category destinations, retention periods, and separate access for logs and sensitive evidence'] },
    { version: '0.1.0-beta.18', date: '2026-10-19', title: 'Unsaved edits, in sight', highlights: ['Keep unsaved settings visible in a fixed side panel while you scroll through a server page', 'Collapse the panel to a small side tab while editing, then save or reset when you are ready'] },
    { version: '0.1.0-beta.17', date: '2026-10-19', title: 'A guide for every step', highlights: ['Added a searchable Help Center to the dashboard, with friendly step-by-step guides for Clanky’s bot and web features', 'Find answers by topic, share a direct guide link, and follow related articles without leaving the dashboard', 'Fixed a route-transition cleanup issue that could replace pages with the dashboard error screen'] },
    { version: '0.1.0-beta.15', date: '2026-10-18', title: 'Welcome cards, in sync 👋', highlights: ['Dashboard previews use the same Canvas renderer as bot messages', 'Template colors and labels now match their names', 'Clean card text and no Discord ALT overlay'] },
    { version: '0.1.0-beta.14', date: '2026-10-18', title: 'A warmer welcome 👋', highlights: ['Configure independent join and leave messages, channels, and formats', 'Customize generated member cards with presets or uploaded backgrounds', 'Control mentions, bot greetings, and screening-delayed welcome messages'] },
    { version: '0.1.0-beta.13', date: '2026-10-18', title: 'Clearer suggestion cards 💡', highlights: ['Give suggestion details, status, category, and author more room to breathe', 'Simplify vote controls by removing duplicate counts and the redundant progress display'] },
    { version: '0.1.0-beta.12', date: '2026-10-17', title: 'Ideas that move 💡', highlights: ['Review suggestions in Discord or a searchable dashboard queue with status history and notes', 'Organize submissions with categories, anonymity choices, limits and cooldowns', 'Author updates, reviewer digests and recovery for failed Discord posts'] },
    { version: '0.1.0-beta.11', date: '2026-10-16', title: 'Clearer dashboard legal docs 📜', highlights: ['Read Clanky’s Privacy Policy and Terms of Service on public dashboard pages', 'Both policies explain self-hosted operation, data handling, retention and deletion scope'] },
    { version: '0.1.0-beta.10', date: '2026-10-16', title: 'A more personal leveling system ⭐', highlights: ['Choose a progression pace without resetting existing levels', 'Track every human message and view leveling activity', 'Customize rank cards and compete in seasons'] },
    { version: '0.1.0-beta.9', date: '2026-10-16', title: 'A clearer ticket desk 🎫', highlights: ['Choose custom, built-in, or no panel artwork', 'Read searchable ticket transcripts with archived attachments retained for the configured period', 'Keep tickets open if transcript messages or attachments cannot be safely archived'] },
    { version: '0.1.0-beta.8', date: '2026-10-16', title: 'A better ticket desk 🎫', highlights: ['Configure up to three ticket panels with custom intake forms and routing', 'A redesigned dashboard editor with previews and tracked panel updates', 'Canvas artwork on support panels and newly opened tickets'] },
    { version: '0.1.0-beta.7', date: '2026-10-15', title: 'The dashboard is here 🖥️', highlights: ['Change every setting from the web dashboard', 'See your Salvage profile, bag and collection online', 'Server overview with stats and change history'] },
    { version: '0.1.0-beta.6', date: '2026-10-15', title: 'Image screens 🖼️', highlights: ['Bag, shop and collection are now image cards', 'Your bag, credits, zone and boosts show on every game card', 'Shop buttons are numbered to match each row'] },
    { version: '0.1.0-beta.5', date: '2026-10-15', title: 'The big shop update 🛒', highlights: ['Black Market with 3 new deals every day', 'Upgrades, boosts and crates', 'Profile themes, titles and badges'] },
    { version: '0.1.0-beta.4', date: '2026-10-15', title: 'Profile cards 🪪', highlights: ['`/salvage profile` is now an image card', 'Cleaner, easier-to-read game messages'] },
  ],
  dashboard: [
    { version: '0.1.0-beta.5', date: '2026-10-21', title: 'Logging, clearly explained', highlights: ['Expanded the Logging guide with setup, event categories, routing, exclusions, and defaults', 'Explained evidence privacy, access roles, retention, risk signals, and what integrity hashes can and cannot tell you', 'Added step-by-step incident review, delivery retry guidance, permission checks, and troubleshooting'] },
    { version: '0.1.0-beta.4', date: '2026-10-20', title: 'A closer look at incidents', highlights: ['Review grouped alerts in one incident timeline with affected objects and moderator actions', 'Search and filter activity, check evidence integrity, and retry log messages Discord could not deliver', 'Control who can view logs or sensitive message evidence in server Logging settings'] },
    { version: '0.1.0-beta.3', date: '2026-10-19', title: 'Save controls, always at hand', highlights: ['Keep Save and Reset visible in a fixed side panel while you work through settings', 'Collapse the panel to a small animated side tab and reopen it whenever you need the controls', 'The panel stays tucked away until the changes are saved or reset'] },
    { version: '0.1.0-beta.2', date: '2026-10-19', title: 'Help, without the hunt', highlights: ['Browse friendly guides for getting started, dashboard settings, and Clanky’s bot features', 'Search guide text and topics instantly, jump between sections, and share direct links to individual guides', 'Step-by-step cards, quick tips, related guides, and keyboard search make answers easier to follow', 'Fixed a route-transition cleanup issue that could replace pages with the dashboard error screen'] },
    { version: '0.1.0-beta.1', date: '2026-10-19', title: 'Rench gets a voice', highlights: ['Signed-in users can send 1–5 star ratings from the footer link or a randomized prompt with cooldown and permanent opt-out', 'Per-account and per-IP limits protect feedback delivery through the server-only Discord webhook', 'Acknowledged submissions carry selected profile and request metadata, never session credentials; the dashboard begins its beta releases under Rench'] },
    { version: '0.1.0-alpha.8', date: '2026-10-18', title: 'Welcome cards, in sync', highlights: ['See the exact Canvas card image Clanky will send', 'Preview updates match template, background, avatar and member details'] },
    { version: '0.1.0-alpha.7', date: '2026-10-18', title: 'A warmer welcome', highlights: ['Configure Join and Leave events separately with distinct formats and previews', 'Choose generated card templates or upload custom backgrounds', 'Control mentions, bots, avatars, member counts and screening-delayed greetings'] },
    { version: '0.1.0-alpha.6', date: '2026-10-17', title: 'Ideas that move', highlights: ['Search, filter and review suggestions from the dashboard', 'Inspect status history and vote trends, and recover failed Discord posts', 'Configure categories, limits, cooldowns, anonymity and reviewer digests'] },
    { version: '0.1.0-alpha.5', date: '2026-10-16', title: 'Clearer legal docs', highlights: ["Read Clanky's Privacy Policy and Terms of Service on public dashboard pages", 'Find both documents from footer links, with a shared layout matching the dashboard', 'Policies explain self-hosted operation, data handling, retention and deletion scope'] },
    { version: '0.1.0-alpha.4', date: '2026-10-16', title: 'A more personal leveling system', highlights: ['Tune progression and XP rules', 'Review messages, XP, and active-member analytics', 'Run manual seasons and preview reward changes'] },
    { version: '0.1.0-alpha.3', date: '2026-10-16', title: 'A clearer ticket desk', highlights: ['Browse closed ticket transcripts with role-checked access for server administrators and ticket staff', 'Attachment files are archived and retained with each transcript instead of relying only on expiring Discord links', 'Choose panel artwork, transcript retention, and custom dashboard uploads in ticket settings'] },
    { version: '0.1.0-alpha.2', date: '2026-10-16', title: 'A better ticket desk', highlights: ['A panel-first ticket editor for up to three support entry points', 'Custom questions, topic options, and per-panel routing in one focused workspace', 'Live Discord preview and save-aware publish/update controls'] },
    { version: '0.1.0-alpha.1', date: '2026-10-15', title: 'First light 🔦', highlights: ['Log in with Discord', 'Every server setting in one place', 'Server overview with stats and history', 'Your Salvage profile, bag and collection', 'Personal preferences'] },
  ],
};

export async function demoApi<T>(method: string, path: string, body?: unknown): Promise<T> {
  await wait(method === 'GET' ? 260 : 420);
  const parts = path.split('?')[0]!.split('/').filter(Boolean); // ['api', ...]
  const [, a, b, c, d, e] = parts;
  const ok = (value: unknown) => value as T;

  if (a === 'meta') return ok(meta);
  if (a === 'changelog') return ok(changelog);
  if (a === 'auth' && b === 'logout') return ok(((loggedIn = false), { ok: true }));
  if (a === 'auth' && b === 'demo-login') return ok(((loggedIn = true), { ok: true }));
  if (!loggedIn) throw new ApiError(401, 'Please log in first.', 'unauthorized');
  if (a === 'feedback' && method === 'POST') return ok({ ok: true });

  if (a === 'me' && !b) return ok(me);
  if (a === 'me' && b === 'preferences') return ok({ preferences: Object.assign(me.preferences, body) });
  if (a === 'me' && b === 'salvage') return ok({ player });
  if (a === 'me' && b === 'delete') return ok(((loggedIn = false), { ok: true }));

  if (a === 'guilds' && !b) return ok(guildList);
  if (a === 'guilds' && b) {
    const g = guildList.find((x) => x.id === b);
    if (!g?.botIn) throw new ApiError(404, "Clanky isn't in that server.", 'not_found');
    if (c === 'logging' && d === 'context' && method === 'GET') return ok({ guild: { id: g.id, name: g.name, icon: g.icon }, canManage: demoCanManage(b), canViewSensitive: demoCanManage(b), loggingEnabled: settingsOf(b).logging.enabled });
    if (c === 'incidents') {
      const data = loggerDataFor(b);
      if (!d && method === 'GET') {
        const params = new URLSearchParams(path.split('?')[1] ?? '');
        const filter = params.get('status');
        const page = Math.max(0, Number(params.get('page')) || 0);
        const found = data.incidents.filter((incident) => !filter || incident.status === filter).sort((x, y) => y.lastEventAt.localeCompare(x.lastEventAt));
        return ok({ total: found.length, page, pages: Math.max(1, Math.ceil(found.length / 25)), entries: found.slice(page * 25, (page + 1) * 25) });
      }
      const incident = data.incidents.find((item) => item.incidentId === d);
      if (!incident) throw new ApiError(404, 'That incident is no longer available.', 'not_found');
      if (method === 'GET' && !e) return ok({ incident, events: data.events.filter((event) => event.incidentId === d).sort((x, y) => x.occurredAt.localeCompare(y.occurredAt)).map((event) => demoVisibleEvidence(event, demoCanManage(b))), canManage: demoCanManage(b), canViewSensitive: demoCanManage(b) });
      if (method === 'PATCH' && !e) {
        if (!demoCanManage(b)) throw new ApiError(403, 'Only server managers can update incident reviews.', 'forbidden');
        const change = body as { status?: IncidentStatus; note?: string };
        const now = new Date().toISOString();
        if (change.status) {
          incident.status = change.status;
          incident.resolvedAt = ['resolved', 'false_alarm'].includes(change.status) ? now : null;
          incident.notes.push({ actorId: people[0]!.id, action: 'status', status: change.status, text: change.note?.trim() || `Marked as ${change.status.replace('_', ' ')}.`, createdAt: now });
        } else if (change.note?.trim()) incident.notes.push({ actorId: people[0]!.id, action: 'note', text: change.note.trim(), createdAt: now });
        incident.notes = incident.notes.slice(-20);
        return ok({ incident });
      }
    }
    if (c === 'logs') {
      const data = loggerDataFor(b);
      if (!d && method === 'GET') {
        const params = new URLSearchParams(path.split('?')[1] ?? '');
        const q = (params.get('q') ?? '').toLowerCase();
        const event = params.get('event');
        const category = params.get('category');
        const delivery = params.get('delivery');
        const page = Math.max(0, Number(params.get('page')) || 0);
        const found = data.events.filter((item) => (!q || `${item.eventId} ${item.summary} ${item.actorId ?? ''} ${item.targetUserId ?? ''} ${item.channelId ?? ''} ${item.roleId ?? ''}`.toLowerCase().includes(q)) && (!event || item.eventType === event) && (!category || item.category === category) && (!delivery || item.delivery.status === delivery)).sort((x, y) => y.occurredAt.localeCompare(x.occurredAt));
        return ok({ total: found.length, page, pages: Math.max(1, Math.ceil(found.length / 25)), entries: found.slice(page * 25, (page + 1) * 25).map(loggerListItem), canViewSensitive: demoCanManage(b) });
      }
      const event = data.events.find((item) => item.eventId === d);
      if (!event) throw new ApiError(404, 'That event is no longer available.', 'not_found');
      if (method === 'GET' && !e) return ok(demoVisibleEvidence(event, demoCanManage(b)));
      if (method === 'POST' && e === 'retry') {
        if (!demoCanManage(b)) throw new ApiError(403, 'Only server managers can retry delivery.', 'forbidden');
        event.delivery.status = 'delivered';
        event.delivery.attempts += 1;
        event.delivery.lastError = null;
        event.delivery.messageId = id(920);
        return ok({ event });
      }
    }
    if (!c) {
      if (!demoCanManage(b)) throw new ApiError(403, 'This server only grants you access to logs.', 'forbidden');
      return ok(overview(b));
    }
    const s = settingsOf(b);
    const rules = (): Record<RuleKind, boolean> => ({ invites: !!s.automod.rules.invites, mentionSpam: !!s.automod.rules.mentionSpam, spam: !!s.automod.rules.spam, keywords: !!s.automod.rules.keywords });
    if (c === 'settings' && method === 'GET') {
      if (!demoCanManage(b)) throw new ApiError(403, 'This server only grants you access to logs.', 'forbidden');
      return ok({ settings: s, resources: { channels, roles }, postedTicketPanels: postedTicketPanels.get(b) ?? [], automod: { canManage: true, rules: rules() } } satisfies SettingsPayload);
    }
    if (c === 'settings' && method === 'PATCH' && d) {
      const section = d as SectionId;
      if (section === 'leveling') {
        const l = { ...s.leveling, ...(body as object) };
        if (l.xpMin > l.xpMax) throw new ApiError(400, 'Min XP must be lower than max XP.', 'invalid');
      }
      (s as unknown as Record<string, unknown>)[section] = { ...(s[section] as object), ...(body as object), ...(section === 'automod' ? { rules: s.automod.rules } : {}) };
      return ok({ settings: s });
    }
    if (c === 'suggestions' && !d && method === 'GET') {
      const params = new URLSearchParams(path.split('?')[1] ?? '');
      const filter = params.get('status') ?? 'all';
      const q = (params.get('q') ?? '').toLowerCase();
      const sort = params.get('sort') ?? 'newest';
      const page = Math.max(0, Number(params.get('page')) || 0);
      const all = suggestionsFor(b);
      const entries = all.filter((item) => (filter === 'all' || (filter === 'failed' ? item.postStatus === 'failed' : item.status === filter)) && (!q || String(item.suggestionId).includes(q.replace(/^#/, '')) || `${item.title} ${item.content} ${item.category ?? ''}`.toLowerCase().includes(q)));
      entries.sort((x, y) => sort === 'oldest' ? x.createdAt.localeCompare(y.createdAt) : sort === 'votes' ? (y.upvotes.length + y.downvotes.length) - (x.upvotes.length + x.downvotes.length) : y.createdAt.localeCompare(x.createdAt));
      const statuses: SuggestionStatus[] = ['pending', 'under_review', 'planned', 'in_progress', 'approved', 'denied', 'implemented'];
      const byStatus = Object.fromEntries(statuses.map((status) => [status, all.filter((item) => item.status === status).length])) as SuggestionQueueResponse['stats']['byStatus'];
      const pending = all.filter((item) => item.status === 'pending');
      const result: SuggestionQueueResponse = {
        total: entries.length, page, pages: Math.max(1, Math.ceil(entries.length / 20)), entries: entries.slice(page * 20, (page + 1) * 20),
        stats: { byStatus, failedPosts: all.filter((item) => item.postStatus === 'failed').length, oldestPendingAt: pending.length ? pending.map((item) => item.createdAt).sort()[0]! : null, topSupported: all.filter((item) => ['pending', 'under_review', 'planned', 'in_progress'].includes(item.status)).map((item) => ({ suggestionId: item.suggestionId, title: item.title, votes: item.upvotes.length + item.downvotes.length })).sort((x, y) => y.votes - x.votes).slice(0, 3) },
      };
      return ok(result);
    }
    if (c === 'suggestions' && d && e === 'review' && method === 'POST') {
      const entry = suggestionsFor(b).find((item) => item.suggestionId === Number(d));
      if (!entry) throw new ApiError(404, 'That suggestion no longer exists.', 'not_found');
      const change = body as { status: SuggestionStatus; note: string };
      entry.status = change.status;
      entry.reviewNote = change.note || null;
      entry.reviewerId = people[1]!.id;
      entry.reviewer = people[1]!;
      entry.updatedAt = new Date().toISOString();
      entry.reviewHistory.push({ status: entry.status, note: entry.reviewNote, reviewerId: people[1]!.id, reviewer: people[1]!, changedAt: entry.updatedAt });
      return ok({ ok: true, postSynced: true });
    }
    if (c === 'suggestions' && d && e === 'retry' && method === 'POST') {
      const entry = suggestionsFor(b).find((item) => item.suggestionId === Number(d));
      if (!entry) throw new ApiError(404, 'That suggestion no longer exists.', 'not_found');
      entry.postStatus = 'posted';
      entry.postError = null;
      entry.messageId = id(140 + entry.suggestionId);
      return ok({ ok: true, result: 'posted' });
    }
    if (c === 'leveling' && d === 'analytics' && method === 'GET') {
      const params = new URLSearchParams(path.split('?')[1] ?? '');
      const count = Math.max(7, Math.min(90, Number(params.get('days')) || 14));
      const days = Array.from({ length: count }, (_, i) => {
        const date = new Date();
        date.setUTCDate(date.getUTCDate() - (count - i - 1));
        const wave = (i * 17 + 31) % 47;
        return { day: date.toISOString().slice(0, 10), messages: 420 + wave * 13, xp: 6800 + wave * 173, activeMembers: 74 + wave };
      });
      const topGainers = people.slice(0, 5).map((user, i) => ({ userId: user.id, xp: 15_800 - i * 2_100, messages: 1_840 - i * 230, user }));
      const seasons = seasonsFor(b).slice().sort((a, x) => x.startedAt.localeCompare(a.startedAt));
      const season = seasons.find((item) => item.active) ?? null;
      const entries = season ? people.slice(0, 10).map((user, i) => ({ rank: i + 1, xp: 72_400 - i * 6_700, user })) : [];
      return ok({ days, summary: { messages: days.reduce((sum, row) => sum + row.messages, 0), xp: days.reduce((sum, row) => sum + row.xp, 0), activeMembers: 287 }, topGainers, seasons, seasonLeaderboard: { season, total: season ? 164 : 0, entries } });
    }
    if (c === 'leveling' && d === 'seasons' && method === 'POST' && !e) {
      const request = body as { name: string; rewardRoleId: string | null; rewardTopCount: number };
      const seasons = seasonsFor(b);
      if (seasons.some((season) => season.active)) throw new ApiError(409, 'End the active season before starting another.', 'conflict');
      const season = { seasonId: '33333333-3333-4333-8333-333333333333', name: request.name, active: true, startedAt: new Date().toISOString(), endedAt: null, rewardRoleId: request.rewardRoleId, rewardTopCount: request.rewardTopCount };
      seasons.unshift(season);
      return ok({ season });
    }
    if (c === 'leveling' && d === 'seasons' && e === 'end' && method === 'POST') {
      const season = seasonsFor(b).find((item) => item.active);
      if (!season) throw new ApiError(404, 'There is no active season to end.', 'not_found');
      season.active = false;
      season.endedAt = new Date().toISOString();
      return ok({ season });
    }
    if (c === 'leveling' && d === 'rewards' && e === 'preview' && method === 'POST') {
      return ok({ membersChecked: 614, membersSkipped: 11, membersChanged: 27, rolesAdded: 19, rolesRemoved: 8, rolesNotAssignable: [], changes: people.slice(0, 5).map((user, i) => ({ userId: user.id, add: i % 2 ? [id(56)] : [], remove: i % 2 ? [] : [id(55)] })) });
    }
    if (c === 'leveling' && d === 'rewards' && e === 'sync' && method === 'POST') return ok({ membersChanged: 27, rolesAdded: 19, rolesRemoved: 8 });
    if (c === 'leveling' && d === 'season-rewards' && e === 'preview' && method === 'POST') {
      const { seasonId } = body as { seasonId: string };
      const season = seasonsFor(b).find((item) => item.seasonId === seasonId);
      if (!season) throw new ApiError(404, 'Season not found.', 'not_found');
      return ok({ season, winners: people.slice(0, season.rewardTopCount).map((user, i) => ({ rank: i + 1, xp: 72_400 - i * 12_600, user })) });
    }
    if (c === 'leveling' && d === 'season-rewards' && e === 'grant' && method === 'POST') return ok({ granted: 3, winners: 3 });
    if (c === 'automod' && d) {
      const kind = d as RuleKind;
      const { enabled } = body as { enabled: boolean };
      if (kind === 'keywords' && enabled && !s.automod.blockedWords.length) throw new ApiError(400, 'Add some blocked words first.', 'invalid');
      s.automod.rules[kind] = enabled ? `r-${kind}` : null;
      return ok({ settings: s, rules: rules() });
    }
    if (c === 'tickets' && d === 'panel' && method === 'POST') {
      const request = body as { channelId?: string; panelId?: string; mode?: 'publish' | 'update' };
      if (!request.channelId || !request.panelId) throw new ApiError(400, 'Choose a panel and destination channel.', 'invalid');
      const placements = postedTicketPanels.get(b) ?? [];
      const existing = placements.find((item) => item.panelId === request.panelId && item.channelId === request.channelId);
      if (request.mode === 'update' && !existing) throw new ApiError(404, 'No tracked panel exists in that channel.', 'not_found');
      const now = new Date().toISOString();
      if (existing) existing.updatedAt = now;
      else placements.push({ panelId: request.panelId, channelId: request.channelId, messageId: id(Date.now() % 10_000_000_000_000_000), updatedAt: now });
      postedTicketPanels.set(b, placements);
      return ok({ result: existing ? 'updated' : 'posted' });
    }
    if (c === 'tickets' && d === 'panels' && e && parts[6] === 'artwork' && method === 'POST') return ok({ ok: true, width: 1200, height: 600 });
    if (c === 'welcome' && (d === 'join' || d === 'leave') && e === 'artwork' && method === 'POST') return ok({ ok: true, width: 1200, height: 600 });
    if (c === 'tickets' && d === 'transcripts' && !e && method === 'GET') {
      const params = new URLSearchParams(path.split('?')[1] ?? '');
      const q = (params.get('q') ?? '').toLowerCase();
      const entries: TicketTranscriptListResponse['entries'] = [
        { ticketId: 42, openerId: id(901), openerDisplayName: 'Mira', panelTitle: 'General support', categoryLabel: 'Account question', createdAt: hoursAgo(52), closedAt: hoursAgo(48), messageCount: 8, truncated: false, expiresAt: new Date(Date.now() + 42 * 86_400_000).toISOString() },
        { ticketId: 41, openerId: id(902), openerDisplayName: 'Kite', panelTitle: 'Report a member', categoryLabel: 'Member report', createdAt: hoursAgo(120), closedAt: hoursAgo(117), messageCount: 14, truncated: false, expiresAt: new Date(Date.now() + 87 * 86_400_000).toISOString() },
        { ticketId: 40, openerId: id(903), openerDisplayName: 'Nova', panelTitle: 'General support', categoryLabel: 'Bug report', createdAt: hoursAgo(235), closedAt: hoursAgo(230), messageCount: 1000, truncated: true, expiresAt: new Date(Date.now() + 176 * 86_400_000).toISOString() },
      ].filter((item) => !q || String(item.ticketId).includes(q.replace(/^#/, '')) || `${item.openerDisplayName} ${item.panelTitle} ${item.categoryLabel}`.toLowerCase().includes(q));
      return ok({ guild: { id: b, name: g.name }, canManage: true, total: entries.length, page: 0, pages: 1, entries } satisfies TicketTranscriptListResponse);
    }
    if (c === 'tickets' && d === 'transcripts' && e && method === 'GET') {
      const ticketId = Number(e);
      const closedAt = hoursAgo(48);
      const createdAt = hoursAgo(52);
      const messages = [
        { messageId: 'demo-message-1', authorId: id(901), authorName: 'Mira', authorAvatarUrl: avatar(2), isBot: false, content: 'Hi! I need help with a sign-in issue.', embeds: [], attachments: [], createdAt },
        { messageId: 'demo-message-2', authorId: id(50), authorName: 'Clanky', authorAvatarUrl: avatar(0), isBot: true, content: 'Ticket #42 opened · Account question', embeds: [], attachments: [], createdAt: hoursAgo(51.8) },
        { messageId: 'demo-message-3', authorId: id(904), authorName: 'Rowan · Support', authorAvatarUrl: avatar(3), isBot: false, content: 'I can help. Please try the password reset link, then let me know if the email arrives.', embeds: [], attachments: [], createdAt: hoursAgo(51.5) },
        { messageId: 'demo-message-4', authorId: id(901), authorName: 'Mira', authorAvatarUrl: avatar(2), isBot: false, content: 'That fixed it, thank you!', embeds: [], attachments: [], createdAt: hoursAgo(50.9) },
      ];
      return ok({
        transcript: { guildId: b, ticketId, channelId: id(990), openerId: id(901), openerDisplayName: 'Mira', openerAvatarUrl: avatar(2), panelTitle: 'General support', categoryLabel: 'Account question', answers: [{ questionId: 'topic', label: 'What do you need help with?', answer: 'I cannot sign in after changing my email.' }], claimedBy: id(904), claimedByName: 'Rowan · Support', closedBy: id(904), closedByName: 'Rowan · Support', closeReason: 'Resolved', createdAt, closedAt, messageCount: messages.length, truncated: false, expiresAt: new Date(Date.now() + 42 * 86_400_000).toISOString() },
        canManage: true,
        messagePage: 0,
        messagePages: 1,
        messages,
      } satisfies TicketTranscriptDetailResponse);
    }
  }
  throw new ApiError(404, 'Not found', 'not_found');
}

/**
 * Demo mode: a fake bot API so the dashboard can be previewed without
 * Discord or MongoDB. Used only by `npm run build:demo`.
 */
import { ApiError } from './api';
import type { Channel, GuildListItem, GuildSettings, Me, Meta, Overview, Release, Role, RuleKind, SalvagePlayer, SectionId, SettingsPayload, SuggestionQueueResponse, SuggestionStatus, TicketTranscriptDetailResponse, TicketTranscriptListResponse } from './types';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const id = (n: number) => `13${String(n).padStart(16, '0')}`;
const avatar = (n: number) => `https://cdn.discordapp.com/embed/avatars/${n % 6}.png`;
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

let loggedIn = true;
const postedTicketPanels = new Map<string, NonNullable<SettingsPayload['postedTicketPanels']>>();
const demoSeasons = new Map<string, Array<{ seasonId: string; name: string; active: boolean; startedAt: string; endedAt: string | null; rewardRoleId: string | null; rewardTopCount: number }>>();
const demoSuggestions = new Map<string, SuggestionQueueResponse['entries']>();

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

const MODULES: Meta['modules'] = [
  { id: 'general', name: 'General', emoji: 'settings', description: 'Look and feel, update notes and modules.', toggleable: false, hasSettingsPage: true },
  { id: 'moderation', name: 'Moderation', emoji: 'shield', description: 'Warn, timeout, kick and ban with case history.', toggleable: true, hasSettingsPage: true },
  { id: 'automod', name: 'AutoMod', emoji: 'automod', description: 'Block invites, spam and bad words using Discord AutoMod.', toggleable: true, hasSettingsPage: true },
  { id: 'logging', name: 'Logging', emoji: 'log', description: 'Log edits, deletes, joins and leaves.', toggleable: true, hasSettingsPage: true },
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
  bot: { name: 'Clanky', avatar: null, online: true, version: { raw: '0.1.0-beta.12', label: 'v0.1.0 Beta 12', codename: 'Spark' }, servers: 128, members: 48_210, commands: 25, uptime: 3 * 86_400_000 + 5 * 3_600_000, ping: 42 },
  dashboard: { version: { raw: '0.1.0-alpha.6', label: 'v0.1.0 Alpha 6', codename: 'Scrapyard' } },
  game: { items: 44, zones: 4 },
  modules: MODULES,
  loginEnabled: true,
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
  { id: id(200), name: 'Scrap Collectors', icon: null, owner: false, botIn: true, memberCount: 342, inviteUrl: null },
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
  logging: { enabled: true, channelId: id(43), events: ['messageDelete', 'messageEdit', 'memberJoin', 'memberLeave', 'memberRoles', 'nickname'], ignoredChannelIds: [id(24)] },
  welcome: { enabled: true, channelId: id(11), message: 'Welcome to **{server}**, {user}! You are member **#{count}** 🎉', leaveEnabled: false, leaveMessage: '**{username}** left the server. 👋', autoRoleIds: [id(57)], showAvatar: true },
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

  if (a === 'me' && !b) return ok(me);
  if (a === 'me' && b === 'preferences') return ok({ preferences: Object.assign(me.preferences, body) });
  if (a === 'me' && b === 'salvage') return ok({ player });
  if (a === 'me' && b === 'delete') return ok(((loggedIn = false), { ok: true }));

  if (a === 'guilds' && !b) return ok(guildList);
  if (a === 'guilds' && b) {
    const g = guildList.find((x) => x.id === b);
    if (!g?.botIn) throw new ApiError(404, "Clanky isn't in that server.", 'not_found');
    if (!c) return ok(overview(b));
    const s = settingsOf(b);
    const rules = (): Record<RuleKind, boolean> => ({ invites: !!s.automod.rules.invites, mentionSpam: !!s.automod.rules.mentionSpam, spam: !!s.automod.rules.spam, keywords: !!s.automod.rules.keywords });
    if (c === 'settings' && method === 'GET') return ok({ settings: s, resources: { channels, roles }, postedTicketPanels: postedTicketPanels.get(b) ?? [], automod: { canManage: true, rules: rules() } } satisfies SettingsPayload);
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

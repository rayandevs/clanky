/**
 * Demo mode: a fake bot API so the dashboard can be previewed without
 * Discord or MongoDB. Used only by `npm run build:demo`.
 */
import { ApiError } from './api';
import type { Channel, GuildListItem, GuildSettings, Me, Meta, Overview, Release, Role, RuleKind, SalvagePlayer, SectionId, SettingsPayload } from './types';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const id = (n: number) => `13${String(n).padStart(16, '0')}`;
const avatar = (n: number) => `https://cdn.discordapp.com/embed/avatars/${n % 6}.png`;
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

let loggedIn = true;

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
  bot: { name: 'Clanky', avatar: null, online: true, version: { raw: '0.1.0-beta.7', label: 'v0.1.0 Beta 7', codename: 'Spark' }, servers: 128, members: 48_210, commands: 25, uptime: 3 * 86_400_000 + 5 * 3_600_000, ping: 42 },
  dashboard: { version: { raw: '0.1.0-alpha.1', label: 'v0.1.0 Alpha 1', codename: 'Scrapyard' } },
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
    enabled: true, parentId: id(30), logChannelId: id(44), staffRoleIds: [id(53)], maxOpenPerUser: 1,
    panelTitle: 'Need help?', panelDescription: 'Press the button below to open a private ticket with our team.',
    categories: [
      { id: 'support', label: 'General support', description: 'Questions about the server' },
      { id: 'report', label: 'Report a member', description: 'Something broke the rules' },
    ],
  },
  suggestions: { enabled: true, channelId: id(23), reviewerRoleIds: [id(52)], anonymous: false, createThreads: true },
  leveling: {
    enabled: true, announce: 'current', announceChannelId: null, message: 'GG {user}, you reached **level {level}**! ⭐', xpMin: 15, xpMax: 25, cooldownSeconds: 60,
    ignoredChannelIds: [id(24)], rewards: [{ level: 5, roleId: id(56) }, { level: 20, roleId: id(55) }, { level: 50, roleId: id(54) }], stackRewards: true,
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
    topLevels: people.slice(0, 5).map((user, i) => ({ user, level: 42 - i * 6, xp: 98_000 - i * 17_000, messages: 12_400 - i * 2_100 })),
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
    { version: '0.1.0-beta.7', date: '2026-10-15', title: 'The dashboard is here 🖥️', highlights: ['Change every setting from the web dashboard', 'See your Salvage profile, bag and collection online', 'Server overview with stats and change history'] },
    { version: '0.1.0-beta.6', date: '2026-10-15', title: 'Image screens 🖼️', highlights: ['Bag, shop and collection are now image cards', 'Your bag, credits, zone and boosts show on every game card', 'Shop buttons are numbered to match each row'] },
    { version: '0.1.0-beta.5', date: '2026-10-15', title: 'The big shop update 🛒', highlights: ['Black Market with 3 new deals every day', 'Upgrades, boosts and crates', 'Profile themes, titles and badges'] },
    { version: '0.1.0-beta.4', date: '2026-10-15', title: 'Profile cards 🪪', highlights: ['`/salvage profile` is now an image card', 'Cleaner, easier-to-read game messages'] },
  ],
  dashboard: [
    { version: '0.1.0-alpha.1', date: '2026-10-15', title: 'First light 🔦', highlights: ['Log in with Discord', 'Every server setting in one place', 'Server overview with stats and history', 'Your Salvage profile, bag and collection', 'Personal preferences'] },
  ],
};

export async function demoApi<T>(method: string, path: string, body?: unknown): Promise<T> {
  await wait(method === 'GET' ? 260 : 420);
  const parts = path.split('?')[0]!.split('/').filter(Boolean); // ['api', ...]
  const [, a, b, c, d] = parts;
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
    if (c === 'settings' && method === 'GET') return ok({ settings: s, resources: { channels, roles }, automod: { canManage: true, rules: rules() } } satisfies SettingsPayload);
    if (c === 'settings' && method === 'PATCH' && d) {
      const section = d as SectionId;
      if (section === 'leveling') {
        const l = { ...s.leveling, ...(body as object) };
        if (l.xpMin > l.xpMax) throw new ApiError(400, 'Min XP must be lower than max XP.', 'invalid');
      }
      (s as unknown as Record<string, unknown>)[section] = { ...(s[section] as object), ...(body as object), ...(section === 'automod' ? { rules: s.automod.rules } : {}) };
      return ok({ settings: s });
    }
    if (c === 'automod' && d) {
      const kind = d as RuleKind;
      const { enabled } = body as { enabled: boolean };
      if (kind === 'keywords' && enabled && !s.automod.blockedWords.length) throw new ApiError(400, 'Add some blocked words first.', 'invalid');
      s.automod.rules[kind] = enabled ? `r-${kind}` : null;
      return ok({ settings: s, rules: rules() });
    }
    if (c === 'tickets') return ok({ ok: true });
  }
  throw new ApiError(404, 'Not found', 'not_found');
}

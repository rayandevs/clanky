/* Shapes returned by the bot's dashboard API (src/dashboard/routes). */

export interface Version { raw: string; label: string; codename: string }

export interface ModuleInfo {
  id: SectionId;
  name: string;
  emoji: string;
  description: string;
  toggleable: boolean;
  hasSettingsPage: boolean;
}

export interface Meta {
  bot: { name: string; avatar: string | null; online: boolean; version: Version; servers: number; members: number; commands: number; uptime: number; ping: number };
  dashboard: { version: Version };
  game: { items: number; zones: number };
  modules: ModuleInfo[];
  loginEnabled: boolean;
  feedbackEnabled: boolean;
  inviteUrl: string;
  supportUrl: string | null;
}

export interface Release { version: string; date: string; title: string; highlights: string[] }

export interface Me {
  user: { id: string; username: string; globalName: string | null; avatar: string };
  preferences: Preferences;
  stats: { commandsUsed: number; since: string | null };
}

export interface Preferences {
  privateReplies: boolean;
  levelUpPings: boolean;
  reminderDelivery: 'dm' | 'channel';
  updateNotices: boolean;
  locale: string;
}

export interface GuildListItem {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  botIn: boolean;
  memberCount: number | null;
  inviteUrl: string | null;
  access?: 'manage' | 'logs';
}

export interface UserSummary { id: string; name: string; avatar: string }

export interface Overview {
  guild: { id: string; name: string; icon: string | null; memberCount: number; createdAt: string; joinedAt: string | null };
  modules: Array<{ id: SectionId; enabled: boolean }>;
  stats: { casesTotal: number; casesWeek: number; openTickets: number; ticketsTotal: number; pendingSuggestions: number; ranked: number };
  activity: Array<{ day: string; cases: number; tickets: number }>;
  missing: Array<{ name: string; why: string }>;
  recentCases: Array<{ caseId: number; type: string; target: string; reason: string | null; moderator: UserSummary; createdAt: string }>;
  audit: Array<{ section: string; source: 'bot' | 'dashboard' | 'system'; actor: UserSummary; createdAt: string }>;
  topChatters: Array<{ user: UserSummary; messages: number; level: number; xp: number }>;
  topPlayers: Array<{ user: UserSummary; level: number; xp: number }>;
}

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
export type LogSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'false_alarm';
export interface IncidentNote {
  actorId: string;
  action: 'note' | 'status';
  status?: IncidentStatus;
  text: string;
  createdAt: string;
}
export interface Incident {
  incidentId: string;
  title: string;
  summary: string;
  ruleId: string;
  status: IncidentStatus;
  severity: LogSeverity;
  riskScore: number;
  firstEventAt: string;
  lastEventAt: string;
  eventCount: number;
  affectedUserIds: string[];
  affectedChannelIds: string[];
  affectedRoleIds: string[];
  actorIds: string[];
  notes: IncidentNote[];
  resolvedAt: string | null;
}
export interface LoggerEvent {
  eventId: string;
  eventType: LogEvent;
  category: LogCategory;
  source: 'gateway' | 'audit_log' | 'detector';
  occurredAt: string;
  actorId: string | null;
  actorAttribution: 'self' | 'audit_log' | 'system' | 'unknown';
  targetUserId: string | null;
  channelId: string | null;
  roleId: string | null;
  messageId: string | null;
  summary: string;
  severity: LogSeverity;
  riskScore: number;
  riskReasons: string[];
  incidentId: string | null;
  evidenceHash: string;
  integrityValid: boolean;
  delivery: { status: 'pending' | 'sending' | 'delivered' | 'failed' | 'not_configured'; channelId: string | null; attempts: number; nextAttemptAt: string | null; lastError: string | null; messageId: string | null };
  evidence?: { content?: string; beforeContent?: string; attachments?: Array<{ name: string; size: number; contentType: string | null }>; changedFields?: string[]; linkCount?: number; relatedEventIds?: string[]; relatedMessageIds?: string[] };
}

export type WelcomeEvent = 'join' | 'leave';
export type WelcomeFormat = 'container' | 'text' | 'text_image' | 'image_only';
export interface WelcomeArtwork {
  template: 'celebration' | 'minimal' | 'soft';
  background: 'preset' | 'custom';
  showAvatar: boolean;
  showMemberCount: boolean;
  showServerName: boolean;
}
export interface WelcomeEventSettings {
  channelId: string | null;
  message: string;
  format: WelcomeFormat;
  pingUser: boolean;
  includeBots: boolean;
  artwork: WelcomeArtwork;
}

export interface GuildSettings {
  general: { accentColor: number; updatesChannelId: string | null };
  moderation: { enabled: boolean; logChannelId: string | null; reportsChannelId: string | null; dmOnAction: boolean; requireReason: boolean };
  logging: {
    enabled: boolean;
    channelId: string | null;
    events: LogEvent[];
    categoryChannels: Record<LogCategory, string | null>;
    ignoredChannelIds: string[];
    ignoredRoleIds: string[];
    includeBots: boolean;
    recordMessageContent: boolean;
    recordAttachments: boolean;
    detectionEnabled: boolean;
    alertRoleIds: string[];
    alertMinimumSeverity: 'medium' | 'high' | 'critical';
    viewerRoleIds: string[];
    sensitiveEvidenceRoleIds: string[];
    retentionDays: Record<LogCategory, 0 | 7 | 30 | 90 | 180 | 365>;
  };
  welcome: { enabled: boolean; join: WelcomeEventSettings; leaveEnabled: boolean; leave: WelcomeEventSettings; autoRoleIds: string[]; waitForScreening: boolean };
  tickets: {
    enabled: boolean;
    parentId: string | null;
    logChannelId: string | null;
    staffRoleIds: string[];
    maxOpenPerUser: number;
    transcriptRetentionDays: '30' | '90' | '180' | '365' | 'forever';
    categories: Array<{ id: string; label: string; description: string }>;
    panels: TicketPanel[];
  };
  suggestions: {
    enabled: boolean;
    channelId: string | null;
    reviewerRoleIds: string[];
    anonymous: boolean;
    allowAnonymousChoice: boolean;
    createThreads: boolean;
    categories: string[];
    maxOpenPerUser: number;
    cooldownSeconds: number;
    digestIntervalHours: 0 | 24 | 168;
    digestChannelId: string | null;
  };
  leveling: {
    enabled: boolean;
    announce: 'off' | 'current' | 'channel';
    announceChannelId: string | null;
    message: string;
    xpMin: number;
    xpMax: number;
    cooldownSeconds: number;
    curvePreset: 'relaxed' | 'classic' | 'challenging';
    minMessageLength: number;
    ignoredChannelIds: string[];
    channelMultipliers: Array<{ channelId: string; multiplier: number }>;
    roleMultipliers: Array<{ roleId: string; multiplier: number }>;
    rewards: Array<{ level: number; roleId: string }>;
    stackRewards: boolean;
    rankCard: { theme: 'midnight' | 'ember' | 'forest' | 'violet'; accentColor: number | null; showServerIcon: boolean; showRank: boolean; showMessages: boolean; showXp: boolean };
  };
  automod: {
    enabled: boolean;
    alertChannelId: string | null;
    mentionLimit: number;
    blockedWords: string[];
    rules: Record<RuleKind, string | null>;
  };
  roles: { enabled: boolean };
  reminders: { enabled: boolean };
  polls: { enabled: boolean };
  games: { enabled: boolean; channelIds: string[] };
}

export type SectionId = keyof GuildSettings;
export const RULE_KINDS = ['invites', 'mentionSpam', 'spam', 'keywords'] as const;
export type RuleKind = (typeof RULE_KINDS)[number];

/** Discord channel types we care about */
export const CH = { text: 0, voice: 2, category: 4, announcement: 5, stage: 13, forum: 15 } as const;

export interface Channel { id: string; name: string; type: number; parentId: string | null; position: number; canSend: boolean | null }
export interface Role { id: string; name: string; color: number; managed: boolean; assignable: boolean }

export interface SettingsPayload {
  settings: GuildSettings;
  resources: { channels: Channel[]; roles: Role[] };
  postedTicketPanels?: Array<{ panelId: string; channelId: string; messageId: string; updatedAt: string }>;
  automod: { canManage: boolean; rules: Record<RuleKind, boolean> | null };
}

export interface TicketQuestion {
  id: string;
  label: string;
  description: string;
  placeholder: string;
  style: 'short' | 'paragraph';
  required: boolean;
  minLength: number;
  maxLength: number;
}

export interface TicketPanel {
  id: string;
  title: string;
  description: string;
  questions: TicketQuestion[];
  parentId: string | null;
  logChannelId: string | null;
  staffRoleIds: string[] | null;
  artwork: { mode: 'none' | 'template' | 'custom'; template: 'support' | 'minimal' };
}

export interface TicketTranscriptEntry {
  ticketId: number;
  openerId: string;
  openerDisplayName: string;
  panelTitle: string;
  categoryLabel: string | null;
  createdAt: string;
  closedAt: string;
  messageCount: number;
  truncated: boolean;
  expiresAt: string | null;
}

export interface TicketTranscriptMessage {
  messageId: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  isBot: boolean;
  content: string;
  embeds: Array<{ title: string | null; description: string | null; fields: Array<{ name: string; value: string }> }>;
  attachments: Array<{ name: string; url: string; contentType: string | null; size: number }>;
  createdAt: string;
}

export interface TicketTranscriptDetail {
  guildId: string;
  ticketId: number;
  channelId: string;
  openerId: string;
  openerDisplayName: string;
  openerAvatarUrl: string | null;
  panelTitle: string;
  categoryLabel: string | null;
  answers: Array<{ questionId: string; label: string; answer: string }>;
  claimedBy: string | null;
  claimedByName: string | null;
  closedBy: string;
  closedByName: string | null;
  closeReason: string | null;
  createdAt: string;
  closedAt: string;
  messageCount: number;
  truncated: boolean;
  expiresAt: string | null;
}

export interface TicketTranscriptListResponse {
  guild: { id: string; name: string };
  canManage: boolean;
  total: number;
  page: number;
  pages: number;
  entries: TicketTranscriptEntry[];
}

export interface TicketTranscriptDetailResponse {
  transcript: TicketTranscriptDetail;
  canManage: boolean;
  messagePage: number;
  messagePages: number;
  messages: TicketTranscriptMessage[];
}

export type SuggestionStatus = 'pending' | 'under_review' | 'planned' | 'in_progress' | 'approved' | 'denied' | 'implemented';
export interface SuggestionQueueEntry {
  suggestionId: number;
  title: string;
  content: string;
  category: string | null;
  authorId: string;
  author: UserSummary;
  anonymous: boolean;
  status: SuggestionStatus;
  upvotes: string[];
  downvotes: string[];
  channelId: string;
  messageId: string | null;
  createdAt: string;
  updatedAt: string;
  reviewerId: string | null;
  reviewer: UserSummary | null;
  reviewNote: string | null;
  reviewHistory: Array<{ status: SuggestionStatus; note: string | null; reviewerId: string; reviewer: UserSummary; changedAt: string }>;
  postStatus: 'queued' | 'posting' | 'posted' | 'failed';
  postError: string | null;
}
export interface SuggestionQueueResponse {
  total: number;
  page: number;
  pages: number;
  entries: SuggestionQueueEntry[];
  stats: {
    byStatus: Record<SuggestionStatus, number>;
    failedPosts: number;
    oldestPendingAt: string | null;
    topSupported: Array<{ suggestionId: number; title: string; votes: number }>;
  };
}

export interface SalvagePlayer {
  level: number;
  xp: number;
  currentXp: number;
  neededXp: number;
  credits: number;
  lifetimeCredits: number;
  digs: number;
  streak: number;
  bestStreak: number;
  golemWins: number;
  rank: number | null;
  collected: number;
  collectable: number;
  shinies: number;
  cooldown: number;
  shinyOdds: number;
  zone: { id: string; name: string; emoji: string };
  tool: { id: string; name: string; emoji: string };
  title: string;
  theme: string;
  bestFind: { name: string; shiny: boolean; rarity: string; color: number; icon: string } | null;
  boosts: { luck: number; xp: number; bait: number };
  upgrades: Array<{ id: string; name: string; emoji: string; level: number; max: number }>;
  badges: Array<{ id: string; name: string; icon: string; hint: string; earned: boolean }>;
  zones: Array<{ id: string; name: string; emoji: string; level: number; unlocked: boolean; found: number; total: number }>;
}

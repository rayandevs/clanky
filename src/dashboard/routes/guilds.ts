import { createCanvas, loadImage } from '@napi-rs/canvas';
import { ChannelType, PermissionFlagsBits, type Guild, type TextChannel } from 'discord.js';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Clanky } from '../../client/Clanky.js';
import { createLogger } from '../../core/logger.js';
import { CaseModel, MemberModel, SettingsAuditModel, SuggestionModel, TicketModel, TicketPanelArtworkModel, TicketTranscriptMessageModel, TicketTranscriptModel, type SuggestionRecord, type SuggestionStatus, type TicketTranscriptRecord } from '../../database/models/index.js';
import { canManageAutomod, deleteRule, RULE_KINDS, ruleStates, syncAllRules, upsertRule, type RuleKind } from '../../modules/automod/service.js';
import { listTicketPanelMessages, publishTicketPanel } from '../../modules/tickets/panels.js';
import { MAX_TRANSCRIPT_ATTACHMENT_BYTES, readArchivedTranscriptAttachment } from '../../modules/tickets/attachmentArchive.js';
import { guilds, levels, salvage } from '../../services/index.js';
import { desiredRewardRoleIds } from '../../modules/leveling/handler.js';
import { SuggestionActionError, publishSuggestion, reviewSuggestion, SUGGESTION_STATUS_KEYS, syncSuggestionPost } from '../../modules/suggestions/service.js';
import { isSuggestionAnonymous } from '../../modules/suggestions/privacy.js';
import { MODULES } from '../../settings/registry.js';
import { GuildSettingsSchema, type GuildSettings, type SettingsSection } from '../../settings/schema.js';
import { canManage, inviteUrl, managedGuild } from '../access.js';
import { AuthError, requireUser } from '../auth.js';
import { discordApi, DiscordHttpError } from '../discord.js';
import { userSummary } from '../people.js';

const log = createLogger('dashboard');

const SECTIONS = Object.keys(GuildSettingsSchema.shape) as SettingsSection[];
const DAY = 86_400_000;
const MAX_PANEL_ART = 4 * 1024 * 1024;
const MAX_PANEL_ART_PIXELS = 12_000_000;
const MAX_PANEL_ART_DIMENSION = 4096;
const MAX_PANEL_ART_PNG = 8 * 1024 * 1024;
const TRANSCRIPT_PAGE_SIZE = 20;
const TRANSCRIPT_MESSAGE_PAGE_SIZE = 50;

const iconUrl = (id: string, icon: string | null) => (icon ? `https://cdn.discordapp.com/icons/${id}/${icon}.${icon.startsWith('a_') ? 'gif' : 'png'}?size=128` : null);

/** Permissions each module needs to work well. Shown as setup tips. */
const NEEDED: Array<{ flag: bigint; name: string; why: string }> = [
  { flag: PermissionFlagsBits.ManageGuild, name: 'Manage Server', why: 'AutoMod rules' },
  { flag: PermissionFlagsBits.ModerateMembers, name: 'Timeout Members', why: 'Timeouts' },
  { flag: PermissionFlagsBits.KickMembers, name: 'Kick Members', why: 'Kicks' },
  { flag: PermissionFlagsBits.BanMembers, name: 'Ban Members', why: 'Bans' },
  { flag: PermissionFlagsBits.ManageChannels, name: 'Manage Channels', why: 'Tickets' },
  { flag: PermissionFlagsBits.ManageRoles, name: 'Manage Roles', why: 'Auto roles and level rewards' },
  { flag: PermissionFlagsBits.ManageMessages, name: 'Manage Messages', why: 'Purge' },
  { flag: PermissionFlagsBits.CreatePublicThreads, name: 'Create Threads', why: 'Suggestion threads' },
];

const TEXT_TYPES = new Set([ChannelType.GuildText, ChannelType.GuildAnnouncement]);

function resources(guild: Guild) {
  const me = guild.members.me;
  const top = me?.roles.highest.position ?? 0;
  const channels = [...guild.channels.cache.values()]
    .filter((c) => !c.isThread())
    .map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      parentId: c.parentId,
      position: 'rawPosition' in c ? c.rawPosition : 0,
      canSend: TEXT_TYPES.has(c.type) ? Boolean(me && c.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages)) : null,
    }))
    .sort((a, b) => a.position - b.position);
  const roles = [...guild.roles.cache.values()]
    .filter((r) => r.id !== guild.id)
    .sort((a, b) => b.position - a.position)
    .map((r) => ({ id: r.id, name: r.name, color: r.color, managed: r.managed, assignable: !r.managed && r.position < top }));
  return { channels, roles };
}

async function ticketTranscriptAccess(client: Clanky, request: FastifyRequest, reply: FastifyReply) {
  const { guildId } = request.params as { guildId: string };
  const guild = /^\d{17,20}$/.test(guildId) ? client.guilds.cache.get(guildId) : undefined;
  if (!guild) {
    reply.code(404).send({ error: 'not_found', message: "Clanky isn't in that server." });
    return null;
  }
  const member = await guild.members.fetch(request.session!.record.userId).catch(() => null);
  if (!member) {
    reply.code(403).send({ error: 'forbidden', message: 'You need to be a server administrator or have a configured ticket staff role.' });
    return null;
  }
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return { guild, member, isAdmin: true, memberRoleIds: [...member.roles.cache.keys()] };

  const settings = await guilds.settings(guild.id);
  const configured = new Set(settings.tickets.staffRoleIds);
  for (const panel of settings.tickets.panels) {
    for (const roleId of panel.staffRoleIds ?? settings.tickets.staffRoleIds) configured.add(roleId);
  }
  const memberRoleIds = [...member.roles.cache.keys()];
  if (!memberRoleIds.some((roleId) => configured.has(roleId))) {
    reply.code(403).send({ error: 'forbidden', message: 'You need a configured ticket staff role to view transcripts.' });
    return null;
  }
  return { guild, member, isAdmin: false, memberRoleIds };
}

const transcriptExpiryFilter = () => ({ $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }] });
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Every channel/role ID in a section must exist in the server. */
function checkIds(guild: Guild, section: SettingsSection, value: unknown): string | null {
  const bad: string[] = [];
  const walk = (node: unknown, key: string) => {
    if (Array.isArray(node)) return node.forEach((v) => walk(v, key));
    if (node && typeof node === 'object') return Object.entries(node).forEach(([k, v]) => walk(v, k));
    if (typeof node !== 'string' || !/^\d{17,20}$/.test(node)) return;
    if (/channel|parent/i.test(key) && !guild.channels.cache.has(node)) bad.push(`channel ${node}`);
    if (/role/i.test(key) && !guild.roles.cache.has(node)) bad.push(`role ${node}`);
  };
  walk(section === 'automod' ? { ...(value as object), rules: null } : value, section);
  return bad.length ? `Unknown ${bad.slice(0, 3).join(', ')}` : null;
}

export async function guildRoutes(app: FastifyInstance, client: Clanky) {
  app.addHook('preHandler', requireUser);

  /** Servers the user can manage, with or without Clanky. */
  app.get('/api/guilds', async (request, reply) => {
    const session = request.session!;
    const fresh = (request.query as { fresh?: string }).fresh === '1';
    try {
      const list = await discordApi.guilds(session.record.userId, await session.accessToken(), fresh);
      return list
        .filter(canManage)
        .map((g) => {
          const live = client.guilds.cache.get(g.id);
          return {
            id: g.id,
            name: g.name,
            icon: iconUrl(g.id, g.icon),
            owner: g.owner,
            botIn: Boolean(live),
            memberCount: live?.memberCount ?? null,
            inviteUrl: live ? null : inviteUrl(g.id),
          };
        })
        .sort((a, b) => Number(b.botIn) - Number(a.botIn) || a.name.localeCompare(b.name));
    } catch (error) {
      if (error instanceof AuthError || (error instanceof DiscordHttpError && error.status === 401)) throw new AuthError();
      log.warn('Could not load guild list', error);
      return reply.code(502).send({ error: 'discord', message: "Couldn't reach Discord. Try again in a moment." });
    }
  });

  app.get('/api/guilds/:guildId', async (request, reply) => {
    const access = await managedGuild(client, request, reply);
    if (!access) return;
    const { guild } = access;
    const settings = await guilds.settings(guild.id);
    const record = await guilds.get(guild.id);
    const since = new Date(Date.now() - 14 * DAY);

    const [casesTotal, casesWeek, openTickets, pendingSuggestions, ranked, casesByDay, ticketsByDay, recentCases, audit, topChatters, board] =
      await Promise.all([
        CaseModel.countDocuments({ guildId: guild.id }),
        CaseModel.countDocuments({ guildId: guild.id, createdAt: { $gte: new Date(Date.now() - 7 * DAY) } }),
        TicketModel.countDocuments({ guildId: guild.id, status: 'open' }),
        SuggestionModel.countDocuments({ guildId: guild.id, status: 'pending' }),
        MemberModel.countDocuments({ guildId: guild.id, xp: { $gt: 0 } }),
        perDay(CaseModel, guild.id, since),
        perDay(TicketModel, guild.id, since),
        CaseModel.find({ guildId: guild.id }).sort({ createdAt: -1 }).limit(6).lean(),
        SettingsAuditModel.find({ guildId: guild.id }).sort({ createdAt: -1 }).limit(8).lean(),
        MemberModel.find({ guildId: guild.id, messages: { $gt: 0 } }).sort({ messages: -1 }).limit(5).lean(),
        salvage.leaderboard(guild.id, 0, 5),
      ]);

    const missing = NEEDED.filter((p) => !guild.members.me?.permissions.has(p.flag)).map(({ name, why }) => ({ name, why }));

    return {
      guild: {
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL({ size: 128 }),
        memberCount: guild.memberCount,
        createdAt: guild.createdAt,
        joinedAt: guild.members.me?.joinedAt ?? record.joinedAt,
      },
      modules: MODULES.filter((m) => m.toggleable).map((m) => ({ id: m.id, enabled: (settings[m.id] as { enabled?: boolean }).enabled ?? true })),
      stats: { casesTotal, casesWeek, openTickets, ticketsTotal: record.counters.tickets, pendingSuggestions, ranked },
      activity: buildDays(since, casesByDay, ticketsByDay),
      missing,
      recentCases: await Promise.all(
        recentCases.map(async (c) => ({ caseId: c.caseId, type: c.type, target: c.targetTag, reason: c.reason, moderator: await userSummary(client, c.moderatorId), createdAt: c.createdAt })),
      ),
      audit: await Promise.all(
        audit.map(async (a) => ({ section: a.section, source: a.source, actor: await userSummary(client, a.actorId), createdAt: a.createdAt })),
      ),
      topChatters: await Promise.all(topChatters.map(async (m) => ({ user: await userSummary(client, m.userId), messages: m.messages, level: m.level, xp: m.xp }))),
      topPlayers: await Promise.all(board.entries.map(async (p) => ({ user: await userSummary(client, p.userId), level: p.level, xp: p.xp }))),
    };
  });

  app.get('/api/guilds/:guildId/settings', async (request, reply) => {
    const access = await managedGuild(client, request, reply);
    if (!access) return;
    const { guild } = access;
    const settings = await guilds.settings(guild.id);
    const canAutomod = canManageAutomod(guild);
    return {
      settings,
      resources: resources(guild),
      postedTicketPanels: await listTicketPanelMessages(guild.id),
      automod: { canManage: canAutomod, rules: canAutomod ? await ruleStates(guild, settings).catch(() => null) : null },
    };
  });

  app.patch('/api/guilds/:guildId/settings/:section', async (request, reply) => {
    const access = await managedGuild(client, request, reply);
    if (!access) return;
    const { guild, member } = access;
    const section = (request.params as { section: string }).section as SettingsSection;
    if (!SECTIONS.includes(section)) return reply.code(404).send({ error: 'not_found', message: 'Unknown settings section.' });

    const current = await guilds.settings(guild.id);
    const body = { ...(current[section] as object), ...(request.body as object) };
    if (section === 'automod') (body as GuildSettings['automod']).rules = current.automod.rules;

    const parsed = GuildSettingsSchema.shape[section].safeParse(body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid', message: 'Some values are not valid.', issues: z.flattenError(parsed.error as z.ZodError).fieldErrors });
    }
    const value = parsed.data as GuildSettings[typeof section];
    if (section === 'tickets') {
      const ticketSettings = value as GuildSettings['tickets'];
      const customPanels = ticketSettings.panels.filter((panel) => panel.artwork.mode === 'custom');
      for (const panel of customPanels) {
        const image = await TicketPanelArtworkModel.exists({ guildId: guild.id, panelId: panel.id });
        if (!image) return reply.code(400).send({ error: 'invalid', message: `Upload an image for “${panel.title}” before selecting custom artwork.` });
      }
    }
    if (section === 'leveling') {
      const l = value as GuildSettings['leveling'];
      if (l.xpMin > l.xpMax) return reply.code(400).send({ error: 'invalid', message: 'Min XP must be lower than max XP.' });
    }
    const idProblem = checkIds(guild, section, value);
    if (idProblem) return reply.code(400).send({ error: 'invalid', message: idProblem });

    const next = await guilds.update(guild.id, (draft) => void ((draft as Record<string, unknown>)[section] = value), { id: member.id, source: 'dashboard' });

    // Keep native AutoMod rules in sync with the new words, limits and alert channel.
    if (section === 'automod' && canManageAutomod(guild)) {
      if (!next.automod.blockedWords.length && next.automod.rules.keywords) {
        await deleteRule(guild, next, 'keywords').catch(() => null);
        await guilds.update(guild.id, (d) => void (d.automod.rules.keywords = null), { id: member.id, source: 'dashboard' });
      }
      await syncAllRules(guild, await guilds.settings(guild.id));
    }
    return { settings: await guilds.settings(guild.id) };
  });

  app.get('/api/guilds/:guildId/suggestions', async (request, reply) => {
    const access = await managedGuild(client, request, reply);
    if (!access) return;
    const query = z.object({ page: z.coerce.number().int().min(0).max(10_000).default(0), q: z.string().trim().max(80).default(''), status: z.string().default('all'), sort: z.enum(['newest', 'oldest', 'votes']).default('newest') }).safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: 'invalid', message: 'Invalid suggestion queue filters.' });
    const statuses = SUGGESTION_STATUS_KEYS;
    const { page, q, status: statusFilter, sort } = query.data;
    if (statusFilter !== 'all' && statusFilter !== 'failed' && !statuses.includes(statusFilter as SuggestionStatus)) return reply.code(400).send({ error: 'invalid', message: 'Unknown suggestion status.' });
    const terms: object[] = [];
    if (statusFilter === 'failed') terms.push({ $or: [{ postStatus: 'failed' }, { postStatus: { $exists: false }, messageId: null }] });
    else if (statusFilter !== 'all') terms.push({ status: statusFilter });
    if (q) {
      const numericId = /^#?\d+$/.test(q) ? Number(q.replace(/^#/, '')) : null;
      terms.push(numericId !== null ? { suggestionId: numericId } : { $or: ['title', 'content', 'category'].map((key) => ({ [key]: { $regex: escapeRegex(q), $options: 'i' } })) });
    }
    const filter = { guildId: access.guild.id, ...(terms.length ? { $and: terms } : {}) };
    const [total, rows, statusRows, failedPosts, oldest, topSupported] = await Promise.all([
      SuggestionModel.countDocuments(filter),
      sort === 'votes'
        ? SuggestionModel.aggregate([{ $match: filter }, { $addFields: { voteCount: { $add: [{ $size: { $ifNull: ['$upvotes', []] } }, { $size: { $ifNull: ['$downvotes', []] } }] } } }, { $sort: { voteCount: -1, createdAt: -1 } }, { $skip: page * 20 }, { $limit: 20 }]).exec()
        : SuggestionModel.find(filter).sort({ createdAt: sort === 'oldest' ? 1 : -1, suggestionId: sort === 'oldest' ? 1 : -1 }).skip(page * 20).limit(20).lean(),
      SuggestionModel.aggregate([{ $match: { guildId: access.guild.id } }, { $group: { _id: '$status', count: { $sum: 1 } } }]).exec(),
      SuggestionModel.countDocuments({ guildId: access.guild.id, $or: [{ postStatus: 'failed' }, { postStatus: { $exists: false }, messageId: null }] }),
      SuggestionModel.findOne({ guildId: access.guild.id, status: 'pending', $or: [{ postStatus: 'posted' }, { postStatus: { $exists: false }, messageId: { $ne: null } }] }).sort({ createdAt: 1 }).select({ createdAt: 1 }).lean<{ createdAt: Date }>(),
      SuggestionModel.aggregate([{ $match: { guildId: access.guild.id, status: { $in: ['pending', 'under_review', 'planned', 'in_progress'] }, $or: [{ postStatus: 'posted' }, { postStatus: { $exists: false }, messageId: { $ne: null } }] } }, { $addFields: { voteCount: { $add: [{ $size: { $ifNull: ['$upvotes', []] } }, { $size: { $ifNull: ['$downvotes', []] } }] } } }, { $sort: { voteCount: -1, createdAt: -1 } }, { $limit: 3 }, { $project: { _id: 0, suggestionId: 1, title: 1, votes: '$voteCount' } }]).exec(),
    ]);
    const byStatus = Object.fromEntries(statuses.map((status) => [status, 0])) as Record<SuggestionStatus, number>;
    for (const item of statusRows as Array<{ _id: SuggestionStatus; count: number }>) if (item._id in byStatus) byStatus[item._id] = item.count;
    const userCache = new Map<string, ReturnType<typeof userSummary>>();
    const summary = (id: string) => {
      let value = userCache.get(id);
      if (!value) { value = userSummary(client, id); userCache.set(id, value); }
      return value;
    };
    const entries = await Promise.all((rows as unknown as Array<SuggestionRecord & { voteCount?: number }>).map(async (item) => {
      const history = (item.reviewHistory ?? []).slice(-10);
      return {
        suggestionId: item.suggestionId,
        title: item.title,
        content: item.content,
        category: item.category ?? null,
        authorId: item.authorId,
        author: await summary(item.authorId),
        anonymous: isSuggestionAnonymous(item.anonymous),
        status: item.status as SuggestionStatus,
        upvotes: item.upvotes ?? [],
        downvotes: item.downvotes ?? [],
        channelId: item.channelId,
        messageId: item.messageId ?? null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        reviewerId: item.reviewerId ?? null,
        reviewer: item.reviewerId ? await summary(item.reviewerId) : null,
        reviewNote: item.reviewNote ?? null,
        reviewHistory: await Promise.all(history.map(async (event: { status: SuggestionStatus; note: string | null; reviewerId: string; changedAt: Date }) => ({ ...event, reviewer: await summary(event.reviewerId) }))),
        postStatus: item.postStatus ?? (item.messageId ? 'posted' : 'failed'),
        postError: item.postError ?? null,
      };
    }));
    return {
      total,
      page,
      pages: Math.max(1, Math.ceil(total / 20)),
      entries,
      stats: { byStatus, failedPosts, oldestPendingAt: oldest?.createdAt ?? null, topSupported },
    };
  });

  app.post('/api/guilds/:guildId/suggestions/:suggestionId/review', async (request, reply) => {
    const access = await managedGuild(client, request, reply);
    if (!access) return;
    const { suggestionId: rawId } = request.params as { suggestionId: string };
    const suggestionId = Number(rawId);
    if (!Number.isSafeInteger(suggestionId) || suggestionId < 1) return reply.code(400).send({ error: 'invalid', message: 'Invalid suggestion number.' });
    const parsed = z.object({ status: z.enum(['pending', 'under_review', 'planned', 'in_progress', 'approved', 'denied', 'implemented']), note: z.string().trim().max(500).default('') }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid', message: 'Choose a valid status and a note under 500 characters.' });
    try {
      const result = await reviewSuggestion(client, access.guild.id, suggestionId, access.member.id, parsed.data.status, parsed.data.note || null, await guilds.settings(access.guild.id));
      return { ok: true, postSynced: result.postSynced };
    } catch (error) {
      if (error instanceof SuggestionActionError) return reply.code(error.code === 'not_found' ? 404 : error.code === 'conflict' ? 409 : 400).send({ error: error.code, message: error.message });
      throw error;
    }
  });

  app.post('/api/guilds/:guildId/suggestions/:suggestionId/retry', async (request, reply) => {
    const access = await managedGuild(client, request, reply);
    if (!access) return;
    const { suggestionId: rawId } = request.params as { suggestionId: string };
    const suggestionId = Number(rawId);
    if (!Number.isSafeInteger(suggestionId) || suggestionId < 1) return reply.code(400).send({ error: 'invalid', message: 'Invalid suggestion number.' });
    const current = await SuggestionModel.findOne({ guildId: access.guild.id, suggestionId }).lean<SuggestionRecord>();
    if (!current) return reply.code(404).send({ error: 'not_found', message: 'That suggestion no longer exists.' });
    const settings = await guilds.settings(access.guild.id);
    if (current.messageId && current.postStatus === 'posted') {
      const synced = await syncSuggestionPost(client, current, settings).catch(() => false);
      if (synced) return { ok: true, result: 'refreshed' };
      await SuggestionModel.updateOne({ guildId: access.guild.id, suggestionId }, { $set: { postStatus: 'failed', postError: 'The previous Discord message is missing. Repost it here.' } });
    }
    try {
      await publishSuggestion(client, access.guild.id, suggestionId);
      return { ok: true, result: 'posted' };
    } catch (error) {
      return reply.code(502).send({ error: 'discord', message: error instanceof Error ? error.message : "Couldn't post the suggestion to Discord." });
    }
  });

  app.get('/api/guilds/:guildId/leveling/analytics', async (request, reply) => {
    const access = await managedGuild(client, request, reply);
    if (!access) return;
    const { days = 14 } = z.object({ days: z.coerce.number().int().min(7).max(90).default(14) }).parse(request.query);
    const [analytics, seasons, seasonalBoard] = await Promise.all([
      levels.analytics(access.guild.id, days),
      levels.listSeasons(access.guild.id, 5),
      levels.seasonLeaderboard(access.guild.id, 0, 10),
    ]);
    return {
      ...analytics,
      topGainers: await Promise.all(analytics.topGainers.map(async (row) => ({ ...row, user: await userSummary(client, row.userId) }))),
      seasons,
      seasonLeaderboard: {
        season: seasonalBoard.season,
        total: seasonalBoard.total,
        entries: await Promise.all(seasonalBoard.entries.map(async (entry, index) => ({ rank: index + 1, xp: entry.xp, user: await userSummary(client, entry.userId) }))),
      },
    };
  });

  app.post('/api/guilds/:guildId/leveling/seasons', async (request, reply) => {
    const access = await managedGuild(client, request, reply);
    if (!access) return;
    const body = z.object({ name: z.string().trim().min(1).max(80), rewardRoleId: z.string().regex(/^\d{17,20}$/).nullable().default(null), rewardTopCount: z.number().int().min(1).max(100).default(3) }).parse(request.body);
    if (body.rewardRoleId) {
      const role = access.guild.roles.cache.get(body.rewardRoleId);
      if (!role || role.managed || !access.guild.members.me || role.position >= access.guild.members.me.roles.highest.position) {
        return reply.code(400).send({ error: 'invalid', message: 'Choose a reward role Clanky can assign.' });
      }
    }
    try {
      const season = await levels.startSeason(access.guild.id, body.name, access.member.id, body.rewardRoleId, body.rewardTopCount);
      return { season };
    } catch (error) {
      if (error instanceof Error && error.message.includes('already active')) return reply.code(409).send({ error: 'conflict', message: error.message });
      throw error;
    }
  });

  app.post('/api/guilds/:guildId/leveling/seasons/end', async (request, reply) => {
    const access = await managedGuild(client, request, reply);
    if (!access) return;
    const { confirm } = z.object({ confirm: z.literal(true) }).parse(request.body);
    void confirm;
    const season = await levels.endSeason(access.guild.id);
    if (!season) return reply.code(404).send({ error: 'not_found', message: 'There is no active season to end.' });
    return { season };
  });

  app.post('/api/guilds/:guildId/leveling/season-rewards/preview', async (request, reply) => {
    const access = await managedGuild(client, request, reply);
    if (!access) return;
    const { seasonId } = z.object({ seasonId: z.string().uuid() }).parse(request.body);
    const season = await levels.seasonLeaderboard(access.guild.id, 0, 100, seasonId);
    if (!season.season || season.season.active) return reply.code(400).send({ error: 'invalid', message: 'End the season before reviewing winner rewards.' });
    const winners = await levels.seasonRewardsPreview(access.guild.id, seasonId, season.season.rewardTopCount);
    return { season: season.season, winners: await Promise.all(winners.map(async (winner) => ({ ...winner, user: await userSummary(client, winner.userId) }))) };
  });

  app.post('/api/guilds/:guildId/leveling/season-rewards/grant', async (request, reply) => {
    const access = await managedGuild(client, request, reply);
    if (!access) return;
    const { seasonId, confirm } = z.object({ seasonId: z.string().uuid(), confirm: z.literal(true) }).parse(request.body);
    const season = await levels.seasonLeaderboard(access.guild.id, 0, 100, seasonId);
    if (!season.season || season.season.active) return reply.code(400).send({ error: 'invalid', message: 'End the season before granting rewards.' });
    if (!season.season.rewardRoleId) return reply.code(400).send({ error: 'invalid', message: 'No winner role was configured for this season.' });
    if (!access.guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) return reply.code(400).send({ error: 'permissions', message: 'Clanky needs Manage Roles to grant season rewards.' });
    const role = access.guild.roles.cache.get(season.season.rewardRoleId);
    if (!role || role.managed || role.position >= access.guild.members.me.roles.highest.position) return reply.code(400).send({ error: 'invalid', message: 'The configured winner role is no longer assignable.' });
    const winners = await levels.seasonRewardsPreview(access.guild.id, seasonId, season.season.rewardTopCount);
    let granted = 0;
    for (const winner of winners) {
      const member = await access.guild.members.fetch(winner.userId).catch(() => null);
      if (!member || member.roles.cache.has(role.id)) continue;
      await member.roles.add(role, `Season winner: ${season.season.name}`).then(() => granted++).catch((error) => log.warn('Could not grant a season reward role', error));
    }
    void confirm;
    return { granted, winners: winners.length };
  });

  app.post('/api/guilds/:guildId/leveling/rewards/preview', async (request, reply) => {
    const access = await managedGuild(client, request, reply);
    if (!access) return;
    const settings = await guilds.settings(access.guild.id);
    const botMember = access.guild.members.me;
    const roleIds = new Set(settings.leveling.rewards.map((reward) => reward.roleId));
    const rolesNotAssignable = [...roleIds].filter((id) => {
      const role = access.guild.roles.cache.get(id);
      return !role || role.managed || !botMember || role.position >= botMember.roles.highest.position;
    });
    const records = await MemberModel.find({ guildId: access.guild.id, xp: { $gt: 0 } }).select({ userId: 1, level: 1 }).sort({ level: -1 }).lean();
    const operations: Array<{ userId: string; add: string[]; remove: string[] }> = [];
    const members = new Map<string, import('discord.js').GuildMember>();
    for (let index = 0; index < records.length; index += 100) {
      const batch = records.slice(index, index + 100);
      const fetched = await access.guild.members.fetch({ user: batch.map((record) => record.userId) }).catch(() => null);
      fetched?.forEach((member) => members.set(member.id, member));
    }
    let skipped = 0;
    for (const record of records) {
      const member = members.get(record.userId);
      if (!member) { skipped++; continue; }
      const desired = new Set(desiredRewardRoleIds(record.level, settings));
      const assignable = (id: string) => {
        const role = access.guild.roles.cache.get(id);
        return Boolean(role && !role.managed && botMember && role.position < botMember.roles.highest.position);
      };
      const add = [...desired].filter((id) => assignable(id) && !member.roles.cache.has(id));
      const remove = [...roleIds].filter((id) => assignable(id) && !desired.has(id) && member.roles.cache.has(id));
      if (add.length || remove.length) operations.push({ userId: member.id, add, remove });
    }
    return { membersChecked: records.length, membersSkipped: skipped, membersChanged: operations.length, rolesAdded: operations.reduce((sum, item) => sum + item.add.length, 0), rolesRemoved: operations.reduce((sum, item) => sum + item.remove.length, 0), rolesNotAssignable, changes: operations.slice(0, 10) };
  });

  app.post('/api/guilds/:guildId/leveling/rewards/sync', async (request, reply) => {
    const access = await managedGuild(client, request, reply);
    if (!access) return;
    const { confirm } = z.object({ confirm: z.literal(true) }).parse(request.body);
    void confirm;
    if (!access.guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) return reply.code(400).send({ error: 'permissions', message: 'Clanky needs Manage Roles to synchronize reward roles.' });
    const settings = await guilds.settings(access.guild.id);
    const botMember = access.guild.members.me;
    const roles = new Set(settings.leveling.rewards.map((reward) => reward.roleId));
    const records = await MemberModel.find({ guildId: access.guild.id, xp: { $gt: 0 } }).select({ userId: 1, level: 1 }).lean();
    const members = new Map<string, import('discord.js').GuildMember>();
    for (let index = 0; index < records.length; index += 100) {
      const fetched = await access.guild.members.fetch({ user: records.slice(index, index + 100).map((record) => record.userId) }).catch(() => null);
      fetched?.forEach((member) => members.set(member.id, member));
    }
    let membersChanged = 0;
    let rolesAdded = 0;
    let rolesRemoved = 0;
    let membersSkipped = 0;
    for (const record of records) {
      const member = members.get(record.userId);
      if (!member) { membersSkipped++; continue; }
      const desired = new Set(desiredRewardRoleIds(record.level, settings));
      const canManage = (id: string) => {
        const role = access.guild.roles.cache.get(id);
        return Boolean(role && !role.managed && botMember && role.position < botMember.roles.highest.position);
      };
      const add = [...desired].filter((id) => canManage(id) && !member.roles.cache.has(id));
      const remove = [...roles].filter((id) => canManage(id) && !desired.has(id) && member.roles.cache.has(id));
      if (!add.length && !remove.length) continue;
      if (add.length) await member.roles.add(add, 'Synchronize configured leveling rewards').then(() => { rolesAdded += add.length; }).catch((error) => log.warn('Could not add a synchronized level reward', error));
      if (remove.length) await member.roles.remove(remove, 'Synchronize configured leveling rewards').then(() => { rolesRemoved += remove.length; }).catch((error) => log.warn('Could not remove a synchronized level reward', error));
      membersChanged++;
    }
    void confirm;
    return { membersChanged, rolesAdded, rolesRemoved, membersSkipped };
  });

  app.post('/api/guilds/:guildId/automod/:kind', async (request, reply) => {
    const access = await managedGuild(client, request, reply);
    if (!access) return;
    const { guild, member } = access;
    const kind = (request.params as { kind: string }).kind as RuleKind;
    const { enabled } = z.object({ enabled: z.boolean() }).parse(request.body);
    if (!RULE_KINDS.includes(kind)) return reply.code(404).send({ error: 'not_found', message: 'Unknown rule.' });
    if (!canManageAutomod(guild)) return reply.code(400).send({ error: 'permissions', message: 'Clanky needs the Manage Server permission for AutoMod.' });

    const settings = await guilds.settings(guild.id);
    if (kind === 'keywords' && enabled && !settings.automod.blockedWords.length) {
      return reply.code(400).send({ error: 'invalid', message: 'Add some blocked words first.' });
    }
    try {
      if (enabled) {
        const id = await upsertRule(guild, settings, kind);
        await guilds.update(guild.id, (d) => void (d.automod.rules[kind] = id), { id: member.id, source: 'dashboard' });
      } else {
        await deleteRule(guild, settings, kind);
        await guilds.update(guild.id, (d) => void (d.automod.rules[kind] = null), { id: member.id, source: 'dashboard' });
      }
    } catch (error) {
      log.warn(`AutoMod ${kind} failed in ${guild.id}`, error);
      return reply.code(502).send({ error: 'discord', message: "Discord didn't accept that rule. Check Clanky's permissions." });
    }
    const next = await guilds.settings(guild.id);
    return { settings: next, rules: await ruleStates(guild, next).catch(() => null) };
  });

  app.post('/api/guilds/:guildId/tickets/panel', async (request, reply) => {
    const access = await managedGuild(client, request, reply);
    if (!access) return;
    const { guild } = access;
    const { channelId, panelId, mode } = z.object({
      channelId: z.string().regex(/^\d{17,20}$/),
      panelId: z.string().min(1).max(20),
      mode: z.enum(['publish', 'update']).default('publish'),
    }).parse(request.body);
    const channel = guild.channels.cache.get(channelId);
    if (!channel?.isSendable() || !TEXT_TYPES.has(channel.type)) return reply.code(400).send({ error: 'invalid', message: 'Pick a text channel.' });
    const settings = await guilds.settings(guild.id);
    const panel = settings.tickets.panels.find((item) => item.id === panelId);
    if (!panel) return reply.code(404).send({ error: 'not_found', message: 'That ticket panel no longer exists.' });
    try {
      const result = await publishTicketPanel(channel as TextChannel, settings, panel, mode);
      if (result === 'missing') return reply.code(404).send({ error: 'not_found', message: 'No tracked panel exists in that channel to update.' });
      return { ok: true, result };
    } catch {
      return reply.code(400).send({ error: 'permissions', message: "Clanky can't post in that channel." });
    }
  });

  app.post('/api/guilds/:guildId/tickets/panels/:panelId/artwork', async (request, reply) => {
    const access = await managedGuild(client, request, reply);
    if (!access) return;
    const { guild, member } = access;
    const { panelId } = request.params as { panelId: string };
    const panel = (await guilds.settings(guild.id)).tickets.panels.find((item) => item.id === panelId);
    if (!panel) return reply.code(404).send({ error: 'not_found', message: 'That ticket panel no longer exists.' });
    const raw = request.body;
    if (!Buffer.isBuffer(raw) || raw.length === 0 || raw.length > MAX_PANEL_ART) {
      return reply.code(400).send({ error: 'invalid', message: 'Choose an image under 4 MiB.' });
    }
    let image;
    try {
      image = await loadImage(raw);
    } catch {
      return reply.code(400).send({ error: 'invalid', message: 'That file is not a supported image.' });
    }
    if (!image.width || !image.height || image.width > MAX_PANEL_ART_DIMENSION || image.height > MAX_PANEL_ART_DIMENSION || image.width * image.height > MAX_PANEL_ART_PIXELS) {
      return reply.code(400).send({ error: 'invalid', message: 'Image dimensions must be at most 4096×4096 and 12 megapixels.' });
    }
    const scale = Math.min(1, 1600 / image.width, 900 / image.height);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = createCanvas(width, height);
    canvas.getContext('2d').drawImage(image, 0, 0, width, height);
    const normalized = canvas.toBuffer('image/png');
    if (normalized.length > MAX_PANEL_ART_PNG) return reply.code(400).send({ error: 'invalid', message: 'The optimized image is too large. Try a smaller or simpler image.' });
    await TicketPanelArtworkModel.findOneAndUpdate(
      { guildId: guild.id, panelId },
      { $set: { guildId: guild.id, panelId, contentType: 'image/png', data: normalized, uploadedBy: member.id } },
      { upsert: true, returnDocument: 'after' },
    );
    return { ok: true, contentType: 'image/png', width, height };
  });

  app.get('/api/guilds/:guildId/tickets/panels/:panelId/artwork', async (request, reply) => {
    const access = await managedGuild(client, request, reply);
    if (!access) return;
    const { panelId } = request.params as { panelId: string };
    const asset = await TicketPanelArtworkModel.findOne({ guildId: access.guild.id, panelId }).lean();
    if (!asset) return reply.code(404).send({ error: 'not_found', message: 'This panel has no uploaded image.' });
    return reply.type('image/png').header('Cache-Control', 'private, max-age=60').send(Buffer.from(asset.data));
  });

  app.get('/api/guilds/:guildId/tickets/transcripts', async (request, reply) => {
    const access = await ticketTranscriptAccess(client, request, reply);
    if (!access) return;
    const query = request.query as { page?: string; q?: string };
    const page = Math.max(0, Math.min(10_000, Number(query.page) || 0));
    const search = (query.q ?? '').trim().slice(0, 80);
    const terms: object[] = [transcriptExpiryFilter()];
    if (!access.isAdmin) terms.push({ staffRoleIds: { $in: access.memberRoleIds } });
    if (search) {
      const numericTicket = /^#?\d+$/.test(search) ? Number(search.replace(/^#/, '')) : null;
      terms.push(numericTicket !== null
        ? { ticketId: numericTicket }
        : { $or: ['openerDisplayName', 'panelTitle', 'categoryLabel'].map((key) => ({ [key]: { $regex: escapeRegex(search), $options: 'i' } })) });
    }
    const filter = { guildId: access.guild.id, $and: terms };
    const [total, rows] = await Promise.all([
      TicketTranscriptModel.countDocuments(filter),
      TicketTranscriptModel.find(filter).sort({ closedAt: -1, ticketId: -1 }).skip(page * TRANSCRIPT_PAGE_SIZE).limit(TRANSCRIPT_PAGE_SIZE).lean<TicketTranscriptRecord[]>(),
    ]);
    return {
      guild: { id: access.guild.id, name: access.guild.name },
      canManage: access.isAdmin,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / TRANSCRIPT_PAGE_SIZE)),
      entries: rows.map((row) => ({
        ticketId: row.ticketId,
        openerId: row.openerId,
        openerDisplayName: row.openerDisplayName,
        panelTitle: row.panelTitle,
        categoryLabel: row.categoryLabel,
        createdAt: row.createdAt,
        closedAt: row.closedAt,
        messageCount: row.messageCount,
        truncated: row.truncated,
        expiresAt: row.expiresAt,
      })),
    };
  });

  app.get('/api/guilds/:guildId/tickets/transcripts/:ticketId', async (request, reply) => {
    const access = await ticketTranscriptAccess(client, request, reply);
    if (!access) return;
    const { ticketId: rawTicketId } = request.params as { ticketId: string };
    const ticketId = Number(rawTicketId);
    if (!Number.isSafeInteger(ticketId) || ticketId < 1) return reply.code(400).send({ error: 'invalid', message: 'Invalid ticket number.' });
    const page = Math.max(0, Math.min(19, Number((request.query as { page?: string }).page) || 0));
    const permissionFilter = access.isAdmin ? {} : { staffRoleIds: { $in: access.memberRoleIds } };
    const transcript = await TicketTranscriptModel.findOne({
      guildId: access.guild.id,
      ticketId,
      ...permissionFilter,
      $and: [transcriptExpiryFilter()],
    }).lean<TicketTranscriptRecord>();
    if (!transcript) return reply.code(404).send({ error: 'not_found', message: 'Transcript not found or you do not have access.' });
    const messages = await TicketTranscriptMessageModel.find({ guildId: access.guild.id, ticketId, ...transcriptExpiryFilter() })
      .sort({ createdAt: 1, messageId: 1 })
      .skip(page * TRANSCRIPT_MESSAGE_PAGE_SIZE)
      .limit(TRANSCRIPT_MESSAGE_PAGE_SIZE)
      .lean();
    return {
      transcript: {
        guildId: transcript.guildId,
        ticketId: transcript.ticketId,
        openerId: transcript.openerId,
        openerDisplayName: transcript.openerDisplayName,
        openerAvatarUrl: transcript.openerAvatarUrl,
        panelTitle: transcript.panelTitle,
        categoryLabel: transcript.categoryLabel,
        answers: transcript.answers,
        claimedBy: transcript.claimedBy,
        claimedByName: transcript.claimedByName,
        closedBy: transcript.closedBy,
        closedByName: transcript.closedByName,
        closeReason: transcript.closeReason,
        createdAt: transcript.createdAt,
        closedAt: transcript.closedAt,
        messageCount: transcript.messageCount,
        truncated: transcript.truncated,
        expiresAt: transcript.expiresAt,
      },
      canManage: access.isAdmin,
      messagePage: page,
      messagePages: Math.max(1, Math.ceil(transcript.messageCount / TRANSCRIPT_MESSAGE_PAGE_SIZE)),
      messages: messages.map((message) => ({
        ...message,
        attachments: message.attachments.map((attachment, index) => ({
          name: attachment.name,
          contentType: attachment.contentType,
          size: attachment.size,
          url: `/api/guilds/${access.guild.id}/tickets/transcripts/${ticketId}/attachments/${message.messageId}/${index}`,
        })),
      })),
    };
  });

  app.get('/api/guilds/:guildId/tickets/transcripts/:ticketId/attachments/:messageId/:index', async (request, reply) => {
    const access = await ticketTranscriptAccess(client, request, reply);
    if (!access) return;
    const { ticketId: rawTicketId, messageId, index: rawIndex } = request.params as { ticketId: string; messageId: string; index: string };
    const ticketId = Number(rawTicketId);
    const index = Number(rawIndex);
    if (!Number.isSafeInteger(ticketId) || !Number.isSafeInteger(index) || index < 0) return reply.code(400).send({ error: 'invalid', message: 'Invalid transcript attachment.' });
    const permissionFilter = access.isAdmin ? {} : { staffRoleIds: { $in: access.memberRoleIds } };
    const transcriptExists = await TicketTranscriptModel.exists({ guildId: access.guild.id, ticketId, ...permissionFilter, $and: [transcriptExpiryFilter()] });
    if (!transcriptExists) return reply.code(404).send({ error: 'not_found', message: 'Transcript not found or you do not have access.' });
    const message = await TicketTranscriptMessageModel.findOne({ guildId: access.guild.id, ticketId, messageId, ...transcriptExpiryFilter() }).lean();
    const attachment = message?.attachments[index];
    if (!attachment) return reply.code(404).send({ error: 'not_found', message: 'Attachment not found.' });
    const imageType = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes((attachment.contentType ?? '').toLowerCase());
    const sendAttachment = (bytes: Buffer) => {
      reply.header('X-Content-Type-Options', 'nosniff').header('Cache-Control', 'private, no-store');
      if (imageType) return reply.type(attachment.contentType!).header('Content-Disposition', 'inline').send(bytes);
      const safeName = attachment.name.replace(/[\r\n"\\]/g, '_').slice(0, 120) || 'ticket-attachment';
      return reply.type('application/octet-stream').header('Content-Disposition', `attachment; filename="${safeName}"`).send(bytes);
    };
    if (attachment.archiveId) {
      try {
        const archived = await readArchivedTranscriptAttachment(attachment.archiveId);
        if (archived) return sendAttachment(archived);
      } catch (error) {
        log.warn(`Could not read archived attachment for ticket #${ticketId}`, error);
      }
    }
    let url: URL;
    try {
      url = new URL(attachment.url);
    } catch {
      return reply.code(404).send({ error: 'not_found', message: 'Attachment is unavailable.' });
    }
    if (url.protocol !== 'https:' || !['cdn.discordapp.com', 'media.discordapp.net'].includes(url.hostname) || attachment.size > MAX_TRANSCRIPT_ATTACHMENT_BYTES) {
      return reply.code(400).send({ error: 'invalid', message: 'Attachment source is not allowed.' });
    }
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000), redirect: 'error' }).catch(() => null);
    if (!response?.ok) return reply.code(404).send({ error: 'not_found', message: 'Attachment is no longer available.' });
    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > MAX_TRANSCRIPT_ATTACHMENT_BYTES) return reply.code(413).send({ error: 'too_large', message: 'Attachment is too large to preview.' });
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_TRANSCRIPT_ATTACHMENT_BYTES) return reply.code(413).send({ error: 'too_large', message: 'Attachment is too large to preview.' });
    return sendAttachment(bytes);
  });

  app.get('/api/guilds/:guildId/audit', async (request, reply) => {
    const access = await managedGuild(client, request, reply);
    if (!access) return;
    const page = Math.max(0, Number((request.query as { page?: string }).page) || 0);
    const [total, rows] = await Promise.all([
      SettingsAuditModel.countDocuments({ guildId: access.guild.id }),
      SettingsAuditModel.find({ guildId: access.guild.id }).sort({ createdAt: -1 }).skip(page * 20).limit(20).lean(),
    ]);
    return {
      total,
      page,
      pages: Math.max(1, Math.ceil(total / 20)),
      entries: await Promise.all(
        rows.map(async (a) => ({ section: a.section, source: a.source, actor: await userSummary(client, a.actorId), before: a.before, after: a.after, createdAt: a.createdAt })),
      ),
    };
  });
}

/* ───────────────────────── Helpers ───────────────────────── */

type Countable = { aggregate: (pipeline: object[]) => { exec: () => Promise<Array<{ _id: string; count: number }>> } };

function perDay(model: unknown, guildId: string, since: Date) {
  return (model as Countable)
    .aggregate([
      { $match: { guildId, createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    ])
    .exec();
}

function buildDays(since: Date, cases: Array<{ _id: string; count: number }>, tickets: Array<{ _id: string; count: number }>) {
  const c = new Map(cases.map((d) => [d._id, d.count]));
  const t = new Map(tickets.map((d) => [d._id, d.count]));
  return Array.from({ length: 14 }, (_, i) => {
    const day = new Date(since.getTime() + (i + 1) * DAY).toISOString().slice(0, 10);
    return { day, cases: c.get(day) ?? 0, tickets: t.get(day) ?? 0 };
  });
}

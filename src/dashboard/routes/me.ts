import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Clanky } from '../../client/Clanky.js';
import { BADGES, gameLevel, ITEMS, itemsInZone, RARITY, THEME_BY_ID, TITLE_BY_ID, UPGRADES, ZONES } from '../../games/salvage/data.js';
import { bagView, collectionView, profileView } from '../../modules/games/views.js';
import { boostsOf, digCooldown, salvage, shinyOdds, toolOf, upgradeLevel, zoneOf } from '../../services/SalvageService.js';
import { guilds, users } from '../../services/index.js';
import { UserPreferencesSchema } from '../../settings/schema.js';
import { endAllSessions, requireUser, SESSION_COOKIE } from '../auth.js';
import { discordApi } from '../discord.js';

const avatarUrl = (id: string, avatar: string | null) =>
  avatar
    ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.${avatar.startsWith('a_') ? 'gif' : 'png'}?size=128`
    : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(id) >> 22n) % 6}.png`;

const CARD_KINDS = ['profile', 'bag', 'collection'] as const;

export async function meRoutes(app: FastifyInstance, client: Clanky) {
  app.addHook('preHandler', requireUser);

  app.get('/api/me', async (request) => {
    const s = request.session!.record;
    const record = await users.getById(s.userId);
    return {
      user: { id: s.userId, username: s.username, globalName: s.globalName, avatar: avatarUrl(s.userId, s.avatar) },
      preferences: await users.preferences(s.userId),
      stats: { commandsUsed: record?.stats.commandsUsed ?? 0, since: record?.createdAt ?? null },
    };
  });

  app.patch('/api/me/preferences', async (request, reply) => {
    const parsed = UserPreferencesSchema.partial().strict().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid', message: 'Some values are not valid.' });
    return { preferences: await users.updatePreferences(request.session!.record.userId, parsed.data) };
  });

  app.post('/api/me/delete', async (request, reply) => {
    const { confirm } = z.object({ confirm: z.literal('DELETE') }).parse(request.body);
    if (confirm !== 'DELETE') return reply.code(400).send({ error: 'invalid' });
    const userId = request.session!.record.userId;
    await users.deleteAllData(userId);
    await endAllSessions(userId);
    discordApi.forget(userId);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/me/salvage', async (request) => {
    const player = await salvage.find(request.session!.record.userId);
    if (!player) return { player: null };
    const progress = gameLevel(player.xp);
    const found = player.found ?? {};
    const earned = new Set(salvage.badges(player).map((b) => b.id));
    const best = player.bestFind ? ITEMS.find((i) => i.id === player.bestFind!.itemId) : null;
    const tool = toolOf(player);
    const zone = zoneOf(player);
    return {
      player: {
        level: progress.level,
        xp: player.xp,
        currentXp: progress.current,
        neededXp: progress.needed,
        credits: player.credits,
        lifetimeCredits: player.lifetimeCredits,
        digs: player.digs,
        streak: player.streak,
        bestStreak: player.bestStreak ?? player.streak,
        golemWins: player.golemWins ?? 0,
        rank: await salvage.rank(player, null),
        collected: Object.values(found).filter((c) => c > 0).length,
        collectable: ITEMS.length,
        shinies: player.shinies.length,
        cooldown: digCooldown(player),
        shinyOdds: shinyOdds(player),
        zone: { id: zone.id, name: zone.name, emoji: zone.emoji },
        tool: { id: tool.id, name: tool.name, emoji: tool.emoji },
        title: (TITLE_BY_ID.get(player.title) ?? { name: 'Rookie Digger' }).name,
        theme: (THEME_BY_ID.get(player.theme) ?? { name: 'Hazard' }).name,
        bestFind: best ? { name: best.name, shiny: player.bestFind!.shiny, rarity: RARITY[best.rarity].name, color: RARITY[best.rarity].color, icon: best.icon } : null,
        boosts: boostsOf(player),
        upgrades: UPGRADES.map((u) => ({ id: u.id, name: u.name, emoji: u.emoji, level: upgradeLevel(player, u.id), max: u.maxLevel })),
        badges: BADGES.map((b) => ({ id: b.id, name: b.name, icon: b.icon, hint: b.hint, earned: earned.has(b.id) })),
        zones: ZONES.map((z) => {
          const items = itemsInZone(z.id);
          return { id: z.id, name: z.name, emoji: z.emoji, level: z.level, unlocked: progress.level >= z.level, found: items.filter((i) => (found[i.id] ?? 0) > 0).length, total: items.length };
        }),
      },
    };
  });

  /** The same image cards the bot sends in Discord. */
  app.get('/api/me/salvage/card/:kind', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const kind = (request.params as { kind: string }).kind.replace(/\.png$/, '') as (typeof CARD_KINDS)[number];
    if (!CARD_KINDS.includes(kind)) return reply.code(404).send({ error: 'not_found' });
    const q = request.query as { page?: string; zone?: string; guild?: string };
    const userId = request.session!.record.userId;
    const player = await salvage.find(userId);
    if (!player) return reply.code(404).send({ error: 'not_found', message: 'Play Salvage first!' });

    const accent = q.guild && client.guilds.cache.has(q.guild) ? (await guilds.settings(q.guild)).general.accentColor : 0xe2702f;
    let view;
    if (kind === 'profile') {
      const user = await client.users.fetch(userId);
      view = await profileView(player, user, userId, accent, null);
    } else if (kind === 'bag') {
      view = await bagView(player, userId, accent, Math.max(0, Number(q.page) || 0));
    } else {
      view = await collectionView(player, userId, q.zone ?? zoneOf(player).id, accent);
    }
    const file = view.files?.[0] as { attachment: Buffer } | undefined;
    if (!file) return reply.code(500).send({ error: 'render' });
    return reply.header('Content-Type', 'image/png').header('Cache-Control', 'private, max-age=10').send(file.attachment);
  });
}

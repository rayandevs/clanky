import type { FastifyInstance } from 'fastify';
import type { Clanky } from '../../client/Clanky.js';
import { changelog } from '../../config/changelog.js';
import { env } from '../../config/env.js';
import { version } from '../../config/version.js';
import { ITEMS, ZONES } from '../../games/salvage/data.js';
import { MODULES } from '../../settings/registry.js';
import { inviteUrl } from '../access.js';
import { loginEnabled } from '../auth.js';
import { dashboardChangelog, dashboardVersion } from '../version.js';

export async function publicRoutes(app: FastifyInstance, client: Clanky) {
  app.get('/api/meta', async () => {
    const members = client.guilds.cache.reduce((sum, g) => sum + (g.memberCount ?? 0), 0);
    return {
      bot: {
        name: client.user?.username ?? 'Clanky',
        avatar: client.user?.displayAvatarURL({ size: 256, extension: 'png' }) ?? null,
        online: client.isReady(),
        version: { raw: version.raw, label: version.label, codename: version.codename },
        servers: client.guilds.cache.size,
        members,
        commands: client.commands.size,
        uptime: Date.now() - client.startedAt,
        ping: Math.max(0, client.ws.ping),
      },
      dashboard: { version: { raw: dashboardVersion.raw, label: dashboardVersion.label, codename: dashboardVersion.codename } },
      game: { items: ITEMS.length, zones: ZONES.length },
      modules: MODULES,
      loginEnabled,
      feedbackEnabled: Boolean(env.FEEDBACK_WEBHOOK_URL),
      inviteUrl: inviteUrl(),
      supportUrl: env.SUPPORT_URL ?? null,
    };
  });

  app.get('/api/changelog', async () => ({ bot: changelog, dashboard: dashboardChangelog }));

  app.get('/api/health', async () => ({ ok: true, ready: client.isReady() }));
}

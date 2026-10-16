import { env } from './config/env.js';
import { version } from './config/version.js';
import { Clanky } from './client/Clanky.js';
import { startDashboard } from './dashboard/server.js';
import { logger, setLogLevel } from './core/logger.js';
import { connectDatabase, disconnectDatabase } from './database/connection.js';
import { levels } from './services/index.js';
import { startTranscriptAttachmentCleanup } from './modules/tickets/attachmentArchive.js';
import { registerEvents } from './events/index.js';
import { modules } from './modules/index.js';

setLogLevel(env.LOG_LEVEL);
logger.info(`Starting Clanky ${version.label} (${version.codename}) in ${env.NODE_ENV} mode`);

const client = new Clanky();
let dashboard: Awaited<ReturnType<typeof startDashboard>> = null;
let stopTranscriptAttachmentCleanup: () => void = () => undefined;
client.register(modules);
registerEvents(client);
logger.info(`Loaded ${client.commands.size} commands and ${client.components.size} component handlers`);

async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received, shutting down…`);
  stopTranscriptAttachmentCleanup();
  await dashboard?.close().catch(() => null);
  await client.destroy().catch(() => null);
  await disconnectDatabase().catch(() => null);
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => logger.error('Unhandled rejection', reason));
process.on('uncaughtException', (error) => logger.error('Uncaught exception', error));

await connectDatabase();
const migratedLevelMembers = await levels.migrateMemberProgress();
if (migratedLevelMembers) logger.info(`Migrated ${migratedLevelMembers} leveling records for updated message and progression tracking`);
stopTranscriptAttachmentCleanup = startTranscriptAttachmentCleanup();
await client.login(env.DISCORD_TOKEN);
dashboard = await startDashboard(client).catch((error) => {
  logger.error('Dashboard failed to start', error);
  return null;
});

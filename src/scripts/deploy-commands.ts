/**
 * Registers slash commands and context menus with Discord.
 *
 *   npm run deploy:commands            → DEV_GUILD_ID if set, else global
 *   npm run deploy:commands -- --global → force global
 *   npm run deploy:commands -- --clear  → remove all commands
 */
import { REST, Routes } from 'discord.js';
import { env } from '../config/env.js';
import { version } from '../config/version.js';
import { modules } from '../modules/index.js';

const args = new Set(process.argv.slice(2));
const clear = args.has('--clear');
const global = args.has('--global') || !env.DEV_GUILD_ID;

const body = clear ? [] : modules.flatMap((m) => m.commands.map((c) => c.data.toJSON()));
const rest = new REST().setToken(env.DISCORD_TOKEN);
const route = global
  ? Routes.applicationCommands(env.DISCORD_CLIENT_ID)
  : Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DEV_GUILD_ID!);

console.log(`🚀 ${clear ? 'Clearing' : 'Deploying'} ${body.length} commands ${global ? 'globally' : `to server ${env.DEV_GUILD_ID}`} (Clanky ${version.label})…`);
const result = (await rest.put(route, { body })) as unknown[];
console.log(`✅ Done. ${result.length} commands registered.${global ? ' Global changes can take a few minutes to show.' : ''}`);

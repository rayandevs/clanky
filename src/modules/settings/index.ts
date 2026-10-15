import { PermissionFlagsBits, SlashCommandBuilder, type Guild } from 'discord.js';
import type { Clanky } from '../../client/Clanky.js';
import { inServers } from '../../core/builders.js';
import { guildComponents, guildSlashCommand, type BotModuleDefinition } from '../../core/types.js';
import { guilds } from '../../services/index.js';
import { notice, v2 } from '../../ui/components.js';
import { reply } from '../../ui/respond.js';
import type { PageId, SettingsCtx, SettingsPage } from './kit.js';
import { automodPage } from './pages/automod.js';
import { gamesPage } from './pages/games.js';
import { generalPage } from './pages/general.js';
import { homePage } from './pages/home.js';
import { levelingPage } from './pages/leveling.js';
import { loggingPage } from './pages/logging.js';
import { moderationPage } from './pages/moderation.js';
import { suggestionsPage } from './pages/suggestions.js';
import { ticketsPage } from './pages/tickets.js';
import { welcomePage } from './pages/welcome.js';

const PAGES = new Map<PageId, SettingsPage>(
  [homePage, generalPage, moderationPage, automodPage, loggingPage, welcomePage, ticketsPage, suggestionsPage, levelingPage, gamesPage].map((p) => [p.id, p]),
);

async function renderPage(client: Clanky, guild: Guild, pageId: PageId, state: string[] = []) {
  const record = await guilds.get(guild.id);
  const page = PAGES.get(pageId) ?? homePage;
  return page.render({ client, guild, settings: record.settings, accent: record.settings.general.accentColor }, state);
}

const settingsCommand = guildSlashCommand({
  module: 'core',
  data: inServers(
    new SlashCommandBuilder()
      .setName('settings')
      .setDescription('Set up Clanky for this server')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addStringOption((o) =>
        o
          .setName('module')
          .setDescription('Jump straight to a module')
          .addChoices(...[...PAGES.keys()].filter((id) => id !== 'home').map((id) => ({ name: id[0]!.toUpperCase() + id.slice(1), value: id }))),
      ),
  ),
  execute: async ({ client, interaction }) => {
    const pageId = (interaction.options.getString('module') ?? 'home') as PageId;
    await interaction.reply(v2(await renderPage(client, interaction.guild, pageId), { ephemeral: true }));
  },
});

/** All settings controls use custom IDs like `set:<page>:<action>:<args…>`. */
const settingsComponents = guildComponents({
  prefix: 'set',
  module: 'core',
  button: (ctx, args) => dispatch(ctx, args),
  select: (ctx, args) => dispatch(ctx, args),
  modal: (ctx, args) => dispatch(ctx, args),
});

async function dispatch(ctx: SettingsCtx, args: string[]): Promise<void> {
  const { interaction, client } = ctx;
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    await reply(interaction, 'error', 'You need the **Manage Server** permission to change settings.');
    return;
  }

  const [pageArg, action = '', ...rest] = args;
  let pageId = pageArg as PageId;

  if (pageArg === 'nav') {
    pageId = (interaction.isStringSelectMenu() ? interaction.values[0] : 'home') as PageId;
  } else {
    const page = PAGES.get(pageId);
    if (!page?.handle) return;
    const result = await page.handle(ctx, action, rest);
    if (result === 'done') return;
    const state = typeof result === 'object' && 'state' in result ? result.state : [];
    await update(ctx, await renderPage(client, interaction.guild, pageId, state));
    if (typeof result === 'object' && 'warn' in result) await interaction.followUp(v2(notice('info', result.warn), { ephemeral: true }));
    return;
  }

  await update(ctx, await renderPage(client, interaction.guild, pageId));
}

async function update(ctx: SettingsCtx, container: Awaited<ReturnType<typeof renderPage>>) {
  const { interaction } = ctx;
  if (interaction.isModalSubmit()) {
    if (interaction.isFromMessage()) await interaction.update({ components: [container] });
    else await interaction.reply(v2(container, { ephemeral: true }));
    return;
  }
  await interaction.update({ components: [container] });
}

export const settingsModule: BotModuleDefinition = {
  commands: [settingsCommand],
  components: [settingsComponents],
};

import {
  ApplicationCommandType,
  DiscordAPIError,
  type AnySelectMenuInteraction,
  type AutocompleteInteraction,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Interaction,
  type MessageContextMenuCommandInteraction,
  type ModalSubmitInteraction,
  type RepliableInteraction,
  type UserContextMenuCommandInteraction,
} from 'discord.js';
import { commandKey, type Clanky } from '../client/Clanky.js';
import { version } from '../config/version.js';
import { guilds, users } from '../services/index.js';
import { getModule } from '../settings/registry.js';
import { notice, v2 } from '../ui/components.js';
import { emoji } from '../ui/emoji.js';
import { respond } from '../ui/respond.js';
import { colors } from '../ui/theme.js';
import { useCooldown } from './cooldowns.js';
import { parseCid } from './customId.js';
import { createLogger } from './logger.js';
import type { Context, ModuleId } from './types.js';

const log = createLogger('router');

async function buildContext<I extends Interaction>(client: Clanky, interaction: I): Promise<Context<I>> {
  const [user, guild] = await Promise.all([
    users.get(interaction.user),
    interaction.inCachedGuild() ? guilds.get(interaction.guildId) : Promise.resolve(null),
  ]);
  return { client, interaction, user, guild, accent: guild?.settings.general.accentColor ?? colors.brand };
}

/** Returns a message if the module is switched off in this server. */
function moduleDisabled(ctx: Context<unknown>, module: ModuleId): string | null {
  if (module === 'core' || !ctx.guild) return null;
  const info = getModule(module);
  if (!info?.toggleable) return null;
  const section = ctx.guild.settings[module] as { enabled?: boolean };
  if (section.enabled !== false) return null;
  return `${emoji(info.emoji)} **${info.name}** is turned off here. An admin can turn it on in ${ctx.client.cmd('settings')}.`;
}

async function fail(interaction: RepliableInteraction, error: unknown): Promise<void> {
  const ref = Math.random().toString(36).slice(2, 8).toUpperCase();
  log.error(`Interaction failed (ref ${ref})`, error);

  let message = `Something went wrong. Please try again.\n-# Error ref: \`${ref}\``;
  if (error instanceof DiscordAPIError && error.code === 50013) {
    message = "I'm missing permissions to do that. Check my role and channel permissions.";
  }
  try {
    await respond(interaction, notice('error', message), { ephemeral: true });
  } catch {
    /* interaction expired */
  }
}

async function maybeShowUpdateNotice<I extends RepliableInteraction>(ctx: Context<I>): Promise<void> {
  const { user, interaction } = ctx;
  if (!user.preferences.updateNotices || user.lastSeenVersion === version.raw) return;
  await users.markVersionSeen(user.userId);
  if (!interaction.replied && !interaction.deferred) return;
  await interaction
    // Small, one-time note after an update.
    .followUp(v2(notice('info', `Clanky was updated to **${version.label}**. See what's new with ${ctx.client.cmd('about')}.`), { ephemeral: true }))
    .catch(() => null);
}

type CommandInteractionKind = ChatInputCommandInteraction | UserContextMenuCommandInteraction | MessageContextMenuCommandInteraction;

async function handleCommand(client: Clanky, interaction: CommandInteractionKind): Promise<void> {
  const command = client.commands.get(commandKey(interaction.commandType, interaction.commandName));
  if (!command) return;

  const ctx = await buildContext(client, interaction);
  if (ctx.user.flags.blacklisted) {
    await respond(interaction, notice('error', "You can't use Clanky right now."), { ephemeral: true });
    return;
  }
  if (command.guildOnly && !interaction.inCachedGuild()) {
    await respond(interaction, notice('warning', 'This command only works in servers where Clanky is added.'), { ephemeral: true });
    return;
  }
  const disabled = moduleDisabled(ctx, command.module);
  if (disabled) {
    await respond(interaction, notice('warning', disabled), { ephemeral: true });
    return;
  }
  if (command.cooldown) {
    const left = useCooldown(`${interaction.commandName}:${interaction.user.id}`, command.cooldown);
    if (left) {
      const seconds = Math.ceil(left / 1000);
      await respond(interaction, notice('warning', `Slow down a little. Try again in **${seconds}s**.`), { ephemeral: true });
      return;
    }
  }

  try {
    await command.execute(ctx);
    users.trackCommand(interaction.user.id).catch(() => null);
    await maybeShowUpdateNotice(ctx);
  } catch (error) {
    await fail(interaction, error);
  }
}

async function handleAutocomplete(client: Clanky, interaction: AutocompleteInteraction): Promise<void> {
  const command = client.commands.get(commandKey(ApplicationCommandType.ChatInput, interaction.commandName));
  if (command?.kind !== 'slash' || !command.autocomplete) return;
  if (command.guildOnly && !interaction.inCachedGuild()) return interaction.respond([]);
  try {
    await command.autocomplete(await buildContext(client, interaction));
  } catch (error) {
    log.warn('Autocomplete failed', error);
    await interaction.respond([]).catch(() => null);
  }
}

async function handleComponent(
  client: Clanky,
  interaction: ButtonInteraction | AnySelectMenuInteraction | ModalSubmitInteraction,
): Promise<void> {
  const { prefix, args } = parseCid(interaction.customId);
  const handler = client.components.get(prefix);
  if (!handler) return;

  const method = interaction.isButton()
    ? handler.button
    : interaction.isAnySelectMenu()
      ? handler.select
      : interaction.isModalSubmit()
        ? handler.modal
        : undefined;
  if (!method) return;

  const ctx = await buildContext(client, interaction);
  if (handler.guildOnly && !interaction.inCachedGuild()) {
    await respond(interaction, notice('warning', 'This only works in servers where Clanky is added.'), { ephemeral: true });
    return;
  }
  const disabled = moduleDisabled(ctx, handler.module);
  if (disabled) {
    await respond(interaction, notice('warning', disabled), { ephemeral: true });
    return;
  }

  try {
    await method(ctx, args);
  } catch (error) {
    await fail(interaction, error);
  }
}

export async function routeInteraction(client: Clanky, interaction: Interaction): Promise<void> {
  if (interaction.isAutocomplete()) return handleAutocomplete(client, interaction);
  if (interaction.isChatInputCommand() || interaction.isUserContextMenuCommand() || interaction.isMessageContextMenuCommand()) {
    return handleCommand(client, interaction);
  }
  if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) return handleComponent(client, interaction);
}

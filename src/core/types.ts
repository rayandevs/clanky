import type {
  AnySelectMenuInteraction,
  AutocompleteInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  MessageContextMenuCommandInteraction,
  ModalSubmitInteraction,
  RESTPostAPIApplicationCommandsJSONBody,
  UserContextMenuCommandInteraction,
} from 'discord.js';
import type { Clanky } from '../client/Clanky.js';
import type { GuildRecord, UserRecord } from '../database/models/index.js';
import type { SettingsSection } from '../settings/schema.js';

export type ModuleId = SettingsSection | 'core';

/** Everything a handler needs, resolved once per interaction. */
export interface Context<I> {
  client: Clanky;
  interaction: I;
  user: UserRecord;
  guild: GuildRecord | null;
  /** Accent color for containers (server setting or brand color). */
  accent: number;
}

/** Context for handlers that only run inside servers Clanky is in. */
export interface GuildContext<I> extends Context<I> {
  guild: GuildRecord;
}

interface CommandData {
  name: string;
  toJSON(): RESTPostAPIApplicationCommandsJSONBody;
}

interface BaseCommand {
  module: ModuleId;
  data: CommandData;
  /** Cooldown in seconds. */
  cooldown?: number;
  /** Requires Clanky to be in the server (not only user-installed). */
  guildOnly: boolean;
}

// Handlers are stored loosely; the definers below give them precise types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (ctx: any) => Promise<unknown>;

export interface SlashCommand extends BaseCommand {
  kind: 'slash';
  execute: Handler;
  autocomplete?: Handler;
}

export interface UserMenuCommand extends BaseCommand {
  kind: 'user';
  execute: Handler;
}

export interface MessageMenuCommand extends BaseCommand {
  kind: 'message';
  execute: Handler;
}

export type AnyCommand = SlashCommand | UserMenuCommand | MessageMenuCommand;

export interface ComponentHandler {
  /** First segment of the custom ID, e.g. "set" in "set:welcome:toggle". */
  prefix: string;
  module: ModuleId;
  guildOnly: boolean;
  button?: (ctx: any, args: string[]) => Promise<unknown>;
  select?: (ctx: any, args: string[]) => Promise<unknown>;
  modal?: (ctx: any, args: string[]) => Promise<unknown>;
}

export interface BotModuleDefinition {
  commands: AnyCommand[];
  components: ComponentHandler[];
}

/* ───────────────────────────── Definers ─────────────────────────────
 * Small helpers that give handlers precise types without boilerplate.
 * ─────────────────────────────────────────────────────────────────── */

type Cached<I> = I extends ChatInputCommandInteraction
  ? ChatInputCommandInteraction<'cached'>
  : I extends AutocompleteInteraction
    ? AutocompleteInteraction<'cached'>
    : I extends UserContextMenuCommandInteraction
      ? UserContextMenuCommandInteraction<'cached'>
      : I extends MessageContextMenuCommandInteraction
        ? MessageContextMenuCommandInteraction<'cached'>
        : I extends ButtonInteraction
          ? ButtonInteraction<'cached'>
          : I extends ModalSubmitInteraction
            ? ModalSubmitInteraction<'cached'>
            : I extends AnySelectMenuInteraction
              ? AnySelectMenuInteraction<'cached'>
              : never;

export function slashCommand(def: {
  module: ModuleId;
  data: CommandData;
  cooldown?: number;
  execute: (ctx: Context<ChatInputCommandInteraction>) => Promise<unknown>;
  autocomplete?: (ctx: Context<AutocompleteInteraction>) => Promise<unknown>;
}): SlashCommand {
  return { kind: 'slash', guildOnly: false, ...def };
}

export function guildSlashCommand(def: {
  module: ModuleId;
  data: CommandData;
  cooldown?: number;
  execute: (ctx: GuildContext<Cached<ChatInputCommandInteraction>>) => Promise<unknown>;
  autocomplete?: (ctx: GuildContext<Cached<AutocompleteInteraction>>) => Promise<unknown>;
}): SlashCommand {
  return { kind: 'slash', guildOnly: true, ...def };
}

export function guildUserMenu(def: {
  module: ModuleId;
  data: CommandData;
  cooldown?: number;
  execute: (ctx: GuildContext<Cached<UserContextMenuCommandInteraction>>) => Promise<unknown>;
}): UserMenuCommand {
  return { kind: 'user', guildOnly: true, ...def };
}

export function guildMessageMenu(def: {
  module: ModuleId;
  data: CommandData;
  cooldown?: number;
  execute: (ctx: GuildContext<Cached<MessageContextMenuCommandInteraction>>) => Promise<unknown>;
}): MessageMenuCommand {
  return { kind: 'message', guildOnly: true, ...def };
}

export function components(def: {
  prefix: string;
  module: ModuleId;
  button?: (ctx: Context<ButtonInteraction>, args: string[]) => Promise<unknown>;
  select?: (ctx: Context<AnySelectMenuInteraction>, args: string[]) => Promise<unknown>;
  modal?: (ctx: Context<ModalSubmitInteraction>, args: string[]) => Promise<unknown>;
}): ComponentHandler {
  return { guildOnly: false, ...def };
}

export function guildComponents(def: {
  prefix: string;
  module: ModuleId;
  button?: (ctx: GuildContext<ButtonInteraction<'cached'>>, args: string[]) => Promise<unknown>;
  select?: (ctx: GuildContext<AnySelectMenuInteraction<'cached'>>, args: string[]) => Promise<unknown>;
  modal?: (ctx: GuildContext<ModalSubmitInteraction<'cached'>>, args: string[]) => Promise<unknown>;
}): ComponentHandler {
  return { guildOnly: true, ...def };
}
